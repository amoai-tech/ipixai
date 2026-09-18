import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const MIGRATION_PATH = "../supabase/migrations/20260918000000_ipi1084_shoot_plan_approval.sql";

async function migration(): Promise<string> {
  return readFile(new URL(MIGRATION_PATH, import.meta.url), "utf8");
}

describe("IPI-1084 · APPROVAL-001 — exact-revision approval record", () => {
  it("stores one immutable revision per planner run with the full decision vocabulary", async () => {
    const sql = await migration();
    expect(sql).toContain("create table if not exists shoot.shoot_plan_approvals");
    expect(sql).toContain("status in ('pending', 'approved', 'rejected', 'changes_requested', 'cancelled')");
    expect(sql).toContain("unique (workflow_run_id, revision)");
    expect(sql).toContain("plan jsonb not null");
    expect(sql).toContain("plan_hash text not null check (plan_hash <> '')");
    expect(sql).toContain("revision integer not null check (revision > 0)");
  });

  it("derives the revision identity from the database, never from the caller", async () => {
    const sql = await migration();
    expect(sql).toContain("v_plan_hash := encode(extensions.digest(p_plan::text, 'sha256'), 'hex');");
    expect(sql).toContain("v_recomputed := encode(extensions.digest(v_row.plan::text, 'sha256'), 'hex');");
    expect(sql).toContain("'decidedBy', v_actor");
  });

  it("binds a decision to the exact reviewed revision and fails closed otherwise", async () => {
    const sql = await migration();
    expect(sql).toContain("'STALE_REVISION'");
    expect(sql).toContain("'ALREADY_DECIDED'");
    expect(sql).toContain("'EXPIRED'");
    expect(sql).toContain("'FORBIDDEN'");
    expect(sql).toContain("'UNAUTHENTICATED'");
    expect(sql).toContain("'IDEMPOTENCY_CONFLICT'");
    expect(sql).toContain("'REVISION_CONFLICT'");
    expect(sql).toContain("if v_row.revision <> p_revision or v_row.plan_hash <> p_plan_hash then");
    expect(sql).toContain("if v_row.status <> 'pending' then");
  });

  it("locks the revision row before the idempotency lookup and replays exact results", async () => {
    const sql = await migration();
    const lockIndex = sql.indexOf("where a.id = p_approval_id\n   for update;");
    const replayIndex = sql.indexOf("v_row.idempotency_key = p_idempotency_key");
    expect(lockIndex).toBeGreaterThan(-1);
    expect(replayIndex).toBeGreaterThan(lockIndex);
    expect(sql).toContain("jsonb_set(coalesce(v_row.result_payload, '{}'::jsonb), '{replayed}', 'true'::jsonb)");
  });

  it("keeps reads org-scoped and writes server-owned", async () => {
    const sql = await migration();
    expect(sql).toContain("alter table shoot.shoot_plan_approvals enable row level security");
    expect(sql).toContain("using (\n    brand_id in (\n      select id from public.brands where public.is_org_member(org_id)");
    expect(sql).toContain("grant select on table shoot.shoot_plan_approvals to authenticated");
    expect(sql).toContain("revoke insert, update, delete on table shoot.shoot_plan_approvals from authenticated");
    expect(sql).toContain("revoke all on table shoot.shoot_plan_approvals from anon");
  });

  it("grants staging to service_role only and deciding to authenticated", async () => {
    const sql = await migration();
    expect(sql).toContain(
      "revoke all on function public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz) from authenticated;",
    );
    expect(sql).toContain(
      "grant execute on function public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz) to service_role;",
    );
    expect(sql).toContain(
      "grant execute on function public.decide_shoot_plan_revision(uuid, integer, text, text, text, text) to authenticated;",
    );
    expect(sql).toContain(
      "revoke all on function public.decide_shoot_plan_revision(uuid, integer, text, text, text, text) from anon;",
    );
    expect(sql).toContain("revoke all on function public.get_shoot_plan_approval(uuid) from anon;");
  });

  it("is safe by construction: definer functions pin an empty search_path", async () => {
    const sql = await migration();
    const definerCount = sql.match(/security definer/g) ?? [];
    const searchPathCount = sql.match(/set search_path = ''/g) ?? [];
    expect(definerCount.length).toBe(3);
    expect(searchPathCount.length).toBe(3);
  });

  it("performs ZERO Shoot application writes and reuses no foreign approval table", async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/insert into shoot\.shoots/i);
    expect(sql).not.toMatch(/insert into shoot\.shoot_deliverables/i);
    expect(sql).not.toMatch(/insert into shoot\.shot_list/i);
    expect(sql).not.toMatch(/commit_shoot_draft/);
    expect(sql).not.toMatch(/(from|into|references|update|join)\s+planner\.gate_approvals/i);
    expect(sql).not.toMatch(/(from|into|references|update|join)\s+brand_profile_approvals/i);
    expect(sql).not.toMatch(/(from|into|references|update|join)\s+planner\.events/i);
  });
});
