-- Align DELETE with INSERT: editor+ or brand creator (brand-intelligence re-analysis).

drop policy if exists "brand_scores_delete_via_brand" on public.brand_scores;

create policy "brand_scores_delete_via_brand"
  on public.brand_scores for delete to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_scores.brand_id
        and (
          b.user_id = (select auth.uid())
          or public.is_org_editor_or_above(b.org_id)
        )
    )
  );
