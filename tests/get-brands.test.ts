import { describe, expect, it, vi } from "vitest";

import {
  brandStatusDotToken,
  brandStatusLabel,
  countOrgBrands,
  listBrandsForOrg,
} from "@/lib/brand/get-brands";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** Chainable, thenable query-builder stub matching the subset of the
 *  Supabase client surface `listBrandsForOrg`/`countOrgBrands` call —
 *  unlike `loadBrandDetail`'s query (tests/get-brand-detail.test.ts), these
 *  resolve the builder itself (no terminal `.maybeSingle()`), so the stub
 *  must be thenable. */
function makeSupabaseStub(resolved: { data?: unknown; error?: unknown; count?: number | null }) {
  const eqCalls: unknown[][] = [];
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((...args: unknown[]) => {
      eqCalls.push(args);
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (
      resolve: (value: { data?: unknown; error?: unknown; count?: number | null }) => unknown,
    ) => Promise.resolve(resolved).then(resolve),
  };
  const supabase = { from: vi.fn(() => builder) };
  // biome-ignore lint: test double, not a real SupabaseClient
  return { supabase: supabase as any, eqCalls };
}

describe("listBrandsForOrg", () => {
  it("scopes the query to the given org_id", async () => {
    const { supabase, eqCalls } = makeSupabaseStub({ data: [], error: null });
    await listBrandsForOrg(supabase, ORG_A);
    expect(eqCalls).toEqual([["org_id", ORG_A]]);
  });

  it("maps rows and reports hasMore: false when under the limit", async () => {
    const { supabase } = makeSupabaseStub({
      data: [
        {
          id: "b1",
          name: "Maison Solène",
          brand_url: "https://example.com",
          intake_status: "draft_ready",
          approved_profile_at: null,
        },
      ],
      error: null,
    });
    const result = await listBrandsForOrg(supabase, ORG_A);
    expect(result).toEqual({
      ok: true,
      hasMore: false,
      brands: [
        {
          id: "b1",
          name: "Maison Solène",
          brandUrl: "https://example.com",
          intakeStatus: "draft_ready",
          approvedProfileAt: null,
        },
      ],
    });
  });

  it("falls back to 'Untitled brand' for a null name", async () => {
    const { supabase } = makeSupabaseStub({
      data: [
        {
          id: "b1",
          name: null,
          brand_url: null,
          intake_status: "brand_created",
          approved_profile_at: null,
        },
      ],
      error: null,
    });
    const result = await listBrandsForOrg(supabase, ORG_A);
    expect(result.ok && result.brands[0].name).toBe("Untitled brand");
  });

  it("reports hasMore: true and trims to the limit-sized page, never silently dropping the signal", async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({
      id: `b${i}`,
      name: `Brand ${i}`,
      brand_url: null,
      intake_status: "brand_created" as const,
      approved_profile_at: null,
    }));
    const { supabase } = makeSupabaseStub({ data: rows, error: null });
    const result = await listBrandsForOrg(supabase, ORG_A);
    expect(result.ok && result.hasMore).toBe(true);
    expect(result.ok && result.brands).toHaveLength(200);
  });

  it("fails closed (ok: false) on a query error, never a partial/fabricated result", async () => {
    const { supabase } = makeSupabaseStub({ data: null, error: new Error("boom") });
    const result = await listBrandsForOrg(supabase, ORG_A);
    expect(result).toEqual({ ok: false });
  });
});

describe("countOrgBrands", () => {
  it("scopes the count to the given org_id and returns it", async () => {
    const { supabase, eqCalls } = makeSupabaseStub({ count: 7, error: null });
    const result = await countOrgBrands(supabase, ORG_A);
    expect(eqCalls).toEqual([["org_id", ORG_A]]);
    expect(result).toEqual({ ok: true, count: 7 });
  });

  it("fails closed on a query error", async () => {
    const { supabase } = makeSupabaseStub({ count: null, error: new Error("boom") });
    const result = await countOrgBrands(supabase, ORG_A);
    expect(result).toEqual({ ok: false });
  });
});

describe("brandStatusLabel", () => {
  it("shows Approved whenever approvedProfileAt is set, regardless of intake_status", () => {
    expect(brandStatusLabel("brand_created", "2026-09-10T00:00:00.000Z")).toBe("Approved");
    expect(brandStatusLabel("scores_complete", "2026-09-10T00:00:00.000Z")).toBe("Approved");
  });

  it("maps every non-approved intake_status to an honest label", () => {
    expect(brandStatusLabel("brand_created", null)).toBe("Not analyzed yet");
    expect(brandStatusLabel("crawl_running", null)).toBe("Crawling site");
    expect(brandStatusLabel("crawl_complete", null)).toBe("Crawl complete");
    expect(brandStatusLabel("analysis_running", null)).toBe("Analyzing");
    expect(brandStatusLabel("scores_complete", null)).toBe("Scored");
    expect(brandStatusLabel("draft_ready", null)).toBe("Draft ready for review");
    expect(brandStatusLabel("ready", null)).toBe("Ready");
    expect(brandStatusLabel("failed", null)).toBe("Analysis failed");
  });
});

describe("brandStatusDotToken", () => {
  it("uses the approved token whenever approvedProfileAt is set", () => {
    expect(brandStatusDotToken("failed", "2026-09-10T00:00:00.000Z")).toBe(
      "var(--color-approved, #22c55e)",
    );
  });

  it("uses the destructive token for a failed, unapproved brand", () => {
    expect(brandStatusDotToken("failed", null)).toBe("var(--color-destructive, #ef4444)");
  });
});
