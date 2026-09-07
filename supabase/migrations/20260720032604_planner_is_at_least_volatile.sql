-- IPI-647 · PLN-SEC-002 (follow-on) — Make planner.is_at_least VOLATILE
--
-- Why:
--   Assignment-aware SELECT policies call planner.is_at_least(...).
--   planner.bootstrap_owner_assignment() inserts the owner row in an AFTER INSERT
--   trigger on planner.instances. PostgREST uses INSERT ... RETURNING, which
--   evaluates SELECT RLS in the same command.
--
--   STABLE/IMMUTABLE functions (and inline EXISTS) use the statement snapshot and
--   cannot see rows written by that same command's triggers. That surfaces as:
--     42501 new row violates row-level security policy for table "instances"
--   on insert().select() even though the bootstrap assignment is written.
--
--   VOLATILE lets the helper see the trigger side-effect so creators can RETURNING
--   their new instance. See PostgreSQL CREATE POLICY / function volatility notes
--   and supabase/supabase#7289.
--
-- Scope: volatility only — same SECURITY DEFINER body, search_path, and grants.

create or replace function planner.is_at_least(
  p_instance_id uuid,
  p_min_role text
)
returns boolean
language sql
security definer
set search_path = planner, public
volatile
as $$
  select exists (
    select 1 from planner.assignments
    where instance_id = p_instance_id
      and user_id = (select auth.uid())
      and case p_min_role
        when 'viewer'      then true
        when 'contributor' then role in ('contributor', 'manager', 'owner')
        when 'manager'     then role in ('manager', 'owner')
        when 'owner'       then role = 'owner'
        else false
      end
  );
$$;

comment on function planner.is_at_least is
  'Returns true when the current user holds at least p_min_role on the planner instance. Hierarchy: viewer < contributor < manager < owner. VOLATILE so INSERT...RETURNING can see bootstrap_owner_assignment side-effects (IPI-647).';

-- Re-assert EXECUTE grants (CREATE OR REPLACE preserves ACLs on PG15+, but be explicit).
revoke all on function planner.is_at_least(uuid, text) from public, anon;
grant execute on function planner.is_at_least(uuid, text) to authenticated, service_role;
