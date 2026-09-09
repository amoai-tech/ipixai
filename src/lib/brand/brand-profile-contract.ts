import { z } from "zod";

export const BRAND_PROFILE_SCHEMA_VERSION = 2 as const;

/**
 * IPI-1093 · BRAND-INTEL-001 (task-verifier finding) — `z.string().url()`
 * accepts any URL with a valid scheme, `javascript:`/`data:` included
 * (confirmed against the installed zod@3.25 build). These values are
 * AI/crawler-derived and later rendered directly as `<a href>` in
 * BrandDNAReviewCard, so an untrusted scheme here is a stored-XSS vector,
 * not just a cosmetic validation gap. Restrict to http(s).
 */
function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const httpUrlMessage = "must be an http(s) URL";

export const brandEvidenceSchema = z.object({
  sourceUrl: z.string().url().max(2048).refine(isHttpUrl, httpUrlMessage),
  quote: z.string().min(1).max(500),
  crawlResultId: z.string().uuid().optional(),
});

export const brandClaimSchema = z.object({
  value: z.string().min(1).max(2000),
  evidence: z.array(brandEvidenceSchema).min(1).max(10),
});

export const brandScoresSchema = z.object({
  visual: z.number(),
  audience: z.number(),
  consistency: z.number(),
  commerce_readiness: z.number(),
  brand_clarity: z.number().optional(),
  content_strength: z.number().optional(),
  social_presence: z.number().optional(),
  digital_experience: z.number().optional(),
  sustainability_signal: z.number().optional(),
  photography_readiness: z.number().optional(),
  confidence: z.number().optional(),
  evidence: z.array(z.string()).max(20).optional(),
});

export const brandProfileSchema = z
  .object({
    schemaVersion: z.literal(BRAND_PROFILE_SCHEMA_VERSION),
    name: z.string().min(1),
    tagline: brandClaimSchema,
    overview: brandClaimSchema.optional(),
    category: brandClaimSchema,
    visualIdentity: z.object({
      colors: z.array(z.string()),
      mood: z.string(),
    }),
    targetAudience: brandClaimSchema,
    sourceUrl: z.string().url().refine(isHttpUrl, httpUrlMessage),
    contentPillars: z.array(z.string()).max(8).optional(),
    brandVoice: brandClaimSchema.optional(),
    recommendedServices: z.array(z.string()).max(10).optional(),
    productionReadiness: z.number().optional(),
    mission: brandClaimSchema.optional(),
    vision: brandClaimSchema.optional(),
    values: z.array(z.string()).max(12).optional(),
    uvp: brandClaimSchema.optional(),
    positioning: brandClaimSchema.optional(),
    brandPersonality: brandClaimSchema.optional(),
    confidenceScore: z.number().optional(),
    competitorSignals: z.array(z.string()).max(12).optional(),
    scores: brandScoresSchema,
  })
  .passthrough();

export const brandDraftScoreSchema = z.object({
  score_type: z.string().min(1),
  // Matches the approval RPC's own range check (0-100) so an out-of-range
  // score is caught at draft generation, not only later at approval time.
  score: z.number().min(0).max(100),
  score_version: z.number().int().min(1).default(1),
  source: z.string().min(1).default("edge_fn"),
  details: z.record(z.string(), z.unknown()).default({}),
});

export const brandDraftScoresSchema = z.array(brandDraftScoreSchema);

export type BrandEvidence = z.infer<typeof brandEvidenceSchema>;
export type BrandClaim = z.infer<typeof brandClaimSchema>;
export type BrandScores = z.infer<typeof brandScoresSchema>;
export type BrandProfile = z.infer<typeof brandProfileSchema>;
export type BrandDraftScore = z.infer<typeof brandDraftScoreSchema>;

export const REQUIRED_CLAIMS = ["tagline", "category", "targetAudience"] as const;
export const OPTIONAL_CLAIMS = [
  "overview",
  "brandVoice",
  "mission",
  "vision",
  "uvp",
  "positioning",
  "brandPersonality",
] as const;
export const CORE_SCORES = ["visual", "audience", "consistency", "commerce_readiness"] as const;

export function assertBrandProfile(profile: unknown): BrandProfile {
  const parsed = brandProfileSchema.safeParse(profile);
  if (!parsed.success) {
    throw new Error(`Invalid Brand DNA profile: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function stripBrandProfileMeta(profile: BrandProfile): BrandProfile {
  const { _draft_scores: _draftScores, _lifecycle: _lifecycle, _workflow_run_id: _workflowRunId, ...rest } =
    profile as BrandProfile & Record<string, unknown>;
  void _draftScores;
  void _lifecycle;
  void _workflowRunId;
  return rest as BrandProfile;
}

export function extractDraftScores(profile: unknown): BrandDraftScore[] {
  const artifact = profile as Record<string, unknown> | null;
  const raw = artifact?._draft_scores;
  if (raw === undefined || raw === null) {
    return [];
  }
  const parsed = brandDraftScoresSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid _draft_scores in Brand DNA draft: ${parsed.error.message}`);
  }
  return parsed.data;
}