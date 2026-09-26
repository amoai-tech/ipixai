import { beforeEach, describe, expect, it, vi } from "vitest";
import { noopObserve } from "@mastra/core/tools";

const mocks = vi.hoisted(() => ({
  getStore: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  brandSingle: vi.fn(),
  crawlLinkMaybeSingle: vi.fn(),
  priorDecisionMaybeSingle: vi.fn(),
  createClient: vi.fn(),
  start: vi.fn(),
  after: vi.fn(),
  resume: vi.fn(),
  createRun: vi.fn(),
  getWorkflow: vi.fn(),
  getWorkflowRunById: vi.fn(),
  orgMembers: vi.fn(),
}));

vi.mock("@/lib/request-token", () => ({
  requestToken: { getStore: mocks.getStore },
}));

vi.mock("next/server", () => ({ after: mocks.after }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseConfig: () => ({
    url: "https://example.supabase.co",
    publishableKey: "pk-test",
  }),
}));

vi.mock("@/mastra/runtime", () => ({
  getMastra: () => ({
    getWorkflow: mocks.getWorkflow,
  }),
}));

import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from "@mastra/core/request-context";

import { approveDraft, startBrandAnalysis } from "@/mastra/tools/brand-intelligence";
import { MASTRA_USER_KEY } from "@/mastra/workflow-identity";

// The installed Mastra Tool.execute signature is (inputData, context) — see
// node_modules/@mastra/core/dist/tools/types.d.ts. `observe` is the only
// required field on context; noopObserve is Mastra's own no-op default.
const ctx = { observe: noopObserve } as Parameters<
  NonNullable<typeof startBrandAnalysis.execute>
>[1];

function mockUserScopedClient() {
  mocks.createClient.mockReturnValue({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === "org_members") {
        // User-scoped membership lookup behind the trusted workflow context.
        return { select: () => ({ eq: mocks.orgMembers }) };
      }
      if (table === "brand_crawls") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: mocks.crawlLinkMaybeSingle,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "brand_profile_approvals") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: mocks.priorDecisionMaybeSingle,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: mocks.brandSingle,
          }),
        }),
      };
    },
    rpc: mocks.rpc,
  });
}

function mockWorkflow() {
  mocks.getWorkflow.mockReturnValue({
    createRun: mocks.createRun,
    getWorkflowRunById: mocks.getWorkflowRunById,
  });
  mocks.createRun.mockResolvedValue({
    runId: RUN_ID,
    start: mocks.start,
    resume: mocks.resume,
  });
}

const BRAND_ID = "11111111-1111-1111-1111-111111111111";
const RUN_ID = "run-1";

const DRAFT = {
  schemaVersion: 2,
  name: "Acme",
  tagline: { value: "T", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  category: { value: "C", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  targetAudience: { value: "A", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  visualIdentity: { colors: ["#fff"], mood: "m" },
  sourceUrl: "https://acme.co",
  scores: { visual: 80, audience: 70, consistency: 60, commerce_readiness: 50 },
  _workflow_run_id: RUN_ID,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  mocks.getStore.mockReturnValue("tok");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "op-1" } }, error: null });
  mocks.crawlLinkMaybeSingle.mockResolvedValue({ data: { id: "crawl-1" }, error: null });
  mocks.priorDecisionMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.getWorkflowRunById.mockResolvedValue({ status: "suspended" });
  mockUserScopedClient();
  mockWorkflow();
});

describe("startBrandAnalysis", () => {
  const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("HTTP path: reuses Mastra server auth's authenticated RequestContext", async () => {
    mocks.start.mockResolvedValue({ status: "suspended" });
    const requestContext = new RequestContext();
    const verifiedUser = { id: "op-1", orgId: ORG_ID, resourceId: `org:${ORG_ID}::user:op-1` };
    requestContext.set(MASTRA_USER_KEY, verifiedUser);

    const result = await startBrandAnalysis.execute!({ brandId: BRAND_ID }, { ...ctx, requestContext });

    expect(mocks.start).toHaveBeenCalledWith(
      expect.objectContaining({ inputData: { brandId: BRAND_ID, actorId: "op-1" } }),
    );
    const started = mocks.start.mock.calls[0][0] as { requestContext: RequestContext };
    expect(started.requestContext.get(MASTRA_USER_KEY)).toEqual(verifiedUser);
    expect(result).toMatchObject({ runId: RUN_ID });
  });

  it("server action path: builds a trusted RequestContext from the verified session token", async () => {
    mocks.start.mockResolvedValue({ status: "suspended" });
    mocks.orgMembers.mockResolvedValue({ data: [{ org_id: ORG_ID }], error: null });

    const result = await startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx);

    expect(mocks.getUser).toHaveBeenCalledWith("tok");
    expect(mocks.orgMembers).toHaveBeenCalledWith("user_id", "op-1");
    const started = mocks.start.mock.calls[0][0] as {
      inputData: Record<string, unknown>;
      requestContext: RequestContext;
    };
    expect(started.inputData).toEqual({ brandId: BRAND_ID, actorId: "op-1" });
    expect(started.requestContext.get(MASTRA_USER_KEY)).toEqual({
      id: "op-1",
      orgId: ORG_ID,
      resourceId: `org:${ORG_ID}::user:op-1`,
    });
    expect(started.requestContext.get(MASTRA_AUTH_TOKEN_KEY)).toBe("tok");
    expect(result).toMatchObject({ runId: RUN_ID });
  });

  it("does not start the workflow when the token fails Supabase verification", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid JWT" } });

    await expect(startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx)).rejects.toThrow(
      "Could not verify the operator's session and organization",
    );
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("keeps the real start() promise alive with after() instead of detaching it", async () => {
    let finish!: () => void;
    mocks.start.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    mocks.orgMembers.mockResolvedValue({ data: [{ org_id: ORG_ID }], error: null });

    const result = await startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx);

    // The tool answers with the run id before the run finishes...
    expect(result).toMatchObject({ runId: RUN_ID });
    expect(mocks.start).toHaveBeenCalledTimes(1);
    // ...and hands the still-pending run to after(), exactly once.
    expect(mocks.after).toHaveBeenCalledTimes(1);
    const kept = (mocks.after.mock.calls[0][0] as () => Promise<unknown>)();
    let settled = false;
    void kept.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    await kept;
    expect(settled).toBe(true);
  });

  it("still starts the run when after() is unavailable (no Next request scope)", async () => {
    mocks.after.mockImplementation(() => { throw new Error("after() outside request scope"); });
    mocks.start.mockResolvedValue({ status: "suspended" });
    mocks.orgMembers.mockResolvedValue({ data: [{ org_id: ORG_ID }], error: null });

    const result = await startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx);

    expect(result).toMatchObject({ runId: RUN_ID });
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });

  it("logs a run that resolves with status failed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("Failed to start brand crawl: Authorization required");
    mocks.start.mockResolvedValue({ status: "failed", error: failure });
    mocks.orgMembers.mockResolvedValue({ data: [{ org_id: ORG_ID }], error: null });

    await startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx);
    await (mocks.after.mock.calls[0][0] as () => Promise<unknown>)();

    expect(errorSpy).toHaveBeenCalledWith("[brand-intelligence] workflow run failed", failure);
    errorSpy.mockRestore();
  });

  it("does not log a run that suspends normally", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.start.mockResolvedValue({ status: "suspended" });
    mocks.orgMembers.mockResolvedValue({ data: [{ org_id: ORG_ID }], error: null });

    await startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx);
    await (mocks.after.mock.calls[0][0] as () => Promise<unknown>)();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("logs, rather than leaks, a run that rejects in the background", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.start.mockRejectedValue(new Error("boom"));
    mocks.orgMembers.mockResolvedValue({ data: [{ org_id: ORG_ID }], error: null });

    await startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx);
    await (mocks.after.mock.calls[0][0] as () => Promise<unknown>)();

    expect(errorSpy).toHaveBeenCalledWith(
      "[brand-intelligence] workflow run failed",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it.each([
    ["no membership", []],
    ["more than one membership", [{ org_id: ORG_ID }, { org_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }]],
  ])("does not start the workflow without exactly one trusted org (%s)", async (_label, rows) => {
    mocks.orgMembers.mockResolvedValue({ data: rows, error: null });

    await expect(startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx)).rejects.toThrow(
      "Could not verify the operator's session and organization",
    );
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("throws when no access token is available in the request context (unauthenticated denied)", async () => {
    mocks.getStore.mockReturnValue(undefined);

    await expect(
      startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx),
    ).rejects.toThrow("Access token not available in request context");
    expect(mocks.start).not.toHaveBeenCalled();
  });
});

