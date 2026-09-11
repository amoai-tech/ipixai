import { describe, expect, it } from "vitest";

import { loadBrandDetail } from "@/lib/brand/get-brand-detail";

const BRAND_ID = "11111111-1111-1111-1111-111111111111";

const VALID_DRAFT = {
  schemaVersion: 2,
  name: "Acme",
  tagline: { value: "T", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  category: { value: "C", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  targetAudience: { value: "A", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  visualIdentity: { colors: ["#fff"], mood: "m" },
  sourceUrl: "https://acme.co",
  scores: { visual: 80, audience: 70, consistency: 60, commerce_readiness: 50 },
  _draft_scores: [{ score_type: "visual", score: 80 }],
  _workflow_run_id: "run-1",
};

const DEFAULT_BRAND_ROW = {
  id: BRAND_ID,
  name: "Acme",
  org_id: "org-1",
  brand_url: "https://acme.co",
  intake_status: "draft_ready",
  ai_profile: {},
  approved_profile_at: null,
};

function fakeSupabase({
  brandRow,
  brandError = null,
  snapshot = { draft: null, hash: null },
  snapshotError = null,
}: {
  brandRow: Record<string, unknown> | null;
  brandError?: unknown;
  snapshot?: { draft: unknown; hash: string | null } | null;
  snapshotError?: unknown;
}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: brandRow, error: brandError }),
        }),
      }),
    }),
    rpc: async () => ({ data: snapshot, error: snapshotError }),
    // biome-ignore lint: test double, not a real SupabaseClient
  } as any;
}

describe("loadBrandDetail", () => {
  it("returns not_found when RLS filters the row out (foreign-org brand)", async () => {
    const result = await loadBrandDetail(fakeSupabase({ brandRow: null }), BRAND_ID);
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns error on a brand query failure rather than a misleading empty state", async () => {
    const result = await loadBrandDetail(
      fakeSupabase({ brandRow: null, brandError: { message: "connection reset" } }),
      BRAND_ID,
    );
    expect(result).toEqual({ status: "error" });
  });

  it("returns error when the draft snapshot RPC fails, rather than silently rendering no-draft", async () => {
    const result = await loadBrandDetail(
      fakeSupabase({ brandRow: DEFAULT_BRAND_ROW, snapshotError: { message: "rpc timeout" } }),
      BRAND_ID,
    );
    expect(result).toEqual({ status: "error" });
  });

  it("loads a valid draft with its server-computed hash and extracted scores, from ONE atomic snapshot", async () => {
    const result = await loadBrandDetail(
      fakeSupabase({
        brandRow: DEFAULT_BRAND_ROW,
        snapshot: { draft: VALID_DRAFT, hash: "H1-computed" },
      }),
      BRAND_ID,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.draft?.name).toBe("Acme");
    expect(result.detail.draftHash).toBe("H1-computed");
    expect(result.detail.draftScores).toEqual([
      expect.objectContaining({ score_type: "visual", score: 80 }),
    ]);
  });

  it("CRITICAL: draft content and its hash always come from the same snapshot call — closes the two-read race where a mutation between reads could bind an operator's approval to unreviewed content", async () => {
    // A single supabase.rpc() mock backs both values here; there is no
    // code path left in loadBrandDetail that could observe the draft from
    // one moment and the hash from another.
    let rpcCallCount = 0;
    const supabase = fakeSupabase({ brandRow: DEFAULT_BRAND_ROW });
    supabase.rpc = async () => {
      rpcCallCount += 1;
      return { data: { draft: VALID_DRAFT, hash: "H1-atomic" }, error: null };
    };

    const result = await loadBrandDetail(supabase, BRAND_ID);

    expect(rpcCallCount).toBe(1);
    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.draft?.name).toBe("Acme");
    expect(result.detail.draftHash).toBe("H1-atomic");
  });

  it("degrades a malformed draft to null instead of throwing (page must not crash) — and still hashes it, since the snapshot RPC hashes raw JSON regardless of schema validity", async () => {
    // This combination (draft: null, draftHash: non-null) is exactly the
    // state that previously broke the page's branching — see
    // select-view.test.ts for the regression on that logic.
    const result = await loadBrandDetail(
      fakeSupabase({
        brandRow: DEFAULT_BRAND_ROW,
        snapshot: { draft: { totally: "not a brand profile" }, hash: "H1-still-computed" },
      }),
      BRAND_ID,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.draft).toBeNull();
    expect(result.detail.draftHash).toBe("H1-still-computed");
    expect(result.detail.draftScores).toEqual([]);
  });

  it("no draft: snapshot returns {draft: null, hash: null}, detail reflects both as null", async () => {
    const result = await loadBrandDetail(
      fakeSupabase({
        brandRow: { ...DEFAULT_BRAND_ROW, intake_status: "brand_created" },
        snapshot: { draft: null, hash: null },
      }),
      BRAND_ID,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.draft).toBeNull();
    expect(result.detail.draftHash).toBeNull();
    expect(result.detail.draftScores).toEqual([]);
  });

  it("CRITICAL (IPI-1093 blocker #4): a schema-valid draft missing _workflow_run_id — the exact shape brand-intelligence writes BEFORE Mastra's saveDraftAndWait step attaches it — must render as 'no draft yet', not 'review'. approve_brand_intelligence_draft rejects a run-id-less draft as INVALID_DRAFT, so showing Approve for it would always fail.", async () => {
    const { _workflow_run_id: _omit, ...draftWithoutRunId } = VALID_DRAFT;
    const result = await loadBrandDetail(
      fakeSupabase({
        brandRow: { ...DEFAULT_BRAND_ROW, intake_status: "scores_complete" },
        snapshot: { draft: draftWithoutRunId, hash: "H1-pending-provenance" },
      }),
      BRAND_ID,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    // Both null (not just draft) — a lone non-null draftHash would make
    // select-view.ts render parse_error, an operator-facing error state,
    // for a brand that is simply still processing normally.
    expect(result.detail.draft).toBeNull();
    expect(result.detail.draftHash).toBeNull();
    expect(result.detail.draftScores).toEqual([]);
  });

  it("PR review finding: runId present but intake_status still 'scores_complete' — the ms-wide window between Mastra attaching the run id and setting draft_ready — must still render as no-draft, not review", async () => {
    const result = await loadBrandDetail(
      fakeSupabase({
        brandRow: { ...DEFAULT_BRAND_ROW, intake_status: "scores_complete" },
        snapshot: { draft: VALID_DRAFT, hash: "H1-runid-not-yet-draft-ready" },
      }),
      BRAND_ID,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.draft).toBeNull();
    expect(result.detail.draftHash).toBeNull();
  });

  it("PR review finding: runId present AND intake_status 'draft_ready' reviews normally", async () => {
    const result = await loadBrandDetail(
      fakeSupabase({
        brandRow: { ...DEFAULT_BRAND_ROW, intake_status: "draft_ready" },
        snapshot: { draft: VALID_DRAFT, hash: "H1-fully-ready" },
      }),
      BRAND_ID,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.draft?.name).toBe("Acme");
    expect(result.detail.draftHash).toBe("H1-fully-ready");
  });

  it("a schema-valid draft WITH _workflow_run_id still reviews normally (the fix must not gate every draft, only the pre-provenance window)", async () => {
    const result = await loadBrandDetail(
      fakeSupabase({
        brandRow: DEFAULT_BRAND_ROW,
        snapshot: { draft: VALID_DRAFT, hash: "H1-ready" },
      }),
      BRAND_ID,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.draft?.name).toBe("Acme");
    expect(result.detail.draftHash).toBe("H1-ready");
  });
});
