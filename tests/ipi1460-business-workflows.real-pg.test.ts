/**
 * IPI-1460 · MASTRA-UPG-007 — real business-workflow regression proof.
 *
 * The Batch B evidence proved the Mastra 1.84 workflow engine and the
 * `@mastra/pg` 1.37 adapter independently (synthetic suspend/resume, isolated
 * schema replay, runtime-role DML). It did NOT prove that the actual iPix
 * business workflows — `shoot-plan-review` and `brand-intelligence` — suspend
 * and resume against real PostgreSQL storage with real Supabase approval
 * truth.
 *
 * This suite closes that gap without substituting a synthetic workflow:
 *
 *   * the workflows are the committed iPix definitions;
 *   * workflow state is persisted by `@mastra/pg` in the reviewed `mastra`
 *     schema of a disposable database (never in memory);
 *   * the suspend/resume boundary is crossed by a *new* pool + Mastra
 *     instance, so the resumed run must load its snapshot from PostgreSQL;
 *   * the Shoot Plan approval/decision uses the real `stage_*` / `decide_*` /
 *     `get_*_proof` RPCs and the real tenant authorization in them;
 *   * the Brand Intelligence crawl/extraction Edge Functions are the only
 *     stubbed boundary (they are external providers); every other write —
 *     brands, draft hash, approval, audit row — hits the local DB.
 *
 * Local-only and opt-in. `npm test` skips it. Run it through
 * `scripts/run-ipi1460-business-pg.mjs`, which provisions loopback fixtures,
 * supplies the disposable Mastra database URL and cleans up the synthetic
 * namespace afterwards.
 *
 * Required env (set by the runner):
 *   IPI1460_REAL_PG=1
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   IPI1460_LOCAL_DB_URL      (local Supabase Postgres, app schema)
 *   IPI1460_MASTRA_DB_URL     (disposable DB with the reviewed mastra schema)
 */
import { randomUUID } from "node:crypto";

import { Mastra } from "@mastra/core/mastra";
import { cloneWorkflow } from "@mastra/core/workflows";
import { PostgresStore } from "@mastra/pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { brandIntelligenceWorkflow } from "@/mastra/workflows/brand-intelligence";
import { shootPlanReviewWorkflow } from "@/mastra/workflows/shoot-plan-review";
import { createTrustedWorkflowRequestContext } from "@/mastra/workflow-identity";

const ENABLED = process.env.IPI1460_REAL_PG === "1";

const API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const LOCAL_DB_URL = process.env.IPI1460_LOCAL_DB_URL ?? "";
const MASTRA_DB_URL = process.env.IPI1460_MASTRA_DB_URL ?? "";

const RUN_PREFIX = "IPI1460-";
// Local throwaway accounts only. Generated per run so no credential literal
// exists in the repository (Codacy flags hardcoded passwords).
const FIXTURE_PASSWORD = randomUUID();

const ORG_A = "14600000-0000-4000-8000-00000000000a";
const ORG_B = "14600000-0000-4000-8000-00000000000b";
const BRAND_A = "14600000-0000-4000-8000-0000000000aa";
const BRAND_BI = "14600000-0000-4000-8000-0000000000ab";

const USER_OWNER_A = "14600000-0000-4000-8000-000000000004";
const USER_EDITOR_A = "14600000-0000-4000-8000-000000000001";
const USER_VIEWER_A = "14600000-0000-4000-8000-000000000002";
const USER_ORG_B = "14600000-0000-4000-8000-000000000003";

const EMAILS = {
  ownerA: "ipi1460-owner-a@ipix.test",
  editorA: "ipi1460-editor-a@ipix.test",
  viewerA: "ipi1460-viewer-a@ipix.test",
  orgB: "ipi1460-orgb@ipix.test",
};

const PLAN = {
  objective: { value: "Launch the IPI-1460 capsule", status: "confirmed" },
  channels: ["shopify"],
  referencesUsed: [{ id: "ref-ipi-1460", angle: "front" }],
};

