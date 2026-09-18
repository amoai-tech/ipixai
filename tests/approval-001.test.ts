import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const MIGRATION_PATH = "../supabase/migrations/20260918000000_ipi1084_shoot_plan_approval.sql";
const SERVICE_READ_MIGRATION_PATH =
  "../supabase/migrations/20260918000001_ipi1084_plan_approval_service_read.sql";
const DECIDE_ACL_MIGRATION_PATH =
  "../supabase/migrations/20260918000002_ipi1084_decide_revoke_service_role.sql";

async function migration(): Promise<string> {
  return readFile(new URL(MIGRATION_PATH, import.meta.url), "utf8");
}

async function serviceReadMigration(): Promise<string> {
  return readFile(new URL(SERVICE_READ_MIGRATION_PATH, import.meta.url), "utf8");
}

async function decideAclMigration(): Promise<string> {
  return readFile(new URL(DECIDE_ACL_MIGRATION_PATH, import.meta.url), "utf8");
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
    expect(definerCount.length).toBe(4);
    expect(searchPathCount.length).toBe(4);
  });

  it("performs ZERO Shoot application writes and reuses no foreign approval table", async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/insert into shoot\.shoots/i);
    expect(sql).not.toMatch(/insert into shoot\.shoot_deliverables/i);
    // shoot.shot_list is the real table (verified against pg_tables on a fresh
    // replay); guard the near-miss spelling too so a typo cannot slip through.
    expect(sql).not.toMatch(/insert into shoot\.shot_list/i);
    expect(sql).not.toMatch(/insert into shoot\.shoot_list/i);
    expect(sql).not.toMatch(/commit_shoot_draft/);
    expect(sql).not.toMatch(/(from|into|references|update|join)\s+planner\.gate_approvals/i);
    expect(sql).not.toMatch(/(from|into|references|update|join)\s+brand_profile_approvals/i);
    expect(sql).not.toMatch(/(from|into|references|update|join)\s+planner\.events/i);
  });

  it("requires owner/editor authority to decide, not a viewer membership", async () => {
    const sql = await migration();
    expect(sql).toContain("public.is_org_editor_or_above(b.org_id)");
    // The read path stays member-level; only the decision is elevated.
    expect(sql).toContain("public.is_org_member(b.org_id)");
    const decideBody = sql.slice(
      sql.indexOf("create or replace function public.decide_shoot_plan_revision"),
      sql.indexOf("comment on function public.decide_shoot_plan_revision"),
    );
    expect(decideBody).toContain("public.is_org_editor_or_above(b.org_id)");
    expect(decideBody).not.toContain("public.is_org_member(b.org_id)");
  });

  it("blocks a superseded revision and reports whether a revision is current", async () => {
    const sql = await migration();
    expect(sql).toContain("'SUPERSEDED_REVISION'");
    expect(sql).toContain("newer.revision > v_row.revision");
    expect(sql).toContain("'isCurrent'");
  });

  it("scopes idempotent replay to the deciding operator", async () => {
    const sql = await migration();
    expect(sql).toContain("v_row.decided_by = v_actor and v_row.request_hash = v_request_hash");
  });

  it("fails staged_by typed instead of raising a raw foreign-key error", async () => {
    const sql = await migration();
    expect(sql).toContain("'staged_by is not a known user'");
    expect(sql).toContain("when foreign_key_violation then");
    expect(sql).toContain("from auth.users u where u.id = p_staged_by");
  });

  it("makes the staged revision identity immutable and stops direct client writes", async () => {
    const sql = await migration();
    expect(sql).toContain("shoot.shoot_plan_approvals_lock_identity");
    expect(sql).toContain("revision identity is immutable");
    expect(sql).toContain("trg_shoot_plan_approvals_lock_identity");
    expect(sql).toContain("revoke insert, update, delete on table shoot.shoot_plan_approvals from service_role");
  });

  it("documents the REVISION_CONFLICT retry contract", async () => {
    const sql = await migration();
    expect(sql).toContain("caller retries once");
  });

  it("serialises staging and deciding per planner run and asserts pgcrypto", async () => {
    const sql = await migration();
    const stageBody = sql.slice(
      sql.indexOf("create or replace function public.stage_shoot_plan_revision"),
      sql.indexOf("create or replace function public.decide_shoot_plan_revision"),
    );
    const decideBody = sql.slice(
      sql.indexOf("create or replace function public.decide_shoot_plan_revision"),
      sql.indexOf("comment on function public.decide_shoot_plan_revision"),
    );
    expect(stageBody).toContain("pg_advisory_xact_lock");
    expect(decideBody).toContain("pg_advisory_xact_lock");
    // The decision must take the shared key before it checks for a newer revision,
    // otherwise a concurrent stage could slip in between the check and the write.
    expect(decideBody.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      decideBody.indexOf("SUPERSEDED_REVISION"),
    );
    expect(sql).toContain("create extension if not exists pgcrypto with schema extensions");
  });

  it("grants the workflow a bounded service-side proof read without widening the decision", async () => {
    const sql = await serviceReadMigration();
    // The org-scoped read fails closed with UNAUTHENTICATED for a session-less
    // service-role caller, so granting it EXECUTE was ineffective and is undone.
    expect(sql).toContain("revoke all on function public.get_shoot_plan_approval(uuid) from service_role;");
    expect(sql).not.toContain(
      "grant execute on function public.get_shoot_plan_approval(uuid) to service_role;",
    );

    // A dedicated, bounded proof read is what the workflow actually calls.
    expect(sql).toContain("create or replace function public.get_shoot_plan_approval_proof(");
    expect(sql).toContain(
      "revoke all on function public.get_shoot_plan_approval_proof(uuid) from authenticated;",
    );
    expect(sql).toContain(
      "grant execute on function public.get_shoot_plan_approval_proof(uuid) to service_role;",
    );

    const proofBody = sql.slice(
      sql.indexOf("create or replace function public.get_shoot_plan_approval_proof("),
      sql.indexOf("comment on function public.get_shoot_plan_approval_proof"),
    );
    // It must not gate on a session it does not have.
    expect(proofBody).not.toContain("auth.uid()");
    expect(proofBody).not.toContain("UNAUTHENTICATED");
    // It returns the proof fields and never the plan body or a user id.
    for (const field of [
      "'approvalId', v_row.id",
      "'brandId', v_row.brand_id",
      "'workflowRunId', v_row.workflow_run_id",
      "'revision', v_row.revision",
      "'planHash', v_row.plan_hash",
      "'status', v_row.status",
      "'decision', v_row.status",
      "'hashMatches'",
      "'isCurrent'",
    ]) {
      expect(proofBody).toContain(field);
    }
    expect(proofBody).not.toContain("'plan', v_row.plan");
    expect(proofBody).not.toContain("decided_by");
    expect(proofBody).not.toContain("decision_note");

    // SECURITY DEFINER + a pinned empty search_path are load-bearing.
    expect(proofBody).toContain("security definer");
    expect(proofBody).toContain("set search_path = ''");

    // The read migration must not touch the decision function's ACL.
    expect(sql).not.toContain("decide_shoot_plan_revision");
  });

  it("revokes the human decision from service_role so no service caller can approve", async () => {
    const sql = await decideAclMigration();
    expect(sql).toContain(
      "revoke all on function public.decide_shoot_plan_revision(uuid, integer, text, text, text, text) from service_role;",
    );
    // Forward-only narrowing: it must not re-grant anything.
    expect(sql).not.toMatch(/grant execute/i);
    expect(sql).not.toMatch(/insert into|update |delete from/i);
  });
});
