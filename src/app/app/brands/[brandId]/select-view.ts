import type { BrandDetail } from "@/lib/brand/get-brand-detail";

/**
 * IPI-1093 · BRAND-INTEL-001 — Brand Detail state selection, extracted from
 * page.tsx as a pure function so this branching is unit-testable without
 * rendering the (async, server-only) page component.
 *
 * Bug this exists to prevent recurring: `draftHash` is computed from
 * `ai_profile_draft` independently of whether that JSON parses into the
 * current profile schema (get_brand_draft_hash just hashes raw JSON — it
 * doesn't validate shape). A malformed/legacy-shape draft therefore has
 * `draft: null` but a non-null `draftHash`. Checking `draftHash === null`
 * to detect "draft present but unparseable" is always false for that case,
 * so the page fell through to "no analysis" instead of showing an error —
 * misleading an operator into thinking nothing had ever run. The correct
 * signal is `draftHash !== null && draft === null`.
 */

export const RUNNING_STATUSES = new Set([
  "crawl_running",
  "crawl_complete",
  "analysis_running",
  "scores_complete",
]);

export type BrandDetailView =
  | "review"
  | "parse_error"
  | "approved"
  | "running"
  | "failed"
  | "no_analysis";

export function selectBrandDetailView(
  detail: Pick<BrandDetail, "draft" | "draftHash" | "approvedProfileAt" | "intakeStatus">,
): BrandDetailView {
  // Priority: an actionable draft always takes precedence — including when
  // a re-run produced a new draft for an already-approved brand.
  if (detail.draft && detail.draftHash) return "review";
  if (detail.draftHash !== null && detail.draft === null) return "parse_error";
  if (detail.approvedProfileAt) return "approved";
  if (RUNNING_STATUSES.has(detail.intakeStatus)) return "running";
  if (detail.intakeStatus === "failed") return "failed";
  return "no_analysis";
}
