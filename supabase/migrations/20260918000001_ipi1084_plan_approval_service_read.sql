-- IPI-1084 · APPROVAL-001 — allow the review workflow to re-read durable approval state.
--
-- The `awaitDecision` step runs inside the Mastra workflow with service-side
-- authority, so it cannot call the operator-scoped read path (which requires an
-- authenticated session). The step must still re-read the durable approval row
-- before advancing, so that a stale, superseded or never-recorded decision
-- fails closed instead of un-parking the run.
--
-- This adds no table, no column and no schema change: it grants EXECUTE on the
-- existing org-scoped, hash-recomputing `public.get_shoot_plan_approval(uuid)`
-- to `service_role` only. The operator path (authenticated) is unchanged, and
-- the underlying `shoot.shoot_plan_approvals` table remains SELECT-only for
-- service_role with all direct DML revoked.

revoke all on function public.get_shoot_plan_approval(uuid) from public;
revoke all on function public.get_shoot_plan_approval(uuid) from anon;
grant execute on function public.get_shoot_plan_approval(uuid) to service_role;

comment on function public.get_shoot_plan_approval(uuid) is
  'IPI-1084 · APPROVAL-001 — org-scoped read of one staged ShootPlan revision with a recomputed hashMatches proof and an isCurrent flag. Executable by authenticated (operator review) and service_role (workflow durable re-read); never by anon.';
