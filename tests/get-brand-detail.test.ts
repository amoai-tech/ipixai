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

function fakeSupabase({
  brandRow,
  brandError = null,
  hash = "H1",
  hashError = null,
}: {
  brandRow: Record<string, unknown> | null;
  brandError?: unknown;
  hash?: string | null;
  hashError?: unknown;
}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: brandRow, error: brandError }),
        }),
      }),
    }),
    rpc: async () => ({ data: hash, error: hashError }),
    // biome-ignore lint: test double, not a real SupabaseClient
  } as any;
}

describe("loadBrandDetail", () => {
  it("returns not_found when RLS filters the row out (foreign-org brand)", async () => {
    const result = await loadBrandDetail(fakeSupabase({ brandRow: null }), BRAND_ID);
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns error on a query failure rather than a misleading empty state", async () => {
    const result = await loadBrandDetail(
      fakeSupabase({ brandRow: null, brandError: { message: "connection reset" } }),
      BRAND_ID,
    );
    expect(result).toEqual({ status: "error" });
  });

  it("loads a valid draft with its server-computed hash and extracted scores", async () => {
    const result = await loadBrandDetail(
      fakeSupabase({
        brandRow: {
          id: BRAND_ID,
          name: "Acme",
          org_id: "org-1",
          brand_url: "https://acme.co",
          intake_status: "draft_ready",
          ai_profile: {},
          ai_profile_draft: VALID_DRAFT,
          approved_profile_at: null,
        },
        hash: "H1-computed",
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

  it("degrades a malformed draft to null instead of throwing (page must not crash) — and still hashes it, since get_brand_draft_hash hashes raw JSON regardless of schema validity", async () => {
    // This combination (draft: null, draftHash: non-null) is exactly the
    // state that previously broke the page's branching — see
    // select-view.test.ts for the regression on that logic.
    const result = await loadBrandDetail(
      fakeSupabase({
        brandRow: {
          id: BRAND_ID,
          name: "Acme",
          org_id: "org-1",
          brand_url: "https://acme.co",
          intake_status: "draft_ready",
          ai_profile: {},
          ai_profile_draft: { totally: "not a brand profile" },
          approved_profile_at: null,
        },
        hash: "H1-still-computed",
      }),
      BRAND_ID,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.draft).toBeNull();
    expect(result.detail.draftHash).toBe("H1-still-computed");
    expect(result.detail.draftScores).toEqual([]);
  });

  it("does not call get_brand_draft_hash when there is no draft", async () => {
    let rpcCalled = false;
    const supabase = fakeSupabase({
      brandRow: {
        id: BRAND_ID,
        name: "Acme",
        org_id: "org-1",
        brand_url: "https://acme.co",
        intake_status: "brand_created",
        ai_profile: {},
        ai_profile_draft: null,
        approved_profile_at: null,
      },
    });
    supabase.rpc = async () => {
      rpcCalled = true;
      return { data: null, error: null };
    };

    const result = await loadBrandDetail(supabase, BRAND_ID);

    expect(rpcCalled).toBe(false);
    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.draftHash).toBeNull();
  });
});
