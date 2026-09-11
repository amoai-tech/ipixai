import { Type } from "npm:@google/genai@2.8.0";

import brandProfileStrictJsonSchemaDoc from "./brand-profile.schema.json" with {
  type: "json",
};

/** Brand DNA contract version (IPI-834). */
export const BRAND_PROFILE_SCHEMA_VERSION = 2 as const;

const QUOTE_MAX = 500;
const VALUE_MAX = 2000;
const URL_MAX = 2048;

/** Gemini `@google/genai` responseSchema — claim shape mirrors JSON Schema SSOT. */
const claimResponseSchema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.STRING, description: "Claim text" },
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sourceUrl: { type: Type.STRING, description: "Supporting page URL" },
          quote: { type: Type.STRING, description: "Non-empty excerpt from the source" },
          crawlResultId: { type: Type.STRING, description: "Optional crawl result UUID" },
        },
        required: ["sourceUrl", "quote"],
      },
      description: "At least one citation; quotes are untrusted display data",
    },
  },
  required: ["value", "evidence"],
};

export const brandProfileResponseSchema = {
  type: Type.OBJECT,
  properties: {
    schemaVersion: {
      type: Type.NUMBER,
      description: "Must be 2 (Brand DNA evidence contract)",
    },
    name: { type: Type.STRING, description: "Brand display name" },
    tagline: claimResponseSchema,
    overview: claimResponseSchema,
    category: claimResponseSchema,
    visualIdentity: {
      type: Type.OBJECT,
      properties: {
        colors: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Hex or descriptive color names",
        },
        mood: { type: Type.STRING, description: "Visual mood, e.g. minimal luxe" },
      },
      required: ["colors", "mood"],
    },
    targetAudience: claimResponseSchema,
    sourceUrl: { type: Type.STRING },
    contentPillars: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 recurring content themes",
    },
    brandVoice: claimResponseSchema,
    recommendedServices: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "iPix service slugs: fashion-photography, ecommerce, instagram, video, shopify, amazon, jewellery, location, clothing",
    },
    productionReadiness: {
      type: Type.NUMBER,
      description: "0-100 readiness for professional content shoot",
    },
    mission: claimResponseSchema,
    vision: claimResponseSchema,
    values: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    uvp: claimResponseSchema,
    positioning: claimResponseSchema,
    brandPersonality: claimResponseSchema,
    confidenceScore: {
      type: Type.NUMBER,
      description: "0-100 confidence in extracted profile",
    },
    competitorSignals: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Named competitors or adjacent brands mentioned",
    },
    scores: {
      type: Type.OBJECT,
      properties: {
        visual: { type: Type.NUMBER, description: "Visual identity clarity 0-100" },
        audience: { type: Type.NUMBER, description: "Audience clarity 0-100" },
        consistency: { type: Type.NUMBER, description: "Cross-page consistency 0-100" },
        commerce_readiness: {
          type: Type.NUMBER,
          description: "E-commerce readiness 0-100",
        },
        brand_clarity: { type: Type.NUMBER, description: "Mission/values/UVP clarity 0-100" },
        content_strength: { type: Type.NUMBER, description: "Content pillar depth 0-100" },
        social_presence: { type: Type.NUMBER, description: "Social channels + follower signal 0-100" },
        digital_experience: { type: Type.NUMBER, description: "Site UX/mobile/speed 0-100" },
        sustainability_signal: { type: Type.NUMBER, description: "Eco/ethical indicators 0-100" },
        photography_readiness: { type: Type.NUMBER, description: "Product imagery quality 0-100" },
        confidence: { type: Type.NUMBER, description: "Overall confidence in scores 0-100" },
        evidence: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Supporting evidence snippets for scores",
        },
      },
      required: ["visual", "audience", "consistency", "commerce_readiness"],
    },
  },
  required: [
    "schemaVersion",
    "name",
    "tagline",
    "category",
    "visualIdentity",
    "targetAudience",
    "sourceUrl",
    "scores",
  ],
};

/** Groq strict JSON Schema (`additionalProperties: false`, all fields required). */
export const brandProfileStrictJsonSchema = brandProfileStrictJsonSchemaDoc;

export type BrandClaimEvidence = {
  sourceUrl: string;
  quote: string;
  crawlResultId?: string;
};

export type BrandClaim = {
  value: string;
  evidence: BrandClaimEvidence[];
};

