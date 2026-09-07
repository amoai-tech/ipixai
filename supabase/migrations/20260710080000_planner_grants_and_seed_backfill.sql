-- IPI-476 · PLAN-GRANT-001 + PLAN-SEED-001
-- Forward-only: grant planner schema/table privileges (talent-schema pattern)
-- and backfill missing "5-Week Product Shoot" templates for orgs created after
-- the original seed. No anon grants. Does not weaken RLS.
--
-- Future orgs: no auto-trigger in v1 — bootstrap path is this idempotent seed
-- block (re-run / call from org-create hook in IPI-477). Documented in
-- supabase/docs/ipi-476-planner-fix-report.md.

-- ── Grants (mirror talent schema 20260701125300) ───────────────────────────

grant usage on schema planner to authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema planner
  to authenticated;

grant all
  on all tables in schema planner
  to service_role;

grant usage, select
  on all sequences in schema planner
  to authenticated;

grant all
  on all sequences in schema planner
  to service_role;

grant execute
  on all functions in schema planner
  to authenticated, service_role;

alter default privileges in schema planner
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema planner
  grant all on tables to service_role;

alter default privileges in schema planner
  grant usage, select on sequences to authenticated;

alter default privileges in schema planner
  grant all on sequences to service_role;

alter default privileges in schema planner
  grant execute on functions to authenticated, service_role;

-- ── Seed backfill (idempotent) ─────────────────────────────────────────────

do $$
declare
  v_org record;
  v_workflow_id uuid;
begin
  for v_org in select id from public.organizations loop
    select id into v_workflow_id
    from planner.workflows
    where org_id = v_org.id
      and name = '5-Week Product Shoot'
      and is_default = true
    limit 1;

    if v_workflow_id is null then
      insert into planner.workflows (org_id, name, category, version, is_default)
      values (v_org.id, '5-Week Product Shoot', 'production', 1, true)
      returning id into v_workflow_id;
    end if;

    insert into planner.phases (workflow_id, slug, name, order_index, default_duration_days, gate_type, required_role) values
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
  end loop;
end;
$$;