const DRAFT = {
  schemaVersion: 2,
  name: "IPI 1460 Brand A",
  tagline: {
    value: "Quiet luxury for the everyday",
    evidence: [{ sourceUrl: "https://brand.example", quote: "Quiet luxury" }],
  },
  category: {
    value: "fashion",
    evidence: [{ sourceUrl: "https://brand.example", quote: "Fashion" }],
  },
  visualIdentity: { colors: ["#101010", "#f5f0e8"], mood: "minimal" },
  targetAudience: {
    value: "Design-led professionals",
    evidence: [{ sourceUrl: "https://brand.example", quote: "Professionals" }],
  },
  sourceUrl: "https://brand.example",
  scores: {
    visual: 82,
    audience: 78,
    consistency: 74,
    commerce_readiness: 69,
  },
};

type Session = {
  client: SupabaseClient;
  accessToken: string;
  userId: string;
};

type MastraHandle = {
  mastra: Mastra;
  close: () => Promise<void>;
};

let db: pg.Client;
let mastraDb: pg.Client;
let admin: SupabaseClient;
let ownerA: Session;
let editorA: Session;
let viewerA: Session;
let orgB: Session;

function assertEnabledEnv(): void {
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", API_URL],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
    ["IPI1460_LOCAL_DB_URL", LOCAL_DB_URL],
    ["IPI1460_MASTRA_DB_URL", MASTRA_DB_URL],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`IPI-1460 real-PG proof missing env: ${missing.join(", ")}`);
  }
  const loopback = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/;
  if (!loopback.test(API_URL)) {
    throw new Error("IPI-1460 real-PG proof refuses a non-loopback Supabase URL");
  }
}

async function ensureFixtureUsers(): Promise<void> {
  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    "content-type": "application/json",
  };
  for (const user of [
    { id: USER_OWNER_A, email: EMAILS.ownerA },
    { id: USER_EDITOR_A, email: EMAILS.editorA },
    { id: USER_VIEWER_A, email: EMAILS.viewerA },
    { id: USER_ORG_B, email: EMAILS.orgB },
  ]) {
    const create = await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        password: FIXTURE_PASSWORD,
        email_confirm: true,
      }),
    });
    if (create.ok) continue;
    const update = await fetch(`${API_URL}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ password: FIXTURE_PASSWORD, email_confirm: true }),
    });
    if (!update.ok) {
      throw new Error(`could not ensure fixture user ${user.email} (${update.status})`);
    }
  }
}

async function seedFixtures(): Promise<void> {
  await db.query(
    `insert into public.organizations (id, name, slug, type, owner_id)
     values
       ($1, 'IPI 1460 Org A', 'ipi-1460-org-a', 'brand', $2),
       ($3, 'IPI 1460 Org B', 'ipi-1460-org-b', 'brand', $4)
     on conflict (id) do update set name = excluded.name, owner_id = excluded.owner_id, updated_at = now()`,
    [ORG_A, USER_OWNER_A, ORG_B, USER_ORG_B],
  );
  await db.query(
    `insert into public.org_members (org_id, user_id, role)
     values
       ($1, $2, 'owner'),
       ($1, $3, 'editor'),
       ($1, $4, 'viewer'),
       ($5, $6, 'owner')
     on conflict (org_id, user_id) do update set role = excluded.role`,
    [ORG_A, USER_OWNER_A, USER_EDITOR_A, USER_VIEWER_A, ORG_B, USER_ORG_B],
  );
  await db.query(
    `insert into public.brands (id, user_id, name, org_id, brand_url, intake_status)
     values
       ($1, $2, 'IPI 1460 Brand A', $3, 'https://brand.example', 'brand_created'),
       ($4, $2, 'IPI 1460 Brand BI', $3, 'https://brand.example', 'brand_created')
     on conflict (id) do update
       set name = excluded.name, user_id = excluded.user_id, org_id = excluded.org_id,
           brand_url = excluded.brand_url, updated_at = now()`,
    [BRAND_A, USER_EDITOR_A, ORG_A, BRAND_BI],
  );
}

async function signIn(email: string, userId: string): Promise<Session> {
  const client = createClient(API_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: FIXTURE_PASSWORD,
  });
  if (error || !data.session?.access_token) {
    throw new Error(`fixture sign-in failed for ${email}: ${error?.message ?? "no session"}`);
  }
  return { client, accessToken: data.session.access_token, userId };
}

async function makeMastra(): Promise<MastraHandle> {
  const store = new PostgresStore({
    id: `ipi1460-${randomUUID()}`,
    connectionString: MASTRA_DB_URL,
    schemaName: "mastra",
    disableInit: true,
  });
  // Every instance gets its own workflow objects. The module singletons cache
  // their `Run` objects (`Workflow.#runs`), so reusing one across a simulated
  // restart would hand back the pre-restart Run instead of loading the
  // snapshot from PostgreSQL — which is exactly the thing under test.
  const mastra = new Mastra({
    workflows: {
      "shoot-plan-review": cloneWorkflow(shootPlanReviewWorkflow, { id: "shoot-plan-review" }),
      "brand-intelligence": cloneWorkflow(brandIntelligenceWorkflow, { id: "brand-intelligence" }),
    },
    storage: store,
    logger: false,
  });
  return { mastra, close: () => store.close() };
}

