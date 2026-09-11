import type { BrandListItem } from "./get-brands";

/**
 * IPI-1068 · BRAND-001 — pure Brand browse search/filter vocabulary. No
 * Supabase, no React — `brands-search-filter.tsx` is the only caller.
 * Filtering runs client-side over the already-fetched page
 * (`listBrandsForOrg`'s bounded read, see its own ponytail note) — correct
 * for today's org sizes; move to server-side filtering if `hasMore` starts
 * showing up for real orgs.
 */

export type BrandStatusFilter = "all" | "approved" | "draft_ready" | "analyzing" | "failed";

export const BRAND_STATUS_FILTERS: { value: BrandStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "draft_ready", label: "Draft" },
  { value: "analyzing", label: "Analyzing" },
  { value: "failed", label: "Failed" },
];

export function matchesBrandStatusFilter(
  brand: BrandListItem,
  filter: BrandStatusFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "approved":
      return brand.approvedProfileAt !== null;
    case "draft_ready":
      return brand.approvedProfileAt === null && brand.intakeStatus === "draft_ready";
    case "analyzing":
      return (
        brand.approvedProfileAt === null &&
        (brand.intakeStatus === "crawl_running" || brand.intakeStatus === "analysis_running")
      );
    case "failed":
      return brand.approvedProfileAt === null && brand.intakeStatus === "failed";
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
