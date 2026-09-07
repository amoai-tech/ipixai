-- Allow brand owners to replace scores on re-analysis (brand-intelligence edge function)

create policy "brand_scores_delete_via_brand"
  on public.brand_scores for delete to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_scores.brand_id and b.user_id = auth.uid()
    )
  );
