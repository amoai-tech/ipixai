import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * IPI-1068 · BRAND-001 — `/app/brands` browse list data layer.
 *
 * Mirrors `loadOrgBrands` (src/lib/dashboard/command-center.ts) — same
 * explicit `.eq("org_id", trustedOrgId)` + deterministic
 * `created_at desc, id asc` ordering — but returns the additional fields
 * the full browse page needs (status, url, approval) instead of the
 * dashboard hero's `{ id, name }` pair, and is not capped to 6 rows.
 *
 * ponytail: a single bounded read (BRAND_LIST_LIMIT), not full keyset
 * pagination like `loadTrustedBrandIds`. Every real org currently has a
 * handful of brands (production max seen: single digits), so a page-1-only
 * read is enough today. `hasMore` is still surfaced rather than silently
 * dropped, so this is a visible "there's more, add pagination" signal
 * instead of a silent truncation bug if that changes.
 */

const BRAND_LIST_LIMIT = 200;

export type BrandListItem = {
  id: string;
  name: string;
  brandUrl: string | null;
  intakeStatus: Database["public"]["Enums"]["brand_intake_status"];
  approvedProfileAt: string | null;
};

export type BrandListResult =
  | { ok: true; brands: BrandListItem[]; hasMore: boolean }
  | { ok: false };

export async function listBrandsForOrg(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<BrandListResult> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, brand_url, intake_status, approved_profile_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(BRAND_LIST_LIMIT + 1);

  if (error || !data) {
    console.error("brand.listBrandsForOrg: query failed", { orgId, error });
    return { ok: false };
  }

  const hasMore = data.length > BRAND_LIST_LIMIT;
  const rows = hasMore ? data.slice(0, BRAND_LIST_LIMIT) : data;

  return {
    ok: true,
    hasMore,
    brands: rows.map((row) => ({
      id: row.id,
      name: row.name ?? "Untitled brand",
      brandUrl: row.brand_url,
      intakeStatus: row.intake_status,
      approvedProfileAt: row.approved_profile_at,
    })),
  };
}

export async function countOrgBrands(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<{ ok: true; count: number } | { ok: false }> {
  const { count, error } = await supabase
    .from("brands")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if (error || count === null) {
    console.error("brand.countOrgBrands: query failed", { orgId, error });
    return { ok: false };
  }
  return { ok: true, count };
}

/** Status label + dot token for the browse card / header. Honest states
 *  only — no invented "Active"/"Approved" label from score presence. */
export function brandStatusLabel(
  status: Database["public"]["Enums"]["brand_intake_status"],
  approvedProfileAt: string | null,
): string {
  if (approvedProfileAt) return "Approved";
  switch (status) {
    case "brand_created":
      return "Not analyzed yet";
    case "crawl_running":
      return "Crawling site";
    case "crawl_complete":
      return "Crawl complete";
    case "analysis_running":
      return "Analyzing";
    case "scores_complete":
      return "Scored";
    case "draft_ready":
      return "Draft ready for review";
    case "ready":
      return "Ready";
    case "failed":
      return "Analysis failed";
    default:
      return status;
  }
}

export function brandStatusDotToken(
  status: Database["public"]["Enums"]["brand_intake_status"],
  approvedProfileAt: string | null,
): string {
  if (approvedProfileAt) return "var(--color-approved, #22c55e)";
  if (status === "failed") return "var(--color-destructive, #ef4444)";
  if (status === "analysis_running" || status === "crawl_running") {
    return "var(--color-info, #3b82f6)";
  }
  if (status === "draft_ready") return "var(--color-warning-text, #b45309)";
  return "var(--color-text-muted, #71717a)";
}
