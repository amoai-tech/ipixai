-- Repair: dedup tie-break + org-scoped UPDATE (post IPI-46 deploy)

delete from public.brand_scores a
using public.brand_scores b
where a.brand_id = b.brand_id
  and a.score_type = b.score_type
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

drop policy if exists "brand_scores_update_via_brand" on public.brand_scores;

create policy "brand_scores_update_via_brand"
  on public.brand_scores for update to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_scores.brand_id
        and public.is_org_member(b.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.brands b
      where b.id = brand_scores.brand_id
        and public.is_org_member(b.org_id)
    )
  );
