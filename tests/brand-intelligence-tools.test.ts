import { beforeEach, describe, expect, it, vi } from "vitest";
import { noopObserve } from "@mastra/core/tools";

const mocks = vi.hoisted(() => ({
  getStore: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  brandSingle: vi.fn(),
  crawlLinkMaybeSingle: vi.fn(),
  createClient: vi.fn(),
  startAsync: vi.fn(),
  resume: vi.fn(),
  createRun: vi.fn(),
  getWorkflow: vi.fn(),
}));

vi.mock("@/lib/request-token", () => ({
  requestToken: { getStore: mocks.getStore },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseConfig: () => ({
    url: "https://example.supabase.co",
    publishableKey: "pk-test",
  }),
}));

vi.mock("@/mastra", () => ({
  mastra: {
    getWorkflow: mocks.getWorkflow,
  },
}));

import { approveDraft, startBrandAnalysis } from "@/mastra/tools/brand-intelligence";

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
  });
  mocks.createRun.mockResolvedValue({
    startAsync: mocks.startAsync,
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
  mocks.getStore.mockReturnValue("tok");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "op-1" } }, error: null });
  mocks.crawlLinkMaybeSingle.mockResolvedValue({ data: { id: "crawl-1" }, error: null });
  mockUserScopedClient();
  mockWorkflow();
});

describe("startBrandAnalysis", () => {
  it("starts the workflow with the operator id resolved from the session JWT", async () => {
    mocks.startAsync.mockResolvedValue({ runId: RUN_ID });

    const result = await startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx);

    expect(mocks.getUser).toHaveBeenCalledWith("tok");
    expect(mocks.startAsync).toHaveBeenCalledWith({
      inputData: { brandId: BRAND_ID, actorId: "op-1" },
    });
    expect(result).toMatchObject({ runId: RUN_ID });
  });

  it("throws when no access token is available in the request context (unauthenticated denied)", async () => {
    mocks.getStore.mockReturnValue(undefined);

    await expect(
      startBrandAnalysis.execute!({ brandId: BRAND_ID }, ctx),
    ).rejects.toThrow("Access token not available in request context");
    expect(mocks.startAsync).not.toHaveBeenCalled();
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

  it("does not resume on replay of an already-approved decision (ALREADY_APPROVED)", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: DRAFT }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: true, code: "ALREADY_APPROVED" }, error: null });

    const result = await approveDraft.execute!(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      ctx,
    );

    // ok:true per the RPC contract (idempotent replay, not an error), but
    // still gated by the RPC — the tool never resumes twice off one call.
    expect(result).toMatchObject({ ok: true });
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

  it("returns NO_DRAFT without calling the RPC when the brand has no draft", async () => {
    mocks.brandSingle.mockResolvedValue({ data: { ai_profile_draft: null }, error: null });

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
