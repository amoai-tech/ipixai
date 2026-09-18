import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import { signInWithCredentials } from "./support/login";
import { supabaseForPage } from "./support/tenant-supabase";
import {
  EDITED_REVIEW_PLAN,
  LOCAL_E2E_PASSWORD,
  ORG_A_EDITOR,
  ORG_A_VIEWER,
  ORG_B_OWNER,
  REVIEW_PLAN,
} from "./support/approval-001-fixtures";

/**
 * IPI-1084 · APPROVAL-001 — PR 2b: real authenticated browser proof for tenant
 * isolation, edit invalidation, reload/retry safety and resume recovery.
 *
 * Runs against a LOCAL `supabase start` stack plus a local Next server, driven
 * by `scripts/run-approval-001-e2e.mjs`. Every actor signs in through the real
 * /login UI, so the browser holds a real Supabase session and every request
 * below goes through the real authenticated route handlers, RLS, and the real
 * SECURITY DEFINER RPCs — nothing is mocked.
 *
 * Why local and not the hosted QA project: that project has exactly two
 * isolated *owner* accounts with zero brands and no viewer membership, so it
 * cannot express "Org A editor allowed / Org A viewer denied / Org B denied".
 * Adding a viewer there would mean writing users into a hosted project, which
 * this task forbids. The runner refuses any non-loopback database.
 *
 * No Shoot is persisted anywhere: shoot.shoots / shoot.shot_list /
 * shoot.shoot_deliverables are counted before and after the whole file.
 */

const BASE_URL = process.env.IPI1084_BASE_URL ?? "http://localhost:3016";
const DB_URL = process.env.IPI1084_LOCAL_DB_URL;

function dbUrl(): string {
  if (!DB_URL) {
    throw new Error(
      "IPI1084_LOCAL_DB_URL is missing — run this spec through `npm run e2e:approval` " +
        "(scripts/run-approval-001-e2e.mjs), which provisions the local stack.",
    );
  }
  if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)[:/]/.test(DB_URL)) {
    throw new Error("IPI1084_LOCAL_DB_URL must point at a loopback database — refusing to run");
  }
  return DB_URL;
}

/** One short-lived connection per query keeps ordering obvious and leaks nothing. */
async function withDb<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: dbUrl() });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

type ApprovalRow = {
  id: string;
  workflow_run_id: string;
  revision: number;
  plan_hash: string;
  status: string;
  decided_by: string | null;
  decided_at: Date | null;
};

async function approvalRow(approvalId: string): Promise<ApprovalRow | null> {
  return withDb(async (client) => {
    const { rows } = await client.query<ApprovalRow>(
      `select id, workflow_run_id, revision, plan_hash, status, decided_by, decided_at
         from shoot.shoot_plan_approvals where id = $1`,
      [approvalId],
    );
    return rows[0] ?? null;
  });
}

/**
 * A content-and-identity fingerprint of every Shoot application table.
 *
 * A row count alone would miss an update, or a delete+reinsert that preserves
 * the total. This folds each table's row count together with an ordered digest
 * of every row's full contents, so any insert, delete, update or identity swap
 * changes the fingerprint.
 */
async function shootApplicationFingerprint(): Promise<string> {
  return withDb(async (client) => {
    const { rows } = await client.query<{ fingerprint: string }>(
      `select
         (select count(*) from shoot.shoots)::text
         || '|' || coalesce((select md5(string_agg(md5(s::text), '|' order by s.id::text)) from shoot.shoots s), '-')
         || '|' || (select count(*) from shoot.shot_list)::text
         || '|' || coalesce((select md5(string_agg(md5(l::text), '|' order by l.id::text)) from shoot.shot_list l), '-')
         || '|' || (select count(*) from shoot.shoot_deliverables)::text
         || '|' || coalesce((select md5(string_agg(md5(d::text), '|' order by d.id::text)) from shoot.shoot_deliverables d), '-')
         as fingerprint`,
    );
    return rows[0].fingerprint;
  });
}

/**
 * The real service-role Supabase client — the same privilege boundary the
 * workflow's staging step uses. Staging through `pg` as the connection
 * superuser would bypass the service_role EXECUTE grant entirely and prove
 * nothing about the production path.
 */
