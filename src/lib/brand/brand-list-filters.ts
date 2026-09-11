import type { BrandListItem } from "./get-brands";

/**
 * IPI-1068 · BRAND-001 — pure Brand browse search/filter/sort vocabulary. No
 * Supabase, no React — `brands-search-filter.tsx` is the only caller.
 * Filtering/sorting runs client-side over the already-fetched page
 * (`listBrandsForOrg`'s bounded read, see its own ponytail note) — correct
 * for today's org sizes; move server-side if `hasMore` starts showing up
 * for real orgs.
 */

export type BrandStatusFilter = "all" | "approved" | "draft" | "analyzing" | "ready" | "failed";

export const BRAND_STATUS_FILTERS: { value: BrandStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "analyzing", label: "Analyzing" },
  { value: "ready", label: "Ready" },
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
 * coverage.
 *
 * `ready` is its own bucket, not folded into `analyzing`: it's a terminal/
 * legacy pre-approval state (see `brandStatusLabel`'s distinct "Ready"
 * label), not still-running work, and `approved` is the separate governed
 * truth backed by `approvedProfileAt` — the two must stay visually and
 * filterably distinct so an operator can't mistake "ready" for "approved".
 * `scores_complete` stays in `analyzing` (pre-review/in-progress) — it is
 * not redefined to `ready` without explicit product evidence; it's also
 * the status the now-retired IPI-1186 legacy direct-write path used to set.
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
        brand.intakeStatus === "scores_complete"
      );
    case "ready":
      return brand.intakeStatus === "ready";
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

export type BrandSortOption = "newest" | "name-asc" | "name-desc";

export const BRAND_SORT_OPTIONS: { value: BrandSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

/**
 * `listBrandsForOrg` already orders `created_at desc, id asc` server-side,
 * so "newest" is just the array's existing order — no `createdAt` field
 * needed on `BrandListItem` for it. Name sorts use `toSorted` (immutable,
 * doesn't mutate the already-filtered array) with a locale-aware compare so
 * "Atelier" vs "Éclat" sorts the way an operator expects.
 */
export function sortBrands(brands: BrandListItem[], sort: BrandSortOption): BrandListItem[] {
  switch (sort) {
    case "name-asc":
      return brands.toSorted((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return brands.toSorted((a, b) => b.name.localeCompare(a.name));
    case "newest":
    default:
      return brands;
  }
}
