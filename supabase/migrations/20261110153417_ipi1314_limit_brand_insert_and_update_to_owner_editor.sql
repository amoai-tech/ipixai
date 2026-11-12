-- IPI-1314: role-scoped Brand creation and ordinary-field updates.
-- Keep the approval-owned Brand Intelligence fields behind existing RPCs.
-- The only authenticated INSERT columns remain id/name/org_id/user_id/brand_url.
-- Onboarding and CRM conversion set user_id to the signed-in operator.
alter policy "brands_insert_org" on public.brands
  with check (
    org_id is not null
    and public.is_org_editor_or_above(org_id)
    and user_id = (select auth.uid())
  );

-- The original legacy personal-owner branch remains explicit.
alter policy "brands_update_org" on public.brands
  using (
    (org_id is null and user_id = (select auth.uid()))
    or (org_id is not null and public.is_org_editor_or_above(org_id))
  )
  with check (
    (org_id is null and user_id = (select auth.uid()))
    or (org_id is not null and public.is_org_editor_or_above(org_id))
  );

-- NEVER grant unrestricted UPDATE. Approved ai_profile, approved_* and
-- org/owner identity remain protected; editors only rename or edit Brand URL.
revoke update on table public.brands from authenticated;
grant update (name, brand_url) on table public.brands to authenticated;

-- Recovery / rollback (MANUAL, reviewed migration only; never run on hosted DB
-- as part of this PR). Historical policy expressions are from:
-- 20260624000000_ipi16_org_layer.sql (INSERT) and
-- 20260627170000_brands_rls_null_org_backfill.sql (UPDATE).
-- The immediately preceding 20260911000000_ipi1093_brand_db_write_boundary.sql
-- had REVOKED table-level UPDATE; do NOT GRANT UPDATE on the whole table.
--
--   ALTER POLICY "brands_insert_org" ON public.brands
--     WITH CHECK (public.is_org_member(org_id));
--   ALTER POLICY "brands_update_org" ON public.brands
--     USING (
--       (org_id IS NULL AND user_id = (SELECT auth.uid()))
--       OR (org_id IS NOT NULL AND public.is_org_member(org_id))
--     )
--     WITH CHECK (
--       (org_id IS NULL AND user_id = (SELECT auth.uid()))
--       OR (org_id IS NOT NULL AND public.is_org_member(org_id))
--     );
--   REVOKE UPDATE (name, brand_url) ON public.brands FROM authenticated;
--
-- CAUTION: Restoring the former INSERT policy allows org viewers to insert
-- Brands again, including forged creator IDs. Prefer a narrow forward fix
-- if an application regression occurs. Confirm the live catalog and grants
-- before any separately approved rollback.
