-- IPI-1074 · PLANS-001 — Read-only Planner read contract for /app/plans
--
-- The `planner` schema is NOT exposed to the Data API (supabase/config.toml
-- schemas = ["public", "graphql_public"]). Per the issue's read-boundary
-- decision rule, we do NOT add `planner` to the exposed schemas; instead these
-- public SECURITY DEFINER read RPCs are the smallest server-side read boundary.
--
-- Each RPC replicates the org + role gates that RLS enforces on direct
-- planner.* SELECTs (public.is_org_member + planner.is_at_least(instance,
-- 'viewer')). They are read-only: no writes, no new schema/table, no duplicate
-- mutation RPCs. Existing planner_* mutation RPCs remain the only write path.
--
-- Rollback: drop function if exists public.planner_list_instances(uuid,text,text,text,boolean,int,uuid);
-- Rollback: drop function if exists public.planner_get_instance_detail(uuid);

-- ---------------------------------------------------------------------------
-- planner_list_instances — org-scoped Hub list with keyset cursor pagination.
-- ---------------------------------------------------------------------------
create or replace function public.planner_list_instances(
  p_org_id uuid,
  p_search text default null,
  p_entity_type text default null,
  p_status text default null,
  p_include_archived boolean default false,
  p_limit int default 20,
  p_cursor uuid default null
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_items jsonb;
  v_next_cursor uuid;
  v_has_more boolean := false;
begin
  if v_actor is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not public.is_org_member(p_org_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_entity_type is not null and p_entity_type not in ('shoot', 'campaign', 'crm_deal') then
    raise exception 'invalid_entity_type' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('draft', 'planned', 'active', 'blocked', 'completed', 'archived', 'cancelled') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_search is not null and length(p_search) > 100 then
    raise exception 'search_too_long' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(x.item), '[]'::jsonb)
  into v_items
  from (
    select
      jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'entityType', i.entity_type,
        'entityId', i.entity_id,
        'status', i.status::text,
        'plannedStart', i.planned_start,
        'plannedEnd', i.planned_end,
        'createdAt', i.created_at,
        'updatedAt', i.updated_at,
        'workflowName', w.name
      ) as item
    from planner.instances i
    join planner.workflows w on w.id = i.workflow_id
    where i.org_id = p_org_id
      and planner.is_at_least(i.id, 'viewer')
      and (p_include_archived or i.status <> 'archived')
      and (p_entity_type is null or i.entity_type = p_entity_type)
      and (p_status is null or i.status::text = p_status)
      and (p_search is null or p_search = '' or i.name ilike '%' || p_search || '%')
      and (p_cursor is null or (i.created_at, i.id) < (select created_at, id from planner.instances where id = p_cursor))
    order by i.created_at desc, i.id
    limit v_limit + 1
  ) x;

  if jsonb_array_length(v_items) > v_limit then
    v_has_more := true;
    v_next_cursor := (v_items -> (v_limit - 1) ->> 'id')::uuid;
    v_items := v_items - v_limit;
  end if;

  return json_build_object(
    'ok', true,
    'rows', v_items,
    'nextCursor', v_next_cursor,
    'hasMore', v_has_more
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- planner_get_instance_detail — one authorized plan DTO for the workspace.
-- Enumeration-safe: a foreign/non-visible instance raises P0002 (not_found).
-- ---------------------------------------------------------------------------
create or replace function public.planner_get_instance_detail(p_instance_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_instance json;
  v_workflow json;
  v_phases json;
  v_tasks json;
  v_dependencies json;
  v_assignments json;
  v_gate_approvals json;
  v_view_config json;
begin
  if v_actor is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not exists (
    select 1 from planner.instances i
    where i.id = p_instance_id
      and public.is_org_member(i.org_id)
      and planner.is_at_least(i.id, 'viewer')
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select json_build_object(
    'id', i.id,
    'orgId', i.org_id,
    'workflowId', i.workflow_id,
    'entityType', i.entity_type,
    'entityId', i.entity_id,
    'name', i.name,
    'status', i.status::text,
    'plannedStart', i.planned_start,
    'plannedEnd', i.planned_end,
    'ownerUserId', i.owner_user_id,
    'createdAt', i.created_at,
    'updatedAt', i.updated_at
  ) into v_instance
  from planner.instances i
  where i.id = p_instance_id;

  select json_build_object(
    'id', w.id,
    'name', w.name,
    'category', w.category,
    'version', w.version,
    'isDefault', w.is_default
  ) into v_workflow
  from planner.workflows w
  join planner.instances i on i.workflow_id = w.id
  where i.id = p_instance_id;

  select json_agg(json_build_object(
    'id', p.id,
    'workflowId', p.workflow_id,
    'slug', p.slug,
    'name', p.name,
    'orderIndex', p.order_index,
    'defaultDurationDays', p.default_duration_days,
    'gateType', p.gate_type,
    'requiredRole', p.required_role
  ) order by p.order_index) into v_phases
  from planner.phases p
  join planner.instances i on i.workflow_id = p.workflow_id
  where i.id = p_instance_id;

  select json_agg(json_build_object(
    'id', t.id,
    'instanceId', t.instance_id,
    'phaseId', t.phase_id,
    'parentTaskId', t.parent_task_id,
    'title', t.title,
    'description', t.description,
    'startDate', t.start_date,
    'endDate', t.end_date,
    'durationDays', t.duration_days,
    'status', t.status::text,
    'priority', t.priority,
    'assigneeUserId', t.assignee_user_id,
    'assigneeRole', t.assignee_role,
    'sortOrder', t.sort_order
  ) order by t.sort_order, t.created_at) into v_tasks
  from planner.tasks t
  where t.instance_id = p_instance_id;

  select json_agg(json_build_object(
    'id', d.id,
    'instanceId', d.instance_id,
    'fromTaskId', d.from_task_id,
    'toTaskId', d.to_task_id,
    'depType', d.dep_type::text,
    'lagDays', d.lag_days
  )) into v_dependencies
  from planner.dependencies d
  where d.instance_id = p_instance_id;

  select json_agg(json_build_object(
    'id', a.id,
    'instanceId', a.instance_id,
    'userId', a.user_id,
    'role', a.role,
    'permissions', a.permissions
  )) into v_assignments
  from planner.assignments a
  where a.instance_id = p_instance_id;

  select json_agg(json_build_object(
    'id', g.id,
    'instanceId', g.instance_id,
    'phaseId', g.phase_id,
    'status', g.status,
    'approvedBy', g.approved_by,
    'approvedAt', g.approved_at
  )) into v_gate_approvals
  from planner.gate_approvals g
  where g.instance_id = p_instance_id;

  select json_build_object(
    'id', vc.id,
    'instanceId', vc.instance_id,
    'defaultView', vc.default_view,
    'filters', vc.filters,
    'sortConfig', vc.sort_config
  ) into v_view_config
  from planner.view_configs vc
  where vc.instance_id = p_instance_id
    and vc.user_id = v_actor;

  return json_build_object(
    'ok', true,
    'instance', v_instance,
    'workflow', v_workflow,
    'phases', coalesce(v_phases, '[]'::json),
    'tasks', coalesce(v_tasks, '[]'::json),
    'dependencies', coalesce(v_dependencies, '[]'::json),
    'assignments', coalesce(v_assignments, '[]'::json),
    'gateApprovals', coalesce(v_gate_approvals, '[]'::json),
    'viewConfig', v_view_config
  );
end;
$$;

-- Grant EXECUTE to authenticated (matching the existing planner helper grants).
grant execute on function public.planner_list_instances(uuid,text,text,text,boolean,int,uuid) to authenticated;
grant execute on function public.planner_get_instance_detail(uuid) to authenticated;