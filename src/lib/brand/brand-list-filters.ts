import type { BrandListItem } from "./get-brands";

/**
 * IPI-1068 · BRAND-001 — pure Brand browse search/filter vocabulary. No
 * Supabase, no React — `brands-search-filter.tsx` is the only caller.
 * Filtering runs client-side over the already-fetched page
 * (`listBrandsForOrg`'s bounded read, see its own ponytail note) — correct
 * for today's org sizes; move to server-side filtering if `hasMore` starts
 * showing up for real orgs.
 */

export type BrandStatusFilter = "all" | "approved" | "draft" | "analyzing" | "failed";

export const BRAND_STATUS_FILTERS: { value: BrandStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "analyzing", label: "Analyzing" },
  { value: "failed", label: "Failed" },
];

/**
 * Every `brand_intake_status` enum value must land in exactly one bucket
 * below (besides `approved`, which overrides on `approvedProfileAt`) — a
 * status reachable only through "All" is a dead filter. Confirmed against
 * live production (2026-09-11): 8 brand_created + 3 crawl_complete, 0
 * elsewhere — the original mapping only matched draft_ready/crawl_running/
 * analysis_running, so every non-"All" chip returned zero brands against
 * real data despite passing tests that only checked narrowing, not
 * coverage. `ready`/`scores_complete` are folded into `analyzing` (still
 * in the pipeline, not failed, not approved) rather than left orphaned;
 * `scores_complete` specifically is also the status the now-retired
 * IPI-1186 legacy direct-write path used to set.
 */
export function matchesBrandStatusFilter(
  brand: BrandListItem,
  filter: BrandStatusFilter,
): boolean {
  if (filter === "all") return true;
  if (brand.approvedProfileAt !== null) return filter === "approved";
  switch (filter) {
    case "approved":
      return false;
    case "draft":
      return brand.intakeStatus === "brand_created" || brand.intakeStatus === "draft_ready";
    case "analyzing":
      return (
        brand.intakeStatus === "crawl_running" ||
        brand.intakeStatus === "crawl_complete" ||
        brand.intakeStatus === "analysis_running" ||
        brand.intakeStatus === "scores_complete" ||
        brand.intakeStatus === "ready"
      );
    case "failed":
      return brand.intakeStatus === "failed";
    default:
      return true;
  }
}

export function matchesBrandQuery(brand: BrandListItem, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  if (brand.name.toLowerCase().includes(trimmed)) return true;
  return brand.brandUrl ? brand.brandUrl.toLowerCase().includes(trimmed) : false;
}

export function filterBrands(
  brands: BrandListItem[],
  options: { query: string; statusFilter: BrandStatusFilter },
): BrandListItem[] {
  return brands.filter(
    (brand) =>
      matchesBrandQuery(brand, options.query) &&
      matchesBrandStatusFilter(brand, options.statusFilter),
  );
}
