-- IPI-647 · PLN-SEC-002 (follow-on) — Bootstrap owner assignment BEFORE INSERT
--
-- Why:
--   Assignment-aware SELECT + PostgREST INSERT...RETURNING requires the owner
--   assignment row to be visible when SELECT RLS runs. AFTER INSERT bootstrap
--   writes the assignment first; the instance FK must be DEFERRABLE so that
--   insert is allowed before the instances row exists.
--
--   AFTER INSERT + VOLATILE helper was not sufficient here for RETURNING.
--
-- Pair with:
--   20260720032307_planner_select_assigned.sql
--   20260720032604_planner_is_at_least_volatile.sql

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'assignments_instance_id_fkey'
      and conrelid = 'planner.assignments'::regclass
      and not condeferrable
  ) then
    alter table planner.assignments drop constraint assignments_instance_id_fkey;
    alter table planner.assignments
      add constraint assignments_instance_id_fkey
      foreign key (instance_id) references planner.instances(id)
      on delete cascade
      deferrable initially deferred;
  end if;
end $$;

create or replace function planner.bootstrap_owner_assignment()
returns trigger
language plpgsql
security definer
set search_path = planner, public
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  insert into planner.assignments (instance_id, user_id, role)
  values (new.id, (select auth.uid()), 'owner')
  on conflict (instance_id, user_id) do nothing;
  return new;
end;
$$;

comment on function planner.bootstrap_owner_assignment is
  'Auto-create owner assignment when a user creates a planner instance. BEFORE INSERT + deferred FK so INSERT...RETURNING satisfies assignment-aware SELECT RLS (IPI-647). Skips when auth.uid() is null.';

drop trigger if exists instances_bootstrap_owner on planner.instances;
create trigger instances_bootstrap_owner
  before insert on planner.instances
  for each row execute function planner.bootstrap_owner_assignment();
