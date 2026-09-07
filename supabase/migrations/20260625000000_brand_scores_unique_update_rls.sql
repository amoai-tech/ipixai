-- IPI-46: idempotent score upserts + UPDATE RLS for brand-intelligence re-analysis

-- Keep newest row per (brand_id, score_type) before adding UNIQUE
drop policy if exists "brand_scores_update_via_brand" on public.brand_scores;

delete from public.brand_scores a
using public.brand_scores b
where a.brand_id = b.brand_id
  and a.score_type = b.score_type
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

create unique index if not exists brand_scores_brand_id_score_type_uidx
  on public.brand_scores (brand_id, score_type);

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
