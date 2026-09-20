import type { OnboardingDraft } from "./schema";

export const EMPTY_DRAFT: OnboardingDraft = { brandName: "", websiteUrl: "" };

/**
 * IPI-1263 · ONBOARD-COMPAT-001 — draft_answers may carry keys this app
 * version doesn't understand (an earlier onboarding iteration's fields, or a
 * future lean-schema field from IPI-1260/IPI-1264). `brandName`/`websiteUrl`
 * are the only keys this module normalizes; every other key must round-trip
 * byte-for-byte so no legacy or forward data is ever silently dropped.
 */
export type LegacyDraftAnswers = OnboardingDraft & Record<string, unknown>;

/**
 * Persist the Phase-1 draft + any unrecognized keys inside
 * onboarding_sessions.draft_answers. Known fields are normalized; everything
 * else passes through unchanged (see LegacyDraftAnswers).
 */
export function serializeDraftAnswers(draft: LegacyDraftAnswers): Record<string, unknown> {
  const { brandName, websiteUrl, ...legacy } = draft;
  return { ...legacy, brandName, websiteUrl };
}

/**
 * Parse draft_answers into the known Phase-1 shape while preserving every
 * other key untouched, so an unrecognized legacy field survives a
 * parse → serialize round trip even though this app doesn't interpret it.
 */
export function parseDraftAnswers(raw: unknown): LegacyDraftAnswers {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY_DRAFT };
  const { brandName, websiteUrl, ...legacy } = raw as Record<string, unknown>;
  return {
    ...legacy,
    brandName: typeof brandName === "string" ? brandName : "",
    websiteUrl: typeof websiteUrl === "string" ? websiteUrl : "",
  };
}