function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.IPI1084_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / IPI1084_SERVICE_ROLE_KEY are missing — run this spec through " +
        "`npm run e2e:approval` (scripts/run-approval-001-e2e.mjs).",
    );
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)) {
    throw new Error("refusing to use a service-role key against a non-local Supabase URL");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Stages a revision through the real service-role RPC (used to simulate run loss). */
async function stageViaRpc(
  workflowRunId: string,
): Promise<{ approvalId: string; revision: number; planHash: string }> {
  const { data, error } = await serviceRoleClient().rpc("stage_shoot_plan_revision", {
    p_brand_id: ORG_A_EDITOR.brandId,
    p_workflow_run_id: workflowRunId,
    p_plan: REVIEW_PLAN,
    p_staged_by: ORG_A_EDITOR.userId,
    p_agent_thread_id: null,
    p_expires_at: null,
  });
  expect(error, `service-role staging failed: ${error?.message ?? "unknown"}`).toBeNull();
  const staged = data as Record<string, unknown>;
  expect(staged.ok, `staging failed: ${JSON.stringify(staged)}`).toBe(true);
  return {
    approvalId: String(staged.approvalId),
    revision: Number(staged.revision),
    planHash: String(staged.planHash),
  };
}

type Actor = { context: BrowserContext; page: Page };

async function signInActor(browser: Browser, email: string): Promise<Actor> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await signInWithCredentials(page, email, LOCAL_E2E_PASSWORD);
  return { context, page };
}

type Json = Record<string, unknown>;

async function postJson(
  actor: Actor,
  path: string,
  data: unknown,
): Promise<{ status: number; body: Json }> {
  const response = await actor.context.request.post(path, { data });
  const text = await response.text();
  let body: Json = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) body = parsed as Json;
  } catch {
    body = { raw: text };
  }
  return { status: response.status(), body };
}

async function startReview(actor: Actor, brandId: string, plan: unknown) {
  return postJson(actor, "/api/plans/reviews", { brandId, plan });
}

async function decide(
  actor: Actor,
  approvalId: string,
  revision: number,
  planHash: string,
  decision: string,
) {
  return postJson(actor, `/api/plans/approvals/${approvalId}/decision`, {
    revision,
    planHash,
    decision,
  });
}

async function stageRevision(actor: Actor, approvalId: string, plan: unknown) {
  return postJson(actor, `/api/plans/approvals/${approvalId}/revision`, { plan });
}

/** Reads durable approval state with the operator's own session (RLS-enforced). */
async function readSnapshot(page: Page, approvalId: string) {
  const supabase = await supabaseForPage(page);
  const { data, error } = await supabase.rpc("get_shoot_plan_approval", {
    p_approval_id: approvalId,
  });
  expect(error, `approval read failed: ${error?.message ?? "unknown"}`).toBeNull();
  return data as Record<string, unknown>;
}

test.setTimeout(120_000);
test.describe.configure({ mode: "serial" });

let editor: Actor;
let viewer: Actor;
let orgB: Actor;
let shootFingerprintBefore = "";

test.beforeAll(async ({ browser }) => {
  shootFingerprintBefore = await shootApplicationFingerprint();
  editor = await signInActor(browser, ORG_A_EDITOR.email);
  viewer = await signInActor(browser, ORG_A_VIEWER.email);
  orgB = await signInActor(browser, ORG_B_OWNER.email);
});

test.afterAll(async () => {
  await Promise.all([editor?.context.close(), viewer?.context.close(), orgB?.context.close()]);
});

test("Org A editor starts a review on the exact revision and approves it", async () => {
  const started = await startReview(editor, ORG_A_EDITOR.brandId, REVIEW_PLAN);
  expect(started.status, JSON.stringify(started.body)).toBe(201);
  const { approvalId, revision, planHash, runId } = started.body as {
    approvalId: string;
    revision: number;
    planHash: string;
    runId: string;
  };
  // A real Mastra run was created asynchronously and reached the suspended state.
  expect(typeof runId).toBe("string");
  expect(runId.length).toBeGreaterThan(0);
  expect(revision).toBeGreaterThan(0);

  // The operator surface can load the trusted reference catalog (Keep/Replace data).
  const references = await editor.context.request.get("/api/plans/references");
  expect(references.status()).toBe(200);
  const catalog = (await references.json()) as { references?: unknown[] };
  expect(Array.isArray(catalog.references)).toBe(true);
  expect(catalog.references!.length).toBeGreaterThan(0);

  const staged = await approvalRow(approvalId);
  expect(staged, "the staged revision must be durable").not.toBeNull();
  expect(staged!.status).toBe("pending");
  expect(staged!.revision).toBe(revision);
  expect(staged!.plan_hash).toBe(planHash);

  // The scheduler-side durable proof read the workflow uses must be reachable.
  const proof = await withDb(async (client) => {
    const { rows } = await client.query<{ proof: Record<string, unknown> }>(
      `select public.get_shoot_plan_approval_proof($1) as proof`,
      [approvalId],
    );
    return rows[0].proof;
  });
  expect(proof.ok).toBe(true);
  expect(proof.hashMatches).toBe(true);
  expect(proof.isCurrent).toBe(true);

  const decided = await decide(editor, approvalId, revision, planHash, "approved");
  expect(decided.status, JSON.stringify(decided.body)).toBe(200);
  expect(decided.body.ok).toBe(true);
  // The parked workflow run really resumes off the durable decision.
  expect(decided.body.resumeState).toBe("resumed");

  const after = await approvalRow(approvalId);
  expect(after!.status).toBe("approved");
  expect(after!.decided_by).toBe(ORG_A_EDITOR.userId);
});

