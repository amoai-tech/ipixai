-- IPI-665 · SB-CI-001 — clear existing `db lint --fail-on error` blockers on
-- public so the linked CI gate can enforce public+planner honestly.
--
-- 1) identify_rls_policies_needing_optimization referenced pg_policies.polrelid
--    (not a column on the view) — use the view's text `qual` / `with_check`.
-- 2) search_brands returns double precision from `1 - (embedding <=> …)` but
--    declares similarity as real — cast explicitly.

create or replace function public.identify_rls_policies_needing_optimization()
returns table(
  schemaname text,
  tablename text,
  policyname text,
  cmd text,
  definition text,
  recommendation text
)
language plpgsql
security definer
set search_path to ''
as $$
begin
  return query
  select
    p.schemaname::text,
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    coalesce(p.qual, p.with_check)::text as definition,
    case
      when coalesce(p.qual, p.with_check)::text like '%auth.uid()%'
        and coalesce(p.qual, p.with_check)::text not like '%(select auth.uid())%'
        then 'Replace auth.uid() with (select auth.uid())'
      when coalesce(p.qual, p.with_check)::text like '%auth.jwt()%'
        and coalesce(p.qual, p.with_check)::text not like '%(select auth.jwt())%'
        then 'Replace auth.jwt() with (select auth.jwt())'
      else 'No optimization needed'
    end as recommendation
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'
    and (
      coalesce(p.qual, p.with_check)::text like '%auth.uid()%'
      or coalesce(p.qual, p.with_check)::text like '%auth.jwt()%'
    )
    and (
      coalesce(p.qual, p.with_check)::text not like '%(select auth.uid())%'
      or coalesce(p.qual, p.with_check)::text not like '%(select auth.jwt())%'
    )
  order by p.tablename, p.policyname;
end;
$$;

create or replace function public.search_brands(
  p_embedding vector,
  p_limit integer default 20,
  p_exclude_brand_id uuid default null
)
returns table(
  brand_id uuid,
  brand_name text,
  similarity real,
  shared_nodes jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  return query
  select
    b.id,
    b.name,
    (1 - (b.embedding <=> p_embedding))::real as similarity,
    (
      select jsonb_agg(jsonb_build_object(
        'node_type', gn.node_type,
        'label', gn.label
      ))
      from public.brand_graph_nodes gn
      where gn.brand_id = b.id
        and gn.label in (
          select g2.label
          from public.brand_graph_nodes g2
          where (p_exclude_brand_id is null or g2.brand_id = p_exclude_brand_id)
        )
      limit 10
    ) as shared_nodes
  from public.brands b
  where b.embedding is not null
    and (p_exclude_brand_id is null or b.id != p_exclude_brand_id)
  order by b.embedding <=> p_embedding
  limit p_limit;
end;
$$;
