-- IPI-477 · PLAN-SEED-002 — Org bootstrap for default "5-Week Product Shoot"
-- Forward-only: extract idempotent seed into a reusable function, fire on
-- organizations INSERT, and backfill orgs created after the last seed pass.
-- Does not overwrite existing phases (on conflict do nothing). Does not
-- touch customized workflows that already have this default name.
-- EXECUTE: service_role only (SECURITY DEFINER must not be callable by arbitrary
-- authenticated clients for arbitrary org_ids). Trigger runs as definer.

-- ── ensure_default_5_week_workflow ─────────────────────────────────────────

create or replace function planner.ensure_default_5_week_workflow(p_org_id uuid)
returns uuid
language plpgsql
security definer
set search_path = planner, public
as $$
declare
  v_workflow_id uuid;
begin
  if p_org_id is null then
    raise exception 'org_id is required';
  end if;

  -- Serialize concurrent ensure for the same org (no unique on default name yet).
  perform pg_advisory_xact_lock(hashtext(p_org_id::text));

  select id into v_workflow_id
  from planner.workflows
  where org_id = p_org_id
    and name = '5-Week Product Shoot'
    and is_default = true
  limit 1;

  if v_workflow_id is null then
    insert into planner.workflows (org_id, name, category, version, is_default)
    values (p_org_id, '5-Week Product Shoot', 'production', 1, true)
    returning id into v_workflow_id;
  end if;

  insert into planner.phases (
    workflow_id, slug, name, order_index, default_duration_days, gate_type, required_role
  ) values
    (v_workflow_id, 'brief',          'Brief confirmation',      1,  2, null,       null),
    (v_workflow_id, 'casting',        'Casting',                 2,  3, 'approval', 'manager'),
    (v_workflow_id, 'soft-hold',      'Soft hold on shoot date', 3,  1, null,       null),
    (v_workflow_id, 'item-delivery',  'Item delivery',           4,  5, null,       null),
    (v_workflow_id, 'outfit-confirm', 'Outfit confirmation',     5,  2, 'approval', 'manager'),
    (v_workflow_id, 'payment-sched',  'Payment & scheduling',    6,  2, null,       null),
    (v_workflow_id, 'awaiting-shoot', 'Awaiting shoot',          7,  1, null,       null),
    (v_workflow_id, 'production',     'Production',              8,  3, null,       null),
    (v_workflow_id, 'retouching',     'Retouching',              9,  5, null,       null),
    (v_workflow_id, 'final-approval', 'Final approval',         10,  2, 'signoff',  'owner'),
    (v_workflow_id, 'product-return', 'Product return',         11,  3, null,       null)
  on conflict (workflow_id, slug) do nothing;

  return v_workflow_id;
end;
$$;

comment on function planner.ensure_default_5_week_workflow(uuid) is
  'Idempotent (advisory xact lock): ensure org has default 5-Week Product Shoot. service_role / trigger only.';

revoke all on function planner.ensure_default_5_week_workflow(uuid) from public, anon, authenticated;
grant execute on function planner.ensure_default_5_week_workflow(uuid) to service_role;

-- ── AFTER INSERT trigger on organizations ──────────────────────────────────

create or replace function public.trg_organizations_ensure_planner_default()
returns trigger
language plpgsql
security definer
set search_path = public, planner
as $$
begin
  perform planner.ensure_default_5_week_workflow(new.id);
  return new;
end;
$$;

drop trigger if exists organizations_ensure_planner_default on public.organizations;
create trigger organizations_ensure_planner_default
  after insert on public.organizations
  for each row
  execute function public.trg_organizations_ensure_planner_default();

-- ── Backfill existing orgs (idempotent, set-based) ─────────────────────────

do $$
begin
  perform planner.ensure_default_5_week_workflow(o.id)
  from public.organizations o;
end;
$$;
