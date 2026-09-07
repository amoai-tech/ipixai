-- IPI-900: allow the product app to read/update brand-linked assets by brand owner.
-- Historical assets policies are shoot-owner scoped; iPix MVP assets are also
-- associated to public.brands through assets.brand_id.

drop policy if exists "assets_select_via_brand" on public.assets;
create policy "assets_select_via_brand"
  on public.assets for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = assets.brand_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "assets_insert_via_brand" on public.assets;
create policy "assets_insert_via_brand"
  on public.assets for insert to authenticated
  with check (
    exists (
      select 1 from public.brands b
      where b.id = assets.brand_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "assets_update_via_brand" on public.assets;
create policy "assets_update_via_brand"
  on public.assets for update to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = assets.brand_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brands b
      where b.id = assets.brand_id and b.user_id = auth.uid()
    )
  );
