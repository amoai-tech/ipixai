-- IPI-575 · PLN-DATA-001C — SEC-003 was only enforced inside
-- public.planner_invite_member, not at the RLS layer it bypasses via
-- SECURITY DEFINER. A manager-level caller still had a second, unguarded
-- path to the same privilege: insert directly into planner.assignments
-- with their own RLS-scoped session (bypassing the RPC entirely) and
-- role='manager' — assignments_insert_manager's own with_check allowed
-- any manager+ caller to insert role IN ('manager','contributor','viewer'),
-- with no owner gate on the 'manager' value. Found in PR #387 review
-- (chatgpt-codex-connector): "Tighten the assignments insert RLS path too".
--
-- Fix: role = 'manager' now additionally requires the caller to be owner
-- on the target instance, matching planner_invite_member's own SEC-003
-- check exactly — the RPC and the RLS policy now enforce the identical
-- invariant, so there is no direct-insert bypass.

drop policy if exists "assignments_insert_manager" on planner.assignments;

create policy "assignments_insert_manager"
  on planner.assignments for insert to authenticated
  with check (
    exists (
      select 1
      from planner.instances i
      join public.org_members om on om.org_id = i.org_id and om.user_id = assignments.user_id
      where i.id = instance_id
        and planner.is_at_least(i.id, 'manager')
    )
    and role in ('manager', 'contributor', 'viewer')
    and (
      role <> 'manager'
      or exists (
        select 1 from planner.instances i
        where i.id = instance_id and planner.is_at_least(i.id, 'owner')
      )
    )
  );
;
