import type { SupabaseClient } from "@supabase/supabase-js";

import {
  materializeResultSchema,
  type OnboardingDraft,
  type OnboardingIdempotencyKey,
  type OnboardingSession,
  type OnboardingSessionId,
  type OnboardingUserId,
} from "./schema";

import { EMPTY_DRAFT, serializeDraftAnswers } from "./session-draft";

export { validateUrl } from "./validate-url";
export { getOrCreateOnboardingIdempotencyKey } from "./idempotency-key";
export {
  serializeDraftAnswers,
  parseDraftAnswers,
  EMPTY_DRAFT,
  hasV2DraftMarker,
  migrateLegacyDraftToV2,
  type LegacyDraftAnswers,
} from "./session-draft";
export {
  resolveSemanticStep,
  resolveLeanStep,
  type SemanticOnboardingStep,
  type StepMappingInput,
} from "./step-mapping";
export {
  onboardingSessionSchema,
  onboardingSessionStatusSchema,
  materializeResultSchema,
  onboardingDraftSchema,
  asOnboardingUserId,
  asOnboardingSessionId,
  asOnboardingIdempotencyKey,
  type OnboardingSession,
  type OnboardingSessionStatus,
  type OnboardingDraft,
  type OnboardingResumeStep,
  type OnboardingBuildType,
  type OnboardingChannelId,
  type OnboardingGrowthPreference,
  type MaterializeResult,
  type OnboardingUserId,
  type OnboardingSessionId,
  type OnboardingIdempotencyKey,
} from "./schema";

const SESSION_COLUMNS =
  "id, user_id, idempotency_key, status, current_screen, draft_answers, organization_id, brand_id";

/**
 * Get-or-create the user's own draft session for a stable idempotency_key.
 * One key per user (localStorage) so refresh resumes the same draft.
 */
export const getOrCreateOnboardingSession = async (
  supabase: SupabaseClient,
  userId: OnboardingUserId,
  idempotencyKey: OnboardingIdempotencyKey,
): Promise<OnboardingSession> => {
  const { data: existing, error: selectErr } = await supabase
    .from("onboarding_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (selectErr) {
    throw new Error(selectErr.message ?? "Failed to load onboarding session");
  }
  if (existing) {
    return existing as OnboardingSession;
  }

  const { data: created, error: insertErr } = await supabase
    .from("onboarding_sessions")
    .insert({
      user_id: userId,
      idempotency_key: idempotencyKey,
      status: "draft",
      current_screen: 1,
      draft_answers: serializeDraftAnswers(EMPTY_DRAFT),
    })
    .select(SESSION_COLUMNS)
    .single();

  if (insertErr || !created) {
    // Concurrent insert: unique (user_id, idempotency_key) — re-select.
    if (insertErr?.code === "23505") {
      const { data: raced, error: raceErr } = await supabase
        .from("onboarding_sessions")
        .select(SESSION_COLUMNS)
        .eq("user_id", userId)
        .eq("idempotency_key", idempotencyKey)
        .single();
      if (raceErr || !raced) {
        throw new Error(raceErr?.message ?? "Failed to load onboarding session after conflict");
      }
      return raced as OnboardingSession;
    }
    throw new Error(insertErr?.message ?? "Failed to create onboarding session");
  }

  return created as OnboardingSession;
};

/** Thin autosave for draft_answers (resume depends on this). */
export const updateOnboardingSessionDraft = async (
  supabase: SupabaseClient,
  sessionId: OnboardingSessionId,
  patch: { draft_answers?: Record<string, unknown> },
): Promise<void> => {
  const { data, error } = await supabase
    .from("onboarding_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "draft")
    .select("id")
    .single();

  if (error) {
    // PGRST116 = zero rows matched (session no longer a draft, e.g. materialized).
    if (error.code === "PGRST116") {
      throw new Error("Onboarding session is no longer in draft state");
    }
    throw new Error(error.message ?? "Failed to update onboarding session");
  }
  // Defense-in-depth: a zero-row match must not report success.
  if (!data) {
    throw new Error("Onboarding session is no longer in draft state");
  }
};

/**
 * True when the user already completed onboarding under any idempotency key.
 * Defense-in-depth for cleared browser storage: a fresh key must not re-show
 * the form to a user who already materialized (the DB partial unique index is
 * the authoritative guard).
 */
export const hasMaterializedOnboardingSession = async (
  supabase: SupabaseClient,
  userId: OnboardingUserId,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("onboarding_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "materialized")
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to check onboarding status");
  }
  return data != null;
};

/**
 * Materialize org + owner membership + brand atomically via the existing
 * INVOKER RPC. The database owns atomicity/idempotency — the browser never
 * inserts into organizations / org_members / brands. brand_url is optional
 * for tenancy and passed as null when blank.
 */
export const materializeOnboarding = async (
  supabase: SupabaseClient,
  draft: Pick<OnboardingDraft, "brandName" | "websiteUrl">,
  options: { idempotencyKey: OnboardingIdempotencyKey },
): Promise<{ orgId: string; brandId: string }> => {
  const { data, error } = await supabase.rpc("materialize_onboarding_session", {
    p_idempotency_key: options.idempotencyKey,
    p_brand_name: draft.brandName.trim(),
    p_brand_url: draft.websiteUrl.trim() || null,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to materialize onboarding session");
  }

  const parsed = materializeResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("materialize_onboarding_session returned an unexpected payload");
  }

  return {
    orgId: parsed.data.organization_id,
    brandId: parsed.data.brand_id,
  };
};