-- IPI-1084 · APPROVAL-001 — Human plan decisions must not be callable by service_role.
--
-- The increment-1 migration (20260918000000_ipi1084_shoot_plan_approval.sql) revoked
-- EXECUTE on public.decide_shoot_plan_revision from public and anon and granted it to
-- authenticated, but it did not revoke the Supabase default function ACL from
-- service_role. Verified on a fresh local replay:
--
--   decide_shoot_plan_revision | postgres=X/postgres | service_role=X/postgres | authenticated=X/postgres
--
-- That contradicts the repo's own human-approval rule (see
-- 20260909000000_ipi1093_brand_intel_approve_contract.sql and
-- 20260915000000_ipi1119_media_approval.sql: "Human approval must not be callable by
-- anon or service_role. The service_role default function ACL must be revoked
-- explicitly"). A service-role caller could otherwise record an operator decision
-- without an operator session, which is exactly the authority APPROVAL-001 exists to
-- prevent.
--
-- This migration is additive and forward-only: it only narrows the ACL. The workflow's
-- durable re-read (public.get_shoot_plan_approval) intentionally keeps service_role
-- EXECUTE — see 20260918000001_ipi1084_plan_approval_service_read.sql.

revoke all on function public.decide_shoot_plan_revision(uuid, integer, text, text, text, text) from service_role;

comment on function public.decide_shoot_plan_revision(uuid, integer, text, text, text, text) is
  'Records one operator decision on an exact ShootPlan revision. Authenticated only: EXECUTE is granted to authenticated and explicitly revoked from public, anon and service_role so a service-role caller can never record a human approval.';
