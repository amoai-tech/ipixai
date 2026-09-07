-- IPI-544 · Planner Security Hardening (incl. RLS anon-EXECUTE cleanup)
--
-- Purpose: remove the default PUBLIC execute grant from every Planner
-- SECURITY DEFINER helper that was exposed to unauthenticated callers, then
-- explicitly restore only the roles required by RLS or Realtime policies.
--
-- Trigger functions remain executable only by service_role. PostgreSQL invokes
-- an already-installed trigger through the trigger manager; clients do not
-- need direct execute permission on the trigger function.

-- Trigger-only helpers: no direct client execution.
revoke all on function planner.bootstrap_owner_assignment() from public, anon, authenticated;
revoke all on function planner.broadcast_instance_change() from public, anon, authenticated;
revoke all on function planner.prevent_task_instance_change() from public, anon, authenticated;
revoke all on function planner.validate_dependency_instance() from public, anon, authenticated;
revoke all on function public.trg_organizations_ensure_planner_default() from public, anon, authenticated;

grant execute on function planner.bootstrap_owner_assignment() to service_role;
grant execute on function planner.broadcast_instance_change() to service_role;
grant execute on function planner.prevent_task_instance_change() to service_role;
grant execute on function planner.validate_dependency_instance() to service_role;
grant execute on function public.trg_organizations_ensure_planner_default() to service_role;

-- RLS and Realtime authorization helpers: signed-in users and service_role.
revoke all on function planner.can_broadcast_instance(text) from public, anon, authenticated;
revoke all on function planner.can_subscribe_instance(text) from public, anon, authenticated;
revoke all on function planner.is_assigned(uuid, text[]) from public, anon, authenticated;
revoke all on function planner.is_at_least(uuid, text) from public, anon, authenticated;

grant execute on function planner.can_broadcast_instance(text) to authenticated, service_role;
grant execute on function planner.can_subscribe_instance(text) to authenticated, service_role;
grant execute on function planner.is_assigned(uuid, text[]) to authenticated, service_role;
grant execute on function planner.is_at_least(uuid, text) to authenticated, service_role;
