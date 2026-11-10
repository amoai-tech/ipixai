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
