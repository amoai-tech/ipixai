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

  it("an approved brand does not also match draft/analyzing/failed", () => {
    const approved = brand({ intakeStatus: "draft_ready", approvedProfileAt: "2026-09-10T00:00:00Z" });
    expect(matchesBrandStatusFilter(approved, "draft_ready")).toBe(false);
  });

  it("'draft_ready' matches unapproved brands with intake_status draft_ready", () => {
    expect(matchesBrandStatusFilter(brand({ intakeStatus: "draft_ready" }), "draft_ready")).toBe(
      true,
    );
    expect(matchesBrandStatusFilter(brand({ intakeStatus: "brand_created" }), "draft_ready")).toBe(
      false,
    );
  });

  it("'analyzing' matches crawl_running and analysis_running", () => {
    expect(
      matchesBrandStatusFilter(brand({ intakeStatus: "crawl_running" }), "analyzing"),
    ).toBe(true);
    expect(
      matchesBrandStatusFilter(brand({ intakeStatus: "analysis_running" }), "analyzing"),
    ).toBe(true);
    expect(matchesBrandStatusFilter(brand({ intakeStatus: "draft_ready" }), "analyzing")).toBe(
      false,
    );
  });

  it("'failed' matches only unapproved brands with intake_status failed", () => {
    expect(matchesBrandStatusFilter(brand({ intakeStatus: "failed" }), "failed")).toBe(true);
    expect(matchesBrandStatusFilter(brand({ intakeStatus: "brand_created" }), "failed")).toBe(
      false,
    );
  });
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
