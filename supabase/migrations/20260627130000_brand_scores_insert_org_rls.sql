-- IPI-25 follow-up: org members can INSERT brand_scores for org brands.
-- Uses is_org_member (owner, editor, viewer — no role filter), same as SELECT/UPDATE (IPI-46).
-- Prior INSERT required brands.user_id = auth.uid(), breaking upsert for non-creator members.
-- Superseded by 20260627140000 (editor+ or creator).

drop policy if exists "brand_scores_insert_via_brand" on public.brand_scores;

create policy "brand_scores_insert_via_brand"
  on public.brand_scores for insert to authenticated
  with check (
    exists (
      select 1 from public.brands b
      where b.id = brand_scores.brand_id
        and public.is_org_member(b.org_id)
    )
  );
