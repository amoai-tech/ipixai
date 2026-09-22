import { z } from "zod";

/** Session row status — must stay split from brands.intake_status. */
export const onboardingSessionStatusSchema = z.enum(["draft", "materialized", "superseded"]);

export type OnboardingSessionStatus = z.infer<typeof onboardingSessionStatusSchema>;

export const onboardingSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  idempotency_key: z.string().min(1),
  status: onboardingSessionStatusSchema,
  current_screen: z.number().int().min(1).max(13),
  draft_answers: z.record(z.string(), z.unknown()),
  organization_id: z.string().uuid().nullable(),
  brand_id: z.string().uuid().nullable(),
});

export type OnboardingSession = z.infer<typeof onboardingSessionSchema>;

/** materialize_onboarding_session returns { organization_id, brand_id }. */
export const materializeResultSchema = z.object({
  organization_id: z.string().uuid(),
  brand_id: z.string().uuid(),
});

export type MaterializeResult = z.infer<typeof materializeResultSchema>;

/** IPI-1260 · ONBOARD-LEAN-001 — semantic V2 onboarding contract. */
export const onboardingResumeStepSchema = z.enum([
  "build-type",
  "brand-details",
  "channels",
  "growth-preference",
  "complete",
]);

export const onboardingBuildTypeSchema = z.enum(["fashion", "clothing", "access", "beauty", "both"]);
export const onboardingChannelIdSchema = z.enum([
  "ig",
  "fb",
  "shopify",
  "web",
  "tiktok",
  "etsy",
  "amazon",
  "ebay",
]);
export const onboardingGrowthPreferenceSchema = z.enum(["social", "paid", "both", "unsure"]);

export const onboardingDraftSchema = z.object({
  flowVersion: z.literal(2),
  resumeStep: onboardingResumeStepSchema,
  buildType: onboardingBuildTypeSchema.nullable(),
  brandName: z.string(),
  websiteUrl: z.string(),
  channels: z.array(onboardingChannelIdSchema),
  channelIdentities: z.record(z.string(), z.string()),
  growthPreference: onboardingGrowthPreferenceSchema.nullable(),
});

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;
export type OnboardingResumeStep = z.infer<typeof onboardingResumeStepSchema>;
export type OnboardingBuildType = z.infer<typeof onboardingBuildTypeSchema>;
export type OnboardingChannelId = z.infer<typeof onboardingChannelIdSchema>;
export type OnboardingGrowthPreference = z.infer<typeof onboardingGrowthPreferenceSchema>;

/**
 * Branded identifiers so onboarding boundaries never mix a user id, session id,
 * and idempotency key. The cast helpers are the only way to mint them — callers
 * cast at the verified boundary (server operator id, Supabase row id).
 */
export type OnboardingUserId = string & { readonly __brand: "OnboardingUserId" };
export type OnboardingSessionId = string & { readonly __brand: "OnboardingSessionId" };
export type OnboardingIdempotencyKey = string & { readonly __brand: "OnboardingIdempotencyKey" };

export const asOnboardingUserId = (id: string): OnboardingUserId => id as OnboardingUserId;
export const asOnboardingSessionId = (id: string): OnboardingSessionId => id as OnboardingSessionId;
export const asOnboardingIdempotencyKey = (key: string): OnboardingIdempotencyKey =>
  key as OnboardingIdempotencyKey;