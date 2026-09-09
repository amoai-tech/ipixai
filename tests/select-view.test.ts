import { describe, expect, it } from "vitest";

import { selectBrandDetailView } from "@/app/app/brands/[brandId]/select-view";
import type { BrandProfile } from "@/lib/brand/brand-profile-contract";

// IPI-1093 · BRAND-INTEL-001 — regression for a real bug found in review:
// a draft that exists but fails schema validation has `draft: null` and a
// non-null `draftHash` (get_brand_draft_hash hashes raw JSON, independent
// of schema validity). The page previously checked `draftHash === null` to
// detect this case, which is always false here, so it fell through to
// "no analysis" — misleading the operator. See src/app/app/brands/[brandId]/select-view.ts.

const FAKE_DRAFT = { schemaVersion: 2 } as unknown as BrandProfile;

describe("selectBrandDetailView", () => {
  it("review: draft parsed and hashed", () => {
    const view = selectBrandDetailView({
      draft: FAKE_DRAFT,
      draftHash: "H1",
      approvedProfileAt: null,
      intakeStatus: "draft_ready",
    });
    expect(view).toBe("review");
  });

  it("CRITICAL: parse_error — draft exists (hashed) but failed schema validation, must NOT fall through to no_analysis", () => {
    const view = selectBrandDetailView({
      draft: null,
      draftHash: "H1-still-computed",
      approvedProfileAt: null,
      intakeStatus: "draft_ready",
    });
    expect(view).toBe("parse_error");
  });

  it("parse_error takes priority even if intake_status has drifted away from draft_ready", () => {
    // The old buggy condition also required intake_status === "draft_ready";
    // the fix depends only on draftHash/draft, so a stale/mismatched status
    // still surfaces the error instead of silently hiding it.
    const view = selectBrandDetailView({
      draft: null,
      draftHash: "H1",
      approvedProfileAt: null,
      intakeStatus: "brand_created",
    });
    expect(view).toBe("parse_error");
  });

  it("no_analysis: no draft at all (draftHash correctly stays null)", () => {
    const view = selectBrandDetailView({
      draft: null,
      draftHash: null,
      approvedProfileAt: null,
      intakeStatus: "brand_created",
    });
    expect(view).toBe("no_analysis");
  });

  it("approved: no pending draft, approved profile exists", () => {
    const view = selectBrandDetailView({
      draft: null,
      draftHash: null,
      approvedProfileAt: "2026-01-01T00:00:00Z",
      intakeStatus: "ready",
    });
    expect(view).toBe("approved");
  });

  it("review takes priority over approved when a new draft exists for an already-approved brand", () => {
    const view = selectBrandDetailView({
      draft: FAKE_DRAFT,
      draftHash: "H2",
      approvedProfileAt: "2026-01-01T00:00:00Z",
      intakeStatus: "draft_ready",
    });
    expect(view).toBe("review");
  });

  it("running: crawl/analysis in progress", () => {
    for (const status of ["crawl_running", "crawl_complete", "analysis_running", "scores_complete"]) {
      expect(
        selectBrandDetailView({
          draft: null,
          draftHash: null,
          approvedProfileAt: null,
          intakeStatus: status as never,
        }),
      ).toBe("running");
    }
  });

  it("failed: last run did not complete", () => {
    const view = selectBrandDetailView({
      draft: null,
      draftHash: null,
      approvedProfileAt: null,
      intakeStatus: "failed",
    });
    expect(view).toBe("failed");
  });
});
