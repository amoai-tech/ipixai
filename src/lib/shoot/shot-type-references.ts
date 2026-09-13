import { createClient } from "@/lib/supabase/server";
import { MAX_TRUSTED_REFERENCES } from "@/mastra/tools/planning";
import type { TrustedReferenceShotType } from "./shot-list-from-references";

/**
 * IPI-1081 · PLAN-001 — the trusted-reference provider `generateShotListDraft`
 * (IPI-1049 · TOOL-001) has always required as explicit input. Reads
 * `public.shot_type_references_view` — the PostgREST-exposed read surface
 * over the canonical `shoot.shot_type_references` table (49 rows live,
 * verified via Supabase MCP on project nvdlhrodvevgwdsneplk). The `shoot`
 * schema itself is never queried directly here, matching the existing
 * SHOOT-001 rule (see get-shoot-detail.ts) that `.schema("shoot")` isn't a
 * valid PostgREST-exposed surface — `database.types.ts` confirms this view
 * already exists in `public`, so it's reused rather than adding a second one.
 * No pgvector/RAG: the whole table is small and curated, so this loads it
 * unfiltered (bounded to MAX_TRUSTED_REFERENCES, matching
 * generateShotListDraft's own input cap) and lets the existing pure
 * `channelMatchesReference`/`pickReferencesForDeliverable`
 * (shot-list-from-references.ts) — already tested, already handles the
 * "shopify" → "shopify_pdp" naming split — do the actual channel matching.
 * Adding a second, query-side filter here would duplicate that logic for no
 * benefit at this table size.
 *
 * Best-effort only, same contract as loadChannelSpecs: any failure (no
 * session, RLS denial, network, unexpected schema) returns an empty array
 * rather than throwing or fabricating rows — an empty result is the correct
 * "reference gap" signal composeShootPlan surfaces as an explicit
 * missing-input, never invented shot references.
 */
export async function loadTrustedShotReferences(): Promise<TrustedReferenceShotType[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("shot_type_references_view")
      .select("id, angle, description, channel_fit, background")
      .limit(MAX_TRUSTED_REFERENCES);
    if (error || !data?.length) return [];

    return data.flatMap((row): TrustedReferenceShotType[] => {
      if (!row.id || !row.angle || !row.description || !Array.isArray(row.channel_fit)) return [];
      return [
        {
          id: row.id,
          angle: row.angle,
          description: row.description,
          channelFit: row.channel_fit,
          background: row.background ?? null,
        },
      ];
    });
  } catch (err) {
    console.warn("[shot-type-references] loadTrustedShotReferences failed, returning empty (reference gap, not invented):", err);
    return [];
  }
}