test("Org A viewer can read allowed data but cannot decide", async () => {
  const started = await startReview(editor, ORG_A_EDITOR.brandId, REVIEW_PLAN);
  expect(started.status).toBe(201);
  const { approvalId, revision, planHash } = started.body as {
    approvalId: string;
    revision: number;
    planHash: string;
  };

  // A viewer is a member of the org, so the shared catalog and the approval
  // record itself are readable — this is "can view allowed data".
  const references = await viewer.context.request.get("/api/plans/references");
  expect(references.status()).toBe(200);
  const snapshot = await readSnapshot(viewer.page, approvalId);
  expect(snapshot.ok).toBe(true);
  expect(snapshot.status).toBe("pending");

  // Starting a review is an editor/owner action: a viewer is forbidden.
  const start = await startReview(viewer, ORG_A_EDITOR.brandId, REVIEW_PLAN);
  expect(start.status, JSON.stringify(start.body)).toBe(403);

  // Deciding is likewise forbidden, and must record nothing.
  const denied = await decide(viewer, approvalId, revision, planHash, "approved");
  expect(denied.status, JSON.stringify(denied.body)).toBe(403);

  const after = await approvalRow(approvalId);
  expect(after!.status).toBe("pending");
  expect(after!.decided_by).toBeNull();
});

test("Org B cannot reach or decide Org A's approval", async () => {
  const started = await startReview(editor, ORG_A_EDITOR.brandId, REVIEW_PLAN);
  const { approvalId, revision, planHash } = started.body as {
    approvalId: string;
    revision: number;
    planHash: string;
  };

  // Brand A's org is hidden from Org B by RLS, so it surfaces as not-found
  // rather than as a permission oracle.
  const crossStart = await startReview(orgB, ORG_A_EDITOR.brandId, REVIEW_PLAN);
  expect(crossStart.status, JSON.stringify(crossStart.body)).toBe(404);

  // Org B can neither read nor decide Org A's approval.
  const snapshot = await readSnapshot(orgB.page, approvalId);
  expect(snapshot.ok).toBe(false);

  const crossDecide = await decide(orgB, approvalId, revision, planHash, "approved");
  expect([403, 404]).toContain(crossDecide.status);

  const after = await approvalRow(approvalId);
  expect(after!.status).toBe("pending");
  expect(after!.decided_by).toBeNull();

  // Org B's own brand is untouched and still stageable by its own owner.
  const ownStart = await startReview(orgB, ORG_B_OWNER.brandId, REVIEW_PLAN);
  expect(ownStart.status, JSON.stringify(ownStart.body)).toBe(201);
});

test("an edit stages revision N+1 and revision N can no longer be decided", async () => {
  const started = await startReview(editor, ORG_A_EDITOR.brandId, REVIEW_PLAN);
  const first = started.body as { approvalId: string; revision: number; planHash: string };

  const revised = await stageRevision(editor, first.approvalId, EDITED_REVIEW_PLAN);
  expect(revised.status, JSON.stringify(revised.body)).toBe(201);
  const next = revised.body as {
    approvalId: string;
    revision: number;
    planHash: string;
    supersededRevision: number;
  };
  expect(next.revision).toBe(first.revision + 1);
  expect(next.supersededRevision).toBe(first.revision);
  expect(next.planHash).not.toBe(first.planHash);

  // The superseded revision is structurally undecidable, even by the editor
  // who staged it, with the exact hash they were shown.
  const stale = await decide(editor, first.approvalId, first.revision, first.planHash, "approved");
  expect(stale.status, JSON.stringify(stale.body)).toBe(409);

  const superseded = await approvalRow(first.approvalId);
  expect(superseded!.status).toBe("pending");

  // The new revision is the one that can be decided.
  const decided = await decide(editor, next.approvalId, next.revision, next.planHash, "approved");
  expect(decided.status, JSON.stringify(decided.body)).toBe(200);
  expect(decided.body.ok).toBe(true);

  const current = await approvalRow(next.approvalId);
  expect(current!.status).toBe("approved");
});