export type BrandProfilePayload = {
  schemaVersion: typeof BRAND_PROFILE_SCHEMA_VERSION;
  name: string;
  tagline: BrandClaim;
  overview?: BrandClaim;
  category: BrandClaim;
  visualIdentity: { colors: string[]; mood: string };
  targetAudience: BrandClaim;
  sourceUrl: string;
  contentPillars?: string[];
  brandVoice?: BrandClaim;
  recommendedServices?: string[];
  productionReadiness?: number;
  mission?: BrandClaim;
  vision?: BrandClaim;
  values?: string[];
  uvp?: BrandClaim;
  positioning?: BrandClaim;
  brandPersonality?: BrandClaim;
  confidenceScore?: number;
  competitorSignals?: string[];
  scores: {
    visual: number;
    audience: number;
    consistency: number;
    commerce_readiness: number;
    brand_clarity?: number;
    content_strength?: number;
    social_presence?: number;
    digital_experience?: number;
    sustainability_signal?: number;
    photography_readiness?: number;
    confidence?: number;
    evidence?: string[];
  };
};

const REQUIRED_CLAIMS = ["tagline", "category", "targetAudience"] as const;
const OPTIONAL_CLAIMS = [
  "overview",
  "brandVoice",
  "mission",
  "vision",
  "uvp",
  "positioning",
  "brandPersonality",
] as const;

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalTrim(value: unknown): string | undefined {
  return trimmedString(value) ?? undefined;
}

function optionalStringArray(value: unknown, max: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length > 0 ? items.slice(0, max) : undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns null when valid; otherwise a short error message. */
export function validateClaim(claim: unknown, field: string): string | null {
  if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
    return `Claim "${field}" must be { value, evidence[] }`;
  }
  const record = claim as Record<string, unknown>;
  const value = trimmedString(record.value);
  if (!value) return `Claim "${field}" requires a non-empty value`;
  if (value.length > VALUE_MAX) return `Claim "${field}" value exceeds ${VALUE_MAX} chars`;
  if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
    return `Claim "${field}" requires at least one evidence entry`;
  }
  if (record.evidence.length > 10) {
    return `Claim "${field}" has too many evidence entries`;
  }
  for (let i = 0; i < record.evidence.length; i++) {
    const ev = record.evidence[i];
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) {
      return `Claim "${field}" evidence[${i}] must be an object`;
    }
    const entry = ev as Record<string, unknown>;
    const sourceUrl = trimmedString(entry.sourceUrl);
    if (!sourceUrl || sourceUrl.length > URL_MAX || !isHttpUrl(sourceUrl)) {
      return `Claim "${field}" evidence[${i}] needs a valid http(s) sourceUrl`;
    }
    const quote = trimmedString(entry.quote);
    if (!quote) return `Claim "${field}" evidence[${i}] needs a non-empty quote`;
    if (quote.length > QUOTE_MAX) {
      return `Claim "${field}" evidence[${i}] quote exceeds ${QUOTE_MAX} chars`;
    }
    if (entry.crawlResultId !== undefined) {
      const id = trimmedString(entry.crawlResultId);
      if (!id) return `Claim "${field}" evidence[${i}] crawlResultId is empty`;
    }
  }
  return null;
}

function normalizeClaim(claim: BrandClaim): BrandClaim {
  return {
    value: claim.value.trim().slice(0, VALUE_MAX),
    evidence: claim.evidence.slice(0, 10).map((ev) => ({
      sourceUrl: ev.sourceUrl.trim().slice(0, URL_MAX),
      quote: ev.quote.trim().slice(0, QUOTE_MAX),
      ...(trimmedString(ev.crawlResultId)
        ? { crawlResultId: trimmedString(ev.crawlResultId)! }
        : {}),
    })),
  };
}

