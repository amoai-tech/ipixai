-- IPI-1311 · AUTH-ORG-SINGLE-001 — Step 1: reconcile the one known duplicate
-- org_members row before the one-membership-per-user invariant is added.
--
-- Before-state (live read-only audit, 2026-09-23):
--   org_id='00000000-0000-0000-0000-000000000001' (Acme Corp, seed org,
--   owner_id='fde772a8-80d5-4965-bc7f-da3c24ef37f2' — NOT this user),
--   user_id='9ea3d390-78ce-4e61-b159-8bf922c7d474', role='owner'.
-- Canonical membership kept: org_id='c48d7cab-5d4c-4a11-938b-b0fdfd1ec364'
-- (majji), the user's own materialized onboarding org (owner_id = user).
-- Verified the removed row owns zero brands/shoots/assets in Acme Corp
-- (all 4 Acme brands belong to the real owner) — not a STOP condition.
--
-- Rollback:
--   insert into public.org_members (org_id, user_id, role)
--   values ('00000000-0000-0000-0000-000000000001',
--           '9ea3d390-78ce-4e61-b159-8bf922c7d474', 'owner');

delete from public.org_members
where org_id = '00000000-0000-0000-0000-000000000001'
  and user_id = '9ea3d390-78ce-4e61-b159-8bf922c7d474';