test("reload keeps the durable review state readable and actionable", async () => {
  const started = await startReview(editor, ORG_A_EDITOR.brandId, REVIEW_PLAN);
  const { approvalId, revision, planHash } = started.body as {
    approvalId: string;
    revision: number;
    planHash: string;
  };

  const before = await readSnapshot(editor.page, approvalId);

  // A real browser reload: the session must survive and the durable review
  // state must be unchanged and still decidable against the same exact revision.
  await editor.page.goto("/app");
  await editor.page.reload();
  await expect(editor.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const after = await readSnapshot(editor.page, approvalId);
  expect(after.ok).toBe(true);
  expect(after.status).toBe(before.status);
  expect(after.revision).toBe(before.revision);
  expect(after.planHash).toBe(before.planHash);
  expect(after.hashMatches).toBe(true);
  expect(after.isCurrent).toBe(true);

  const decided = await decide(editor, approvalId, revision, planHash, "approved");
  expect(decided.status, JSON.stringify(decided.body)).toBe(200);
  expect(decided.body.ok).toBe(true);
});

test("retrying the same decision is idempotent and records no duplicate", async () => {
  const started = await startReview(editor, ORG_A_EDITOR.brandId, REVIEW_PLAN);
  const { approvalId, revision, planHash } = started.body as {
    approvalId: string;
    revision: number;
    planHash: string;
  };

  const first = await decide(editor, approvalId, revision, planHash, "approved");
  expect(first.status).toBe(200);
  expect(first.body.replayed).toBe(false);
  const firstRow = await approvalRow(approvalId);

  // The same reviewer, same revision, same hash, same verb — a reconnect retry.
  const retry = await decide(editor, approvalId, revision, planHash, "approved");
  expect(retry.status, JSON.stringify(retry.body)).toBe(200);
  expect(retry.body.ok).toBe(true);
  expect(retry.body.replayed).toBe(true);

  const retryRow = await approvalRow(approvalId);
  expect(retryRow!.status).toBe("approved");
  expect(retryRow!.decided_at!.toISOString()).toBe(firstRow!.decided_at!.toISOString());

  // A different verb on the same revision is not a replay.
  const conflicting = await decide(editor, approvalId, revision, planHash, "rejected");
  expect(conflicting.status, JSON.stringify(conflicting.body)).toBe(409);

  const finalRow = await approvalRow(approvalId);
  expect(finalRow!.status).toBe("approved");
});

test("a decision whose workflow run is gone stays durable and retry-safe", async () => {
  // Simulates run loss (process restart / storage loss): the revision is staged
  // through the real RPC, but no Mastra run backs its run id, so the resume can
  // never succeed. The decision must still be recorded durably.
  const runId = `ipi1084-missing-run-${Date.now()}`;
  const staged = await stageViaRpc(runId);
  expect((await approvalRow(staged.approvalId))!.status).toBe("pending");

  const decided = await decide(
    editor,
    staged.approvalId,
    staged.revision,
    staged.planHash,
    "approved",
  );
  expect(decided.status, JSON.stringify(decided.body)).toBe(200);
  expect(decided.body.ok).toBe(true);
  expect(["resume_failed", "already_advanced"]).toContain(decided.body.resumeState);

  const durable = await approvalRow(staged.approvalId);
  expect(durable!.status).toBe("approved");
  expect(durable!.decided_by).toBe(ORG_A_EDITOR.userId);

  // Recovery: the retry finds the durable decision instead of recording a second one.
  const retry = await decide(
    editor,
    staged.approvalId,
    staged.revision,
    staged.planHash,
    "approved",
  );
  expect(retry.status, JSON.stringify(retry.body)).toBe(200);
  expect(retry.body.replayed).toBe(true);

  const after = await approvalRow(staged.approvalId);
  expect(after!.decided_at!.toISOString()).toBe(durable!.decided_at!.toISOString());
});

test("the whole browser journey wrote zero Shoot rows", async () => {
  const after = await shootApplicationFingerprint();
  expect(
    after,
    "shoot.shoots / shot_list / shoot_deliverables row counts and row contents must be untouched",
  ).toBe(shootFingerprintBefore);
});
