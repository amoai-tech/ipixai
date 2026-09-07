-- IPI-499: assets_select_via_brand wasn't org-aware. An operator who can see a
-- brand via org membership (brands_select_org / get_brand_assets both already
-- check public.is_org_member) got zero rows from /app/assets and any other
-- direct `assets` query for that brand unless they were the literal owner.
-- Mirrors brands_select_org's own final pattern (20260627170000).
--
-- SELECT only — insert/update stay owner-scoped; write access for org members
-- is a separate product decision, not part of this bug.

drop policy if exists "assets_select_via_brand" on public.assets;
create policy "assets_select_via_brand"
  on public.assets for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = assets.brand_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  );