export function buildAiProfileFromPayload(
  profile: BrandProfilePayload,
  sourceUrl: string,
): Record<string, unknown> {
  const name = trimmedString(profile.name)!;
  const mood = trimmedString(profile.visualIdentity?.mood)!;
  const colors = Array.isArray(profile.visualIdentity?.colors)
    ? profile.visualIdentity.colors
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];

  return {
    schemaVersion: BRAND_PROFILE_SCHEMA_VERSION,
    name,
    tagline: normalizeClaim(profile.tagline),
    category: normalizeClaim(profile.category),
    visualIdentity: { colors, mood },
    targetAudience: normalizeClaim(profile.targetAudience),
    sourceUrl,
    analyzedAt: new Date().toISOString(),
    ...(profile.overview ? { overview: normalizeClaim(profile.overview) } : {}),
    ...(optionalStringArray(profile.contentPillars, 8)
      ? { contentPillars: optionalStringArray(profile.contentPillars, 8) }
      : {}),
    ...(profile.brandVoice ? { brandVoice: normalizeClaim(profile.brandVoice) } : {}),
    ...(optionalStringArray(profile.recommendedServices, 10)
      ? { recommendedServices: optionalStringArray(profile.recommendedServices, 10) }
      : {}),
    ...(typeof profile.productionReadiness === "number"
      ? { productionReadiness: clampScore(profile.productionReadiness) }
      : {}),
    ...(profile.mission ? { mission: normalizeClaim(profile.mission) } : {}),
    ...(profile.vision ? { vision: normalizeClaim(profile.vision) } : {}),
    ...(optionalStringArray(profile.values, 12)
      ? { values: optionalStringArray(profile.values, 12) }
      : {}),
    ...(profile.uvp ? { uvp: normalizeClaim(profile.uvp) } : {}),
    ...(profile.positioning ? { positioning: normalizeClaim(profile.positioning) } : {}),
    ...(profile.brandPersonality
      ? { brandPersonality: normalizeClaim(profile.brandPersonality) }
      : {}),
    ...(typeof profile.confidenceScore === "number"
      ? { confidenceScore: clampScore(profile.confidenceScore) }
      : {}),
    ...(optionalStringArray(profile.competitorSignals, 12)
      ? { competitorSignals: optionalStringArray(profile.competitorSignals, 12) }
      : {}),
    // Keep scores on the draft JSON so Mastra assertBrandProfile / stripBrandProfileMeta
    // still see them after `_draft_scores` (applyDraft rows) is stripped.
    scores: {
      visual: clampScore(profile.scores.visual),
      audience: clampScore(profile.scores.audience),
      consistency: clampScore(profile.scores.consistency),
      commerce_readiness: clampScore(profile.scores.commerce_readiness),
      ...(typeof profile.scores.brand_clarity === "number"
        ? { brand_clarity: clampScore(profile.scores.brand_clarity) }
        : {}),
      ...(typeof profile.scores.content_strength === "number"
        ? { content_strength: clampScore(profile.scores.content_strength) }
        : {}),
      ...(typeof profile.scores.social_presence === "number"
        ? { social_presence: clampScore(profile.scores.social_presence) }
        : {}),
      ...(typeof profile.scores.digital_experience === "number"
        ? { digital_experience: clampScore(profile.scores.digital_experience) }
        : {}),
      ...(typeof profile.scores.sustainability_signal === "number"
        ? { sustainability_signal: clampScore(profile.scores.sustainability_signal) }
        : {}),
      ...(typeof profile.scores.photography_readiness === "number"
        ? { photography_readiness: clampScore(profile.scores.photography_readiness) }
        : {}),
      ...(typeof profile.scores.confidence === "number"
        ? { confidence: clampScore(profile.scores.confidence) }
        : {}),
      ...(optionalStringArray(profile.scores.evidence, 20)
        ? { evidence: optionalStringArray(profile.scores.evidence, 20) }
        : {}),
    },
  };
}

/**
 * Fail-closed Brand DNA contract check (Edge + Mastra parity).
 * Returns null when valid; otherwise a short error message.
 */
export function validateBrandProfilePayload(
  profile: BrandProfilePayload | Record<string, unknown>,
): string | null {
  const record = profile as Record<string, unknown>;

  if (record.schemaVersion !== BRAND_PROFILE_SCHEMA_VERSION) {
    return `schemaVersion must be ${BRAND_PROFILE_SCHEMA_VERSION}`;
  }
  if (!trimmedString(record.name)) return "Could not extract a brand name";
  if (!trimmedString(record.sourceUrl) || !isHttpUrl(String(record.sourceUrl).trim())) {
    return "sourceUrl must be a valid http(s) URL";
  }

  const visual = record.visualIdentity as { colors?: unknown; mood?: unknown } | undefined;
  if (
    !trimmedString(visual?.mood) ||
    !Array.isArray(visual?.colors)
  ) {
    return "Incomplete brand profile returned";
  }

  for (const field of REQUIRED_CLAIMS) {
    const err = validateClaim(record[field], field);
    if (err) return err;
  }
  for (const field of OPTIONAL_CLAIMS) {
    if (record[field] === undefined || record[field] === null) continue;
    const err = validateClaim(record[field], field);
    if (err) return err;
  }

  const scores = record.scores as Record<string, unknown> | undefined;
  if (
    !scores ||
    typeof scores.visual !== "number" ||
    typeof scores.audience !== "number" ||
    typeof scores.consistency !== "number" ||
    typeof scores.commerce_readiness !== "number"
  ) {
    return "Incomplete scores returned";
  }
  return null;
}
