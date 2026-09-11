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
 * error, so existence is never leaked. `get_brand_draft_snapshot` is
 * called server-side only; the browser never recomputes or is trusted to
 * supply the reviewed-artifact hash (see approveDraft's exact-artifact
 * contract).
 *
 * The draft and its hash come from ONE `get_brand_draft_snapshot` call,
 * not a separate SELECT of `ai_profile_draft` plus a separate hash RPC —
 * two independent reads of the same mutable column would let a
 * regenerate landing between them bind the operator's Approve click to a
 * hash for content they never actually saw (approve_brand_intelligence_draft
 * would then silently promote whatever is CURRENT, not what was
 * rendered).
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

/**
 * IPI-1093 · BRAND-INTEL-001 blocker #4 — Mastra's `saveDraftAndWait` step is
 * the sole owner of "ready for review": it attaches `_workflow_run_id` to
 * `ai_profile_draft` AFTER the `brand-intelligence` Edge function's own
 * write. `brandProfileSchema` is `.passthrough()`, so a draft captured in
 * that window parses successfully with no run id yet — reviewable-looking,
 * but `approve_brand_intelligence_draft` requires a verified
 * `_workflow_run_id` and would reject it as `INVALID_DRAFT`. A malformed
 * draft (not this case) must still parse to `null` and surface as
 * parse_error, not disappear — so this only asks "does the schema-valid
 * draft carry a run id", never called on a draft that already failed
 * `safeParseProfile`.
 */
function hasWorkflowRunId(parsedDraft: BrandProfile): boolean {
  const runId = (parsedDraft as unknown as Record<string, unknown>)._workflow_run_id;
  return typeof runId === "string" && runId !== "";
}

export async function loadBrandDetail(
  supabase: SupabaseClient<Database>,
  brandId: string,
): Promise<BrandDetailResult> {
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id, name, org_id, brand_url, intake_status, ai_profile, approved_profile_at")
    .eq("id", brandId)
    .maybeSingle();

  if (error) return { status: "error" };
  if (!brand) return { status: "not_found" };

  const { data: snapshot, error: snapshotError } = await supabase.rpc("get_brand_draft_snapshot", {
    p_brand_id: brandId,
  });
  if (snapshotError) return { status: "error" };

  const rawDraft = (snapshot as { draft: unknown; hash: string | null } | null)?.draft ?? null;
  const rawDraftHash = (snapshot as { draft: unknown; hash: string | null } | null)?.hash ?? null;

  const parsedDraft = rawDraft ? safeParseProfile(rawDraft) : null;
  // See hasWorkflowRunId's doc comment: only a schema-valid draft that is
  // still missing its run id counts as "pending provenance" — a malformed
  // draft (parsedDraft === null) keeps its existing parse_error behavior.
  const pendingProvenance = parsedDraft !== null && !hasWorkflowRunId(parsedDraft);

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
      draft: pendingProvenance ? null : parsedDraft,
      draftScores: pendingProvenance ? [] : rawDraft ? safeExtractDraftScores(rawDraft) : [],
      draftHash: pendingProvenance ? null : rawDraftHash,
    },
  };
}
