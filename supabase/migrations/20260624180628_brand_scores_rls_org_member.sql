-- Remote-applied migration (synced from Supabase history): org-scoped SELECT on brand_scores

drop policy if exists "brand_scores_select_via_brand" on public.brand_scores;

create policy "brand_scores_select_via_brand"
  on public.brand_scores for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_scores.brand_id
        and public.is_org_member(b.org_id)
    )
  );
