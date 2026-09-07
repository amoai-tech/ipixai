-- IPI-26 — brand_crawl_results (Firecrawl job tracking + Realtime)

create table if not exists public.brand_crawl_results (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brands(id) on delete cascade,
  firecrawl_job_id text unique,
  status           text not null default 'queued'
    check (status in ('queued', 'running', 'complete', 'failed')),
  pages_crawled    int not null default 0,
  raw_data         jsonb not null default '{}',
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists brand_crawl_results_brand_id_idx
  on public.brand_crawl_results (brand_id);

create index if not exists brand_crawl_results_job_id_idx
  on public.brand_crawl_results (firecrawl_job_id)
  where firecrawl_job_id is not null;

comment on table public.brand_crawl_results is
  'Firecrawl async job status. Supabase Realtime enabled for crawl progress streaming.';

alter table public.brand_crawl_results enable row level security;

drop policy if exists "crawl_results_select_org_member" on public.brand_crawl_results;

create policy "crawl_results_select_org_member"
  on public.brand_crawl_results for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_crawl_results.brand_id
        and public.is_org_member(b.org_id)
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'brand_crawl_results'
  ) then
    alter publication supabase_realtime add table public.brand_crawl_results;
  end if;
end $$;
