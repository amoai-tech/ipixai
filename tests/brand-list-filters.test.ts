import { describe, expect, it } from "vitest";

import {
  filterBrands,
  matchesBrandQuery,
  matchesBrandStatusFilter,
} from "@/lib/brand/brand-list-filters";
import type { BrandListItem } from "@/lib/brand/get-brands";

function brand(overrides: Partial<BrandListItem>): BrandListItem {
  return {
    id: "b1",
    name: "Maison Solène",
    brandUrl: "https://maisonsolene.example.com",
    intakeStatus: "brand_created",
    approvedProfileAt: null,
    ...overrides,
  };
}

describe("matchesBrandQuery", () => {
  it("matches on name, case-insensitively", () => {
    expect(matchesBrandQuery(brand({}), "solène")).toBe(true);
    expect(matchesBrandQuery(brand({}), "SOLÈNE")).toBe(true);
  });

  it("matches on brand_url", () => {
    expect(matchesBrandQuery(brand({}), "maisonsolene")).toBe(true);
  });

  it("returns true for an empty/whitespace query (no filter applied)", () => {
    expect(matchesBrandQuery(brand({}), "")).toBe(true);
    expect(matchesBrandQuery(brand({}), "   ")).toBe(true);
  });

  it("returns false for a non-matching query", () => {
    expect(matchesBrandQuery(brand({}), "acme")).toBe(false);
  });

  it("does not throw or match on a null brand_url", () => {
    expect(matchesBrandQuery(brand({ brandUrl: null }), "example")).toBe(false);
  });
});

describe("matchesBrandStatusFilter", () => {
  it("'all' matches every brand regardless of status", () => {
    expect(matchesBrandStatusFilter(brand({ intakeStatus: "failed" }), "all")).toBe(true);
  });

  it("'approved' matches only when approvedProfileAt is set, regardless of intake_status", () => {
    const b = brand({ intakeStatus: "brand_created", approvedProfileAt: "2026-09-10T00:00:00Z" });
    expect(matchesBrandStatusFilter(b, "approved")).toBe(true);
    expect(matchesBrandStatusFilter(brand({}), "approved")).toBe(false);
  });

  it("an approved brand matches only 'approved' — not draft/analyzing/failed, even if its old intake_status would otherwise", () => {
    for (const intakeStatus of ["brand_created", "draft_ready", "crawl_complete", "failed"] as const) {
      const approved = brand({ intakeStatus, approvedProfileAt: "2026-09-10T00:00:00Z" });
      for (const filter of ["draft", "analyzing", "failed"] as const) {
        expect(matchesBrandStatusFilter(approved, filter)).toBe(false);
      }
    }
  });

  // Every brand_intake_status enum value must land in exactly one bucket —
  // the regression this catches: a status reachable only through "All"
  // silently makes its filter chip dead. Live production (2026-09-11) has
  // 8 brand_created + 3 crawl_complete and 0 of every other status — this
  // table would have failed loudly against that data before the fix, where
  // the old mapping only matched draft_ready/crawl_running/analysis_running.
  const EXPECTED_BUCKET: Record<string, "draft" | "analyzing" | "failed"> = {
    brand_created: "draft",
    draft_ready: "draft",
    crawl_running: "analyzing",
    crawl_complete: "analyzing",
    analysis_running: "analyzing",
    scores_complete: "analyzing",
    ready: "analyzing",
    failed: "failed",
  };

  it.each(Object.entries(EXPECTED_BUCKET))(
    "unapproved intake_status %s matches only its expected bucket ('%s')",
    (intakeStatus, expectedBucket) => {
      const b = brand({ intakeStatus: intakeStatus as BrandListItem["intakeStatus"] });
      for (const filter of ["draft", "analyzing", "failed"] as const) {
        expect(
          matchesBrandStatusFilter(b, filter),
          `intake_status=${intakeStatus} vs filter=${filter}`,
        ).toBe(filter === expectedBucket);
      }
    },
  );
});

describe("filterBrands", () => {
  const brands = [
    brand({ id: "b1", name: "Maison Solène", intakeStatus: "draft_ready" }),
    brand({ id: "b2", name: "Atelier Rive", brandUrl: null, intakeStatus: "failed" }),
    brand({
      id: "b3",
      name: "Nova Studio",
      brandUrl: null,
      approvedProfileAt: "2026-09-10T00:00:00Z",
    }),
  ];

  it("applies query and status filter together (AND, not OR)", () => {
    const result = filterBrands(brands, { query: "Maison", statusFilter: "failed" });
    expect(result).toHaveLength(0);
  });

  it("returns all brands for an empty query and 'all' filter", () => {
    expect(filterBrands(brands, { query: "", statusFilter: "all" })).toHaveLength(3);
  });

  it("narrows to the matching subset", () => {
    const result = filterBrands(brands, { query: "", statusFilter: "failed" });
    expect(result.map((b) => b.id)).toEqual(["b2"]);
  });
});