describe("approveDraft", () => {
  it("approves with the reviewed hash unchanged: RPC receives exactly the caller-supplied draftHash, never a recomputed one", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: true, code: "APPROVED" }, error: null });
    mocks.resume.mockResolvedValue({ status: "success" });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    // Exactly one RPC call — approveDraft must never call get_brand_draft_hash
    // itself; that would defeat the exact-artifact/stale-draft protection.
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("approve_brand_intelligence_draft", {
      p_brand_id: BRAND_ID,
      p_expected_draft_hash: "H1-reviewed",
    });
    expect(mocks.createRun).toHaveBeenCalledWith({ runId: RUN_ID });
    expect(mocks.resume).toHaveBeenCalledWith({
      resumeData: { approved: true },
      step: "saveDraftAndWait",
    });
    expect(result).toMatchObject({ ok: true, approved: true });
  });

  it("draft changes after review: RPC returns STALE_DRAFT for the stale H1 and the workflow is not resumed (unseen content not approved)", async () => {
    // Operator reviewed H1. The server draft has since mutated (a re-run, a
    // race) — the RPC recomputes the CURRENT hash and it no longer matches
    // H1, so it fails closed. approveDraft must forward H1 unchanged and
    // must not paper over the mismatch.
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "STALE_DRAFT" }, error: null });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    expect(mocks.rpc).toHaveBeenCalledWith("approve_brand_intelligence_draft", {
      p_brand_id: BRAND_ID,
      p_expected_draft_hash: "H1-reviewed",
    });
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, approved: true });
    expect((result as { message: string }).message).toMatch(/re-review/);
  });

  it("rejects: calls the reject RPC with the caller-supplied hash and resumes with approved:false exactly once", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: true, code: "REJECTED" }, error: null });
    mocks.resume.mockResolvedValue({ status: "success" });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: false },
      ctx,
    );

    expect(mocks.rpc).toHaveBeenCalledWith("reject_brand_intelligence_draft", {
      p_brand_id: BRAND_ID,
      p_expected_draft_hash: "H1-reviewed",
    });
    expect(mocks.resume).toHaveBeenCalledTimes(1);
    expect(mocks.resume).toHaveBeenCalledWith({
      resumeData: { approved: false },
      step: "saveDraftAndWait",
    });
    expect(result).toMatchObject({ ok: true, approved: false });
  });

  it("does not resume when the operator is forbidden (FORBIDDEN — viewer/foreign-org)", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "FORBIDDEN" }, error: null });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    expect(mocks.resume).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });

  it("resumes on an RPC-level ALREADY_APPROVED reply when the run is still genuinely suspended (edge case: RPC returns this code without the draft having been cleared yet)", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: true, code: "ALREADY_APPROVED" }, error: null });
    mocks.getWorkflowRunById.mockResolvedValue({ status: "suspended" });
    mocks.resume.mockResolvedValue({ status: "success" });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    // Gating resume on outcome.code === "APPROVED" (skipping it on replay)
    // was the bug: if the first call's RPC committed but its own resume then
    // failed, the next call gets ALREADY_APPROVED and — gated — would never
    // retry resume, orphaning the suspended run forever despite the DB
    // decision being correct. Checking the run's actual persisted state
    // (not just the RPC's code) is what makes this precise.
    expect(mocks.getWorkflowRunById).toHaveBeenCalledWith(RUN_ID);
    expect(mocks.resume).toHaveBeenCalledWith({
      resumeData: { approved: true },
      step: "saveDraftAndWait",
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("does NOT attempt resume when the run already advanced past suspend (state check avoids a pointless/unsafe redundant resume)", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: true, code: "ALREADY_APPROVED" }, error: null });
    // (edge case, same as above: RPC returned ALREADY_APPROVED without the
    // draft having been cleared yet)
    // The earlier resume already landed — the run completed normally.
    mocks.getWorkflowRunById.mockResolvedValue({ status: "success" });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    expect(mocks.resume).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true });
  });

  it("CRITICAL: recovers rejection after the RPC commits and clears the draft, then the resume call fails — retry must not return NO_DRAFT", async () => {
    // Real SQL behavior: reject_brand_intelligence_draft sets
    // brands.ai_profile_draft = NULL on commit. A naive "no draft => NO_DRAFT"
    // check (the actual bug this regression catches) would stop here on
    // retry and never recover — orphaning the suspended run forever, despite
    // the rejection already being durably recorded in brand_profile_approvals.
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: { ok: true, code: "REJECTED" }, error: null });
    mocks.resume.mockRejectedValueOnce(new Error("transient failure"));

    const first = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: false },
      ctx,
    );
    expect(first).toMatchObject({ ok: true, approved: false });
    expect(mocks.resume).toHaveBeenCalledTimes(1);

    // Retry: brands.ai_profile_draft is now NULL (the RPC's own commit
    // cleared it) and the run is still suspended (the first resume never
    // landed). Durable recovery must come from brand_profile_approvals.
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: null }, error: null });
    mocks.priorDecisionMaybeSingle.mockResolvedValue({
      data: { decision: "rejected", workflow_run_id: RUN_ID },
      error: null,
    });
    mocks.getWorkflowRunById.mockResolvedValue({ status: "suspended" });
    mocks.resume.mockResolvedValueOnce({ status: "success" });

    const second = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: false },
      ctx,
    );

    // The RPC must NOT be called again — the decision is already committed;
    // recovery reconciles the workflow directly from the durable audit row.
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.resume).toHaveBeenCalledTimes(2);
    expect(mocks.resume).toHaveBeenLastCalledWith({
      resumeData: { approved: false },
      step: "saveDraftAndWait",
    });
    expect(second).toMatchObject({ ok: true, approved: false });
    expect((second as { message: string }).message).not.toMatch(/try again/);
  });

  it("rejection already fully completed: draft NULL, durable rejection audit exists, run already advanced past suspend — no resume attempted", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: null }, error: null });
    mocks.priorDecisionMaybeSingle.mockResolvedValue({
      data: { decision: "rejected", workflow_run_id: RUN_ID },
      error: null,
    });
    mocks.getWorkflowRunById.mockResolvedValue({ status: "success" });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: false },
      ctx,
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, approved: false });
  });

  it("recovery honors the DURABLE decision, not the caller's requested flag: an approved-hash retry that (mistakenly) passes approved:false still reconciles as approved", async () => {
    // Defense-in-depth for the one-hash-one-decision invariant: even if a
    // caller retries with the wrong `approved` value for this hash, recovery
    // must reconcile using what was actually committed in
    // brand_profile_approvals, never re-decide based on client input.
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: null }, error: null });
    mocks.priorDecisionMaybeSingle.mockResolvedValue({
      data: { decision: "approved", workflow_run_id: RUN_ID },
      error: null,
    });
    mocks.getWorkflowRunById.mockResolvedValue({ status: "suspended" });
    mocks.resume.mockResolvedValue({ status: "success" });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: false },
      ctx,
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.resume).toHaveBeenCalledWith({
      resumeData: { approved: true },
      step: "saveDraftAndWait",
    });
    expect(result).toMatchObject({ ok: true, approved: true });
  });

  it("reports success with a retry hint when the RPC commits but the post-commit resume fails", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: true, code: "APPROVED" }, error: null });
    mocks.resume.mockRejectedValue(new Error("run not suspended"));

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    // The RPC already committed the decision durably; only the in-memory
    // workflow resume failed. This must not throw and lose that fact.
    expect(result).toMatchObject({ ok: true, approved: true });
    expect((result as { message: string }).message).toMatch(/try again/);
  });

  it("reports success with a retry hint when resume() resolves with a non-throwing failure status", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: true, code: "APPROVED" }, error: null });
    // WorkflowResult.status includes 'failed'/'suspended'/etc as non-throwing
    // outcomes — a try/catch-only check would miss this.
    mocks.resume.mockResolvedValue({ status: "failed", error: new Error("step failed") });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    expect(result).toMatchObject({ ok: true, approved: true });
    expect((result as { message: string }).message).toMatch(/try again/);
  });

  it("CRITICAL: recovers an orphaned suspend on retry after approval clears the draft — first resume fails, retry must recover via the durable audit row, not re-call the RPC", async () => {
    // Real SQL behavior (P1 fix): approve_brand_intelligence_draft clears
    // ai_profile_draft = NULL on commit too, exactly like reject — one exact
    // draft_hash must have exactly one final decision, so the same hash
    // can't later be rejected. That means a naive retry that still expects
    // the draft present (the old assumption) no longer matches reality.
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.getWorkflowRunById.mockResolvedValue({ status: "suspended" });

    // First call: RPC commits APPROVED (and clears the draft), but resume()
    // fails (e.g. cold start).
    mocks.rpc.mockResolvedValueOnce({ data: { ok: true, code: "APPROVED" }, error: null });
    mocks.resume.mockRejectedValueOnce(new Error("transient failure"));
    const first = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );
    expect(first).toMatchObject({ ok: true, approved: true });
    expect(mocks.resume).toHaveBeenCalledTimes(1);

    // Retry: brands.ai_profile_draft is now NULL (the RPC's own commit
    // cleared it). Durable recovery must come from brand_profile_approvals,
    // the same path already proven for rejection above — not a second RPC
    // call, which would just return NO_DRAFT.
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: null }, error: null });
    mocks.priorDecisionMaybeSingle.mockResolvedValue({
      data: { decision: "approved", workflow_run_id: RUN_ID },
      error: null,
    });
    mocks.resume.mockResolvedValueOnce({ status: "success" });
    const second = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.resume).toHaveBeenCalledTimes(2);
    expect(mocks.resume).toHaveBeenLastCalledWith({
      resumeData: { approved: true },
      step: "saveDraftAndWait",
    });
    expect(second).toMatchObject({ ok: true, approved: true });
    expect((second as { message: string }).message).not.toMatch(/try again/);
  });

  it("approval already fully completed: draft NULL, durable approval audit exists, run already advanced past suspend — no resume attempted", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: null }, error: null });
    mocks.priorDecisionMaybeSingle.mockResolvedValue({
      data: { decision: "approved", workflow_run_id: RUN_ID },
      error: null,
    });
    mocks.getWorkflowRunById.mockResolvedValue({ status: "success" });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, approved: true });
  });

  it("does not resume on malformed scores (INVALID_DRAFT)", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "INVALID_DRAFT" }, error: null });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    expect(mocks.resume).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });

  it("BYTE-IDENTICAL REGENERATION: rejecting H1 permanently finalizes it — a later analysis run reproducing the exact same draft content still can't approve it (DECISION_FINALIZED)", async () => {
    // One exact draft_hash has exactly one final decision, permanently, not
    // just "not within the same immediate retry". The RPC itself now looks
    // up ANY prior decision for (brand_id, draft_hash) before this call even
    // reaches score validation or mutation.
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "DECISION_FINALIZED" }, error: null });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    expect(mocks.resume).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, approved: true });
    expect((result as { message: string }).message).toMatch(/cannot be reversed/);
  });

  it("BYTE-IDENTICAL REGENERATION mirror: approving H1 permanently finalizes it — a later analysis run reproducing the exact same draft content still can't reject it (DECISION_FINALIZED)", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "DECISION_FINALIZED" }, error: null });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: false },
      ctx,
    );

    expect(mocks.resume).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, approved: false });
    expect((result as { message: string }).message).toMatch(/cannot be reversed/);
  });

  it("returns NO_DRAFT without calling the RPC when the brand has no draft and no durable decision exists for this hash", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: null }, error: null });
    mocks.priorDecisionMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });

  it("throws when the draft is missing its workflow run id", async () => {
    mocks.brandSingle.mockResolvedValue({
      data: { ai_profile_draft: { ...DRAFT, _workflow_run_id: undefined } },
      error: null,
    });

    await expect(
      approveDraft.execute!(
        { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
        ctx,
      ),
    ).rejects.toThrow("missing its workflow run id");
  });

  it("rejects a workflow run that does not belong to this brand (cross-tenant run binding)", async () => {
    // _workflow_run_id lives in a JSONB column any org member can write; the
    // brand_crawls row (service-role write-only) is the trustworthy binding.
    // No matching row => the run/brand pairing is not proven, fail closed.
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.crawlLinkMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      approveDraft.execute!(
        { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
        ctx,
      ),
    ).rejects.toThrow("does not belong to this brand");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
  });

  it("throws when no access token is available in the request context (unauthenticated denied)", async () => {
    mocks.getStore.mockReturnValue(undefined);

    await expect(
      approveDraft.execute!(
        { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
        ctx,
      ),
    ).rejects.toThrow("Access token not available in request context");
  });
});