async function workflowRunState(
  workflow: { getWorkflowRunById(runId: string): Promise<{ status?: string } | null> },
  runId: string,
) {
  return workflow.getWorkflowRunById(runId);
}

/**
 * `suspendPayload` is keyed by the suspended step id. Use that, and fall back
 * to the flat payload for a single-step shape, so the test reads the data the
 * workflow actually suspended with rather than assuming one layout.
 */
function suspendData<T>(payload: unknown, stepId: string): T {
  const record = payload as Record<string, T> | undefined;
  const value = record?.[stepId] ?? (payload as T);
  if (!value) throw new Error(`missing suspend payload for step ${stepId}`);
  return value;
}

async function decide(
  client: SupabaseClient,
  args: {
    approvalId: string;
    revision: number;
    planHash: string;
    decision?: string;
    idempotencyKey: string;
    note?: string | null;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc("decide_shoot_plan_revision", {
    p_approval_id: args.approvalId,
    p_revision: args.revision,
    p_plan_hash: args.planHash,
    p_decision: args.decision ?? "approved",
    p_idempotency_key: args.idempotencyKey,
    p_note: args.note ?? null,
  });
  expect(error).toBeNull();
  return data as Record<string, unknown>;
}

async function stageRevision(
  runId: string,
  plan: Record<string, unknown> = PLAN,
  brandId: string = BRAND_A,
): Promise<{ approvalId: string; revision: number; planHash: string }> {
  const { data, error } = await admin.rpc("stage_shoot_plan_revision", {
    p_brand_id: brandId,
    p_workflow_run_id: runId,
    p_plan: plan,
    p_staged_by: null,
  });
  expect(error).toBeNull();
  expect(data).toMatchObject({ ok: true, status: "pending" });
  return data as { approvalId: string; revision: number; planHash: string };
}

describe.skipIf(!ENABLED)("IPI-1460 real business workflows on PostgreSQL", () => {
  beforeAll(async () => {
    assertEnabledEnv();
    db = new pg.Client({ connectionString: LOCAL_DB_URL });
    await db.connect();
    mastraDb = new pg.Client({ connectionString: MASTRA_DB_URL });
    await mastraDb.connect();

    admin = createClient(API_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await ensureFixtureUsers();
    await seedFixtures();

    ownerA = await signIn(EMAILS.ownerA, USER_OWNER_A);
    editorA = await signIn(EMAILS.editorA, USER_EDITOR_A);
    viewerA = await signIn(EMAILS.viewerA, USER_VIEWER_A);
    orgB = await signIn(EMAILS.orgB, USER_ORG_B);
  }, 120_000);

  afterAll(async () => {
    if (!ENABLED) return;
    try {
      for (const statement of [
        `delete from shoot.shoot_plan_approvals where brand_id = any($1::uuid[])`,
        `delete from public.brand_profile_approvals where brand_id = any($1::uuid[])`,
        `delete from public.brand_crawls where brand_id = any($1::uuid[])`,
        `delete from public.brand_scores where brand_id = any($1::uuid[])`,
      ]) {
        await db.query(statement, [[BRAND_A, BRAND_BI]]);
      }
      await db.query(`delete from public.brands where id = any($1::uuid[])`, [
        [BRAND_A, BRAND_BI],
      ]);
      await db.query(`delete from public.org_members where org_id = any($1::uuid[])`, [
        [ORG_A, ORG_B],
      ]);
      await db.query(`delete from public.organizations where id = any($1::uuid[])`, [
        [ORG_A, ORG_B],
      ]);
      for (const table of [
        "mastra.mastra_workflow_run_entries",
        "mastra.mastra_workflow_runs",
        "mastra.mastra_workflow_snapshot",
      ]) {
        await mastraDb.query(`delete from ${table} where run_id like $1`, [`${RUN_PREFIX}%`]);
      }
    } finally {
      await db?.end();
      await mastraDb?.end();
    }
  }, 60_000);

  it("suspends a real Shoot Plan review, survives a restart, and resumes the exact approved revision", async () => {
    const runId = `${RUN_PREFIX}SHOOT-${randomUUID()}`;
    const editorContext = await createTrustedWorkflowRequestContext(editorA.accessToken);
    expect(editorContext).not.toBeNull();
    expect(editorContext?.get("mastra__user")).toMatchObject({ orgId: ORG_A });

    // Instance A: start the actual committed workflow against real Postgres.
    const first = await makeMastra();
    let approvalId = "";
    let revision = 0;
    let planHash = "";
    try {
      const workflow = first.mastra.getWorkflow("shoot-plan-review");
      const run = await workflow.createRun({ runId });
      const started = (await run.start({
        inputData: { brandId: BRAND_A, plan: PLAN },
        requestContext: editorContext!,
      })) as {
        status: string;
        suspendPayload?: unknown;
        error?: unknown;
      };

      expect(started.status).toBe("suspended");
      expect(started.error).toBeUndefined();
      const suspended = suspendData<{
        approvalId: string;
        brandId: string;
        revision: number;
        planHash: string;
      }>(started.suspendPayload, "awaitDecision");
      expect(suspended).toMatchObject({ brandId: BRAND_A, revision: 1 });
      approvalId = suspended.approvalId;
      revision = suspended.revision;
      planHash = suspended.planHash;

      const stored = await workflowRunState(workflow, runId);
      expect(stored?.status).toBe("suspended");
    } finally {
      // Close the pool and discard the instance: the next instance gets a fresh
      // pool and workflow object, so it cannot reuse this run's in-memory state.
      await first.close();
    }

    // The durable row is real: staged by the workflow through the service RPC.
    const staged = await db.query(
      `select brand_id, workflow_run_id, revision, plan_hash, status, staged_by
         from shoot.shoot_plan_approvals where id = $1`,
      [approvalId],
    );
    expect(staged.rowCount).toBe(1);
    expect(staged.rows[0]).toMatchObject({
      brand_id: BRAND_A,
      workflow_run_id: runId,
      revision,
      plan_hash: planHash,
      status: "pending",
      staged_by: USER_EDITOR_A,
    });

    // A fresh instance resumes from PostgreSQL, not from memory.
    const second = await makeMastra();
    try {
      const workflow = second.mastra.getWorkflow("shoot-plan-review");
      const run = await workflow.createRun({ runId });

      const decision = await decide(editorA.client, {
        approvalId,
        revision,
        planHash,
        idempotencyKey: `approve-${runId}`,
        note: "Approved for the IPI-1460 real-PG proof",
      });
      expect(decision).toMatchObject({
        ok: true,
        decision: "approved",
        status: "approved",
        approvalId,
        revision,
        planHash,
        decidedBy: USER_EDITOR_A,
      });

      const resumed = (await run.resume({
        step: "awaitDecision",
        resumeData: {
          approvalId,
          revision,
          planHash,
          decision: "approved",
          note: null,
        },
        requestContext: editorContext!,
      })) as { status: string; result?: Record<string, unknown>; error?: unknown };

      expect(resumed.error).toBeUndefined();
      expect(resumed.status).toBe("success");
      expect(resumed.result).toMatchObject({
        approvalId,
        brandId: BRAND_A,
        revision,
        planHash,
        decision: "approved",
      });

      const stored = await workflowRunState(workflow, runId);
      expect(stored?.status).toBe("success");

      const { data: proof } = await admin.rpc("get_shoot_plan_approval_proof", {
        p_approval_id: approvalId,
      });
      expect(proof).toMatchObject({
        ok: true,
        approvalId,
        brandId: BRAND_A,
        workflowRunId: runId,
        revision,
        planHash,
        status: "approved",
        hashMatches: true,
        isCurrent: true,
      });

      const durable = await db.query(
        `select count(*)::int as n, min(decided_by::text) as decided_by
           from shoot.shoot_plan_approvals
          where workflow_run_id = $1 and revision = $2 and status = 'approved'`,
        [runId, revision],
      );
      expect(durable.rows[0]).toEqual({ n: 1, decided_by: USER_EDITOR_A });
    } finally {
      await second.close();
    }
  }, 120_000);

  it("repeating the exact approval replays idempotently and creates no second decision", async () => {
    const runId = `${RUN_PREFIX}IDEMPOTENT-${randomUUID()}`;
    const staged = await stageRevision(runId);
    const key = `approve-${runId}`;

    const first = await decide(editorA.client, {
      approvalId: staged.approvalId,
      revision: staged.revision,
      planHash: staged.planHash,
      idempotencyKey: key,
    });
    expect(first).toMatchObject({ ok: true, replayed: false });
    const decidedAt = (
      await db.query(`select decided_at from shoot.shoot_plan_approvals where id = $1`, [
        staged.approvalId,
      ])
    ).rows[0].decided_at as Date;

    const replay = await decide(editorA.client, {
      approvalId: staged.approvalId,
      revision: staged.revision,
      planHash: staged.planHash,
      idempotencyKey: key,
    });
    expect(replay).toMatchObject({ ok: true, replayed: true, approvalId: staged.approvalId });

    const rows = await db.query(
      `select count(*)::int as n, decided_at, decided_by::text as decided_by
         from shoot.shoot_plan_approvals where id = $1 group by decided_at, decided_by`,
      [staged.approvalId],
    );
    expect(rows.rows[0].n).toBe(1);
    expect(rows.rows[0].decided_by).toBe(USER_EDITOR_A);
    expect(new Date(rows.rows[0].decided_at).getTime()).toBe(decidedAt.getTime());

    // A different key on the same decided revision must not create a second effect.
    const secondDecision = await decide(editorA.client, {
      approvalId: staged.approvalId,
      revision: staged.revision,
      planHash: staged.planHash,
      idempotencyKey: `${key}-again`,
    });
    expect(secondDecision).toMatchObject({ ok: false, code: "ALREADY_DECIDED" });
  }, 60_000);

  it("denies Org B, a viewer, and a revoked editor the Org A decision", async () => {
    const runId = `${RUN_PREFIX}TENANT-${randomUUID()}`;
    const staged = await stageRevision(runId);

    const orgBAttempt = await decide(orgB.client, {
      approvalId: staged.approvalId,
      revision: staged.revision,
      planHash: staged.planHash,
      idempotencyKey: `orgb-${runId}`,
    });
    expect(orgBAttempt).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const viewerAttempt = await decide(viewerA.client, {
      approvalId: staged.approvalId,
      revision: staged.revision,
      planHash: staged.planHash,
      idempotencyKey: `viewer-${runId}`,
    });
    expect(viewerAttempt).toMatchObject({ ok: false, code: "FORBIDDEN" });

    // Revoke the editor's membership, then re-run the same decision.
    await db.query(`delete from public.org_members where org_id = $1 and user_id = $2`, [
      ORG_A,
      USER_EDITOR_A,
    ]);
    try {
      const revokedAttempt = await decide(editorA.client, {
        approvalId: staged.approvalId,
        revision: staged.revision,
        planHash: staged.planHash,
        idempotencyKey: `revoked-${runId}`,
      });
      expect(revokedAttempt).toMatchObject({ ok: false, code: "FORBIDDEN" });
    } finally {
      await db.query(
        `insert into public.org_members (org_id, user_id, role)
         values ($1, $2, 'editor')
         on conflict (org_id, user_id) do update set role = 'editor'`,
        [ORG_A, USER_EDITOR_A],
      );
    }

    const status = await db.query(`select status from shoot.shoot_plan_approvals where id = $1`, [
      staged.approvalId,
    ]);
    expect(status.rows[0].status).toBe("pending");
  }, 60_000);

  it("refuses a superseded or stale revision and cannot resume the superseded run", async () => {
    const runId = `${RUN_PREFIX}STALE-${randomUUID()}`;
    const editorContext = await createTrustedWorkflowRequestContext(editorA.accessToken);

    // Suspend a real run on revision 1.
    const first = await makeMastra();
    let stale: { approvalId: string; revision: number; planHash: string };
    try {
      const workflow = first.mastra.getWorkflow("shoot-plan-review");
      const run = await workflow.createRun({ runId });
      const started = (await run.start({
        inputData: { brandId: BRAND_A, plan: PLAN },
        requestContext: editorContext!,
      })) as { status: string; suspendPayload: unknown };
      expect(started.status).toBe("suspended");
      stale = suspendData<{ approvalId: string; revision: number; planHash: string }>(
        started.suspendPayload,
        "awaitDecision",
      );
    } finally {
      await first.close();
    }

    // A newer plan revision for the same run supersedes revision 1.
    const newer = await stageRevision(runId, {
      ...PLAN,
      objective: { value: "Launch the revised capsule", status: "confirmed" },
    });
    expect(newer.revision).toBe(2);

    const superseded = await decide(editorA.client, {
      approvalId: stale.approvalId,
      revision: stale.revision,
      planHash: stale.planHash,
      idempotencyKey: `superseded-${runId}`,
    });
    expect(superseded).toMatchObject({ ok: false, code: "SUPERSEDED_REVISION", currentRevision: 2 });

    const wrongHash = await decide(editorA.client, {
      approvalId: newer.approvalId,
      revision: newer.revision,
      planHash: "0".repeat(64),
      idempotencyKey: `wrong-hash-${runId}`,
    });
    expect(wrongHash).toMatchObject({ ok: false, code: "STALE_REVISION", currentRevision: 2 });

    // Stage revision 3 to supersede revision 2, then resume the run quoting the
    // now-superseded revision-1 decision. The workflow re-reads the durable
    // proof and must fail closed rather than advance.
    const newest = await stageRevision(runId, {
      ...PLAN,
      objective: { value: "Launch the third capsule", status: "confirmed" },
    });
    expect(newest.revision).toBe(3);
    const approvedNewest = await decide(editorA.client, {
      approvalId: newest.approvalId,
      revision: newest.revision,
      planHash: newest.planHash,
      idempotencyKey: `approve-newest-${runId}`,
    });
    expect(approvedNewest).toMatchObject({ ok: true, revision: 3 });

    const second = await makeMastra();
    try {
      const workflow = second.mastra.getWorkflow("shoot-plan-review");
      const run = await workflow.createRun({ runId });
      // A failed step resolves with status "failed" rather than rejecting.
      const rejected = (await run.resume({
        step: "awaitDecision",
        resumeData: {
          approvalId: stale.approvalId,
          revision: stale.revision,
          planHash: stale.planHash,
          decision: "approved",
          note: null,
        },
        requestContext: editorContext!,
      })) as { status: string; error?: unknown };
      expect(rejected.status).toBe("failed");
      const rejectionMessage =
        (rejected.error as { message?: string } | undefined)?.message ??
        JSON.stringify(rejected.error);
      expect(rejectionMessage).toMatch(
        /newer revision superseded|No decision has been recorded|does not match/i,
      );
    } finally {
      await second.close();
    }
  }, 120_000);

  it("suspends and resumes the real Brand Intelligence workflow across crawl and approval", async () => {
    const runId = `${RUN_PREFIX}BI-${randomUUID()}`;
    const editorContext = await createTrustedWorkflowRequestContext(editorA.accessToken);
    const realFetch = globalThis.fetch;

    await db.query(
      `update public.brands
          set ai_profile_draft = $1::jsonb, intake_status = 'brand_created',
              approved_profile_at = null, updated_at = now()
        where id = $2`,
      [JSON.stringify(DRAFT), BRAND_BI],
    );

    // Only the external crawl/extraction Edge Functions are stubbed. The
    // started-crawl row is written for real so the approval RPC's
    // brand<->run binding is genuinely enforced.
    const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};
      if (url.endsWith("/functions/v1/start-brand-crawl")) {
        const crawlId = randomUUID();
        await db.query(
          `insert into public.brand_crawls
             (id, brand_id, source_url, workflow_id, idempotency_key, job_status, started_by)
           values ($1, $2, $3, $4, $5, 'complete', $6)
           on conflict (id) do nothing`,
          [
            crawlId,
            body.brandId,
            body.url,
            body.workflowId,
            body.idempotencyKey,
            USER_EDITOR_A,
          ],
        );
        return new Response(JSON.stringify({ ok: true, data: { crawlId } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/functions/v1/brand-intelligence")) {
        return new Response(JSON.stringify({ ok: true, data: { extracted: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return realFetch(input, init);
    });
    vi.stubGlobal("fetch", fetchStub);

    let crawlId = "";
    try {
      const first = await makeMastra();
      try {
        const workflow = first.mastra.getWorkflow("brand-intelligence");
        const run = await workflow.createRun({ runId });
        const started = (await run.start({
          inputData: { brandId: BRAND_BI, actorId: USER_EDITOR_A },
          requestContext: editorContext!,
        })) as { status: string; suspendPayload?: unknown };
        expect(started.status).toBe("suspended");
        crawlId = suspendData<{ crawlId: string }>(started.suspendPayload, "waitForCrawl").crawlId;
        expect(crawlId).toMatch(/[0-9a-f-]{36}/);
      } finally {
        await first.close();
      }

      // Fresh instance: resume crawl completion from PostgreSQL.
      const second = await makeMastra();
      try {
        const workflow = second.mastra.getWorkflow("brand-intelligence");
        const run = await workflow.createRun({ runId });
        const afterCrawl = (await run.resume({
          step: "waitForCrawl",
          resumeData: { crawlId },
          requestContext: editorContext!,
        })) as { status: string; suspendPayload?: unknown };

        expect(afterCrawl).toMatchObject({ status: "suspended" });
        const suspendedBI = suspendData<{ brandId: string; draftHash: string }>(
          afterCrawl.suspendPayload,
          "saveDraftAndWait",
        );
        expect(suspendedBI).toMatchObject({ brandId: BRAND_BI });
        const draftHash = suspendedBI.draftHash;
        expect(draftHash).toHaveLength(64);

        // The workflow persisted the run binding and the real draft hash.
        const brand = await db.query(
          `select intake_status, ai_profile_draft->>'_workflow_run_id' as run_id
             from public.brands where id = $1`,
          [BRAND_BI],
        );
        expect(brand.rows[0]).toEqual({ intake_status: "draft_ready", run_id: runId });

        const approve = await editorA.client.rpc("approve_brand_intelligence_draft", {
          p_brand_id: BRAND_BI,
          p_expected_draft_hash: draftHash,
        });
        expect(approve.error).toBeNull();
        expect(approve.data).toMatchObject({ ok: true, code: "APPROVED", draft_hash: draftHash });

        const completed = (await run.resume({
          step: "saveDraftAndWait",
          resumeData: { approved: true },
          requestContext: editorContext!,
        })) as { status: string; result?: unknown; error?: unknown };
        expect(completed.error).toBeUndefined();
        expect(completed.status).toBe("success");
        expect(completed.result).toMatchObject({ status: "approved" });

        const stored = await workflowRunState(workflow, runId);
        expect(stored?.status).toBe("success");

        const approved = await db.query(
          `select b.approved_profile_at is not null as approved,
                  b.intake_status, b.ai_profile_draft,
                  (select count(*)::int from public.brand_profile_approvals a
                    where a.brand_id = b.id and a.decision = 'approved' and a.workflow_run_id = $2) as audit_rows
             from public.brands b where b.id = $1`,
          [BRAND_BI, runId],
        );
        expect(approved.rows[0]).toMatchObject({
          approved: true,
          intake_status: "ready",
          ai_profile_draft: null,
          audit_rows: 1,
        });
      } finally {
        await second.close();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 180_000);
});
