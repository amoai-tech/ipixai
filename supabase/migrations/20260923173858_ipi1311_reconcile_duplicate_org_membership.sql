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
--
-- Safety note (PR #262 review): this DELETE targets a hard-coded
-- (org_id, user_id) pair, so replaying it against a DIFFERENT environment
-- that happens to contain a legitimate row with the same identifiers would
-- silently remove that membership too. Verified this cannot happen here:
-- no other migration or seed creates this org/user pair anywhere (grepped
-- the full supabase/migrations/*.sql tree), there is no supabase/seed.sql
-- (supabase/config.toml's [db.seed] is explicitly disabled), and
-- IPI-1162's fresh-replay contract requires no migration/seed to depend on
-- demo/production data — so a fresh or CI-replayed database can never have
-- this row, making the DELETE a guaranteed no-op everywhere except the one
-- production database it was audited against. This is NOT changed to a
-- content edit of the executable statement below because that statement is
-- already applied to production; only this comment was added.

delete from public.org_members
where org_id = '00000000-0000-0000-0000-000000000001'
  and user_id = '9ea3d390-78ce-4e61-b159-8bf922c7d474';
