-- Repair remote: 20260627130000 may have applied is_org_member-only INSERT.
-- Tighten to editor+ via is_org_editor_or_above, keep creator (user_id) fallback.

create or replace function public.is_org_editor_or_above(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = (select auth.uid())
      and role in ('owner', 'editor')
  );
$$;

drop policy if exists "brand_scores_insert_via_brand" on public.brand_scores;

create policy "brand_scores_insert_via_brand"
  on public.brand_scores for insert to authenticated
  with check (
    exists (
      select 1 from public.brands b
      where b.id = brand_scores.brand_id
        and (
          b.user_id = (select auth.uid())
          or public.is_org_editor_or_above(b.org_id)
        )
    )
  );
