import type { SupabaseClient } from "@supabase/supabase-js";

import {
  brandProfileSchema,
  extractDraftScores,
  type BrandDraftScore,
  type BrandProfile,
} from "@/lib/brand/brand-profile-contract";
import type { Database } from "@/lib/supabase/database.types";

/**
 * IPI-1093 · BRAND-INTEL-001 — Brand Detail durable-state data layer.
 *
 * Public-contract-first, matching the shoot detail pattern: RLS on
 * `public.brands` (`brands_select_org`) is the authorization boundary — a
 * foreign-org brand id simply returns no row, never a distinguishable
 * error, so existence is never leaked. `get_brand_draft_hash` is called
 * server-side only; the browser never recomputes or is trusted to supply
 * the reviewed-artifact hash (see approveDraft's exact-artifact contract).
 */

export type BrandDetail = {
  id: string;
  name: string;
  orgId: string;
  brandUrl: string | null;
  intakeStatus: Database["public"]["Enums"]["brand_intake_status"];
  approvedProfile: BrandProfile | null;
  approvedProfileAt: string | null;
  draft: BrandProfile | null;
  draftScores: BrandDraftScore[];
  draftHash: string | null;
};

export type BrandDetailResult =
  | { status: "found"; detail: BrandDetail }
  | { status: "not_found" }
  | { status: "error" };

/** Non-throwing parse: a malformed/legacy-shape profile degrades to `null`
 *  (rendered as "unable to display") rather than crashing the whole page. */
function safeParseProfile(value: unknown): BrandProfile | null {
  const parsed = brandProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function safeExtractDraftScores(value: unknown): BrandDraftScore[] {
  try {
    return extractDraftScores(value);
  } catch {
    return [];
  }
}

export async function loadBrandDetail(
  supabase: SupabaseClient<Database>,
  brandId: string,
): Promise<BrandDetailResult> {
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id, name, org_id, brand_url, intake_status, ai_profile, ai_profile_draft, approved_profile_at")
    .eq("id", brandId)
    .maybeSingle();

  if (error) return { status: "error" };
  if (!brand) return { status: "not_found" };

  let draftHash: string | null = null;
  if (brand.ai_profile_draft) {
    const { data: hash, error: hashError } = await supabase.rpc("get_brand_draft_hash", {
      p_brand_id: brandId,
    });
    if (hashError) return { status: "error" };
    draftHash = hash ?? null;
  }

  return {
    status: "found",
    detail: {
      id: brand.id,
      name: brand.name,
      orgId: brand.org_id,
      brandUrl: brand.brand_url,
      intakeStatus: brand.intake_status,
      approvedProfile: safeParseProfile(brand.ai_profile),
      approvedProfileAt: brand.approved_profile_at,
      draft: brand.ai_profile_draft ? safeParseProfile(brand.ai_profile_draft) : null,
      draftScores: brand.ai_profile_draft ? safeExtractDraftScores(brand.ai_profile_draft) : [],
      draftHash,
    },
  };
}
