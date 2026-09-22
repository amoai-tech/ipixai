"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { startBrandAnalysisAction } from "@/app/app/brands/[brandId]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { BrandDetailsQuestion } from "./questions/brand-details-question";
import { BuildTypeQuestion } from "./questions/build-type-question";
import { ChannelsQuestion } from "./questions/channels-question";
import { GrowthPreferenceQuestion } from "./questions/growth-preference-question";
import {
  asOnboardingIdempotencyKey,
  asOnboardingSessionId,
  asOnboardingUserId,
  getOrCreateOnboardingIdempotencyKey,
  getOrCreateOnboardingSession,
  hasMaterializedOnboardingSession,
  hasV2DraftMarker,
  materializeOnboarding,
  migrateLegacyDraftToV2,
  parseDraftAnswers,
  resolveLeanStep,
  resolveSemanticStep,
  serializeDraftAnswers,
  updateOnboardingSessionDraft,
  validateUrl,
  type LegacyDraftAnswers,
  type OnboardingDraft,
  type OnboardingChannelId,
  type OnboardingResumeStep,
  type OnboardingSessionId,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/client";

const SAVE_DEBOUNCE_MS = 400;
const ANALYSIS_HANDOFF_TIMEOUT_MS = 1500;
const EMPTY_V2_DRAFT = parseDraftAnswers({ flowVersion: 2 }) as LegacyDraftAnswers & OnboardingDraft;
type SaveState = "idle" | "saving" | "saved" | "error";

const STEP_ORDER: OnboardingResumeStep[] = [
  "build-type",
  "brand-details",
  "channels",
  "growth-preference",
];

function legacyStepToLean(step: ReturnType<typeof resolveSemanticStep>): OnboardingResumeStep {
  if (step === "brand-details") return "brand-details";
  if (step === "channels") return "channels";
  return "growth-preference";
}

async function handoffBrandAnalysis(brandId: string): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), ANALYSIS_HANDOFF_TIMEOUT_MS);
    });
    const analysis = await Promise.race([startBrandAnalysisAction(brandId), timeout]);
    if (analysis && !analysis.ok) console.warn("brand analysis handoff failed", analysis.message);
  } catch (error) {
    console.warn("brand analysis handoff threw", error);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<LegacyDraftAnswers & OnboardingDraft>(() => ({ ...EMPTY_V2_DRAFT }));
  const [step, setStep] = useState<OnboardingResumeStep>("build-type");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const sessionIdRef = useRef<OnboardingSessionId | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<(LegacyDraftAnswers & OnboardingDraft) | null>(null);
  const saveInFlightRef = useRef(false);
  const transitionInFlightRef = useRef(false);
  const headingRegionRef = useRef<HTMLDivElement>(null);

  const flushSave = useCallback(async (): Promise<boolean> => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return true;
    while (saveInFlightRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    saveInFlightRef.current = true;
    try {
      while (pendingSaveRef.current) {
        const snapshot = pendingSaveRef.current;
        pendingSaveRef.current = null;
        setSaveState("saving");
        try {
          await updateOnboardingSessionDraft(createClient(), sessionId, {
            draft_answers: serializeDraftAnswers(snapshot),
          });
          setSaveState("saved");
        } catch {
          if (!pendingSaveRef.current) pendingSaveRef.current = snapshot;
          setSaveState("error");
          return false;
        }
      }
      return true;
    } finally {
      saveInFlightRef.current = false;
    }
  }, []);

  const queueDraft = useCallback(
    (nextDraft: LegacyDraftAnswers & OnboardingDraft) => {
      setDraft(nextDraft);
      pendingSaveRef.current = nextDraft;
      if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const operatorId = asOnboardingUserId(userId);
        const key = getOrCreateOnboardingIdempotencyKey(operatorId);
        const session = await getOrCreateOnboardingSession(supabase, operatorId, key);
        if (cancelled) return;
        const parsed = parseDraftAnswers(session.draft_answers);
        const legacyStep = resolveSemanticStep({
          status: session.status,
          currentScreen: session.current_screen,
          brandId: session.brand_id,
          organizationId: session.organization_id,
          draft: parsed,
        });
        if (legacyStep === "materialized") {
          router.replace("/app");
          return;
        }
        if (await hasMaterializedOnboardingSession(supabase, operatorId)) {
          router.replace("/app");
          return;
        }
        if (cancelled) return;
        sessionIdRef.current = asOnboardingSessionId(session.id);
        const resumedStep = hasV2DraftMarker(session.draft_answers)
          ? resolveLeanStep(parsed)
          : legacyStepToLean(legacyStep);
        const initialStep: OnboardingResumeStep = STEP_ORDER.includes(resumedStep)
          ? resumedStep
          : "growth-preference";
        const migratedDraft = hasV2DraftMarker(session.draft_answers)
          ? ({ ...parsed, flowVersion: 2 as const, resumeStep: initialStep } as LegacyDraftAnswers & OnboardingDraft)
          : migrateLegacyDraftToV2(parsed, initialStep);
        setDraft(migratedDraft);
        setStep(initialStep);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error("onboarding load failed", error);
        setLoadError("Couldn't load your onboarding. Please refresh and try again.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
    };
  }, [router, userId]);

  useEffect(() => {
    if (loading) return;
    const heading = headingRegionRef.current?.querySelector<HTMLElement>("h1");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [loading, step]);

  const updateDraft = useCallback(
    (patch: Partial<LegacyDraftAnswers>) => {
      const next: LegacyDraftAnswers & OnboardingDraft = { ...draft, ...patch, flowVersion: 2 as const };
      queueDraft(next);
    },
    [draft, queueDraft],
  );

  const moveTo = useCallback(
    async (nextStep: OnboardingResumeStep, patch: Partial<LegacyDraftAnswers> = {}) => {
      const next: LegacyDraftAnswers & OnboardingDraft = { ...draft, ...patch, flowVersion: 2 as const, resumeStep: nextStep };
      setSubmitError(null);
      pendingSaveRef.current = next;
      if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
      const saved = await flushSave();
      if (!saved) {
        setSubmitError("Couldn't save your draft. Please retry.");
        return false;
      }
      setDraft(next);
      setStep(nextStep);
      return true;
    },
    [draft, flushSave],
  );

  const runTransition = useCallback(async (action: () => Promise<void>) => {
    if (transitionInFlightRef.current) return;
    transitionInFlightRef.current = true;
    setTransitioning(true);
    try {
      await action();
    } finally {
      transitionInFlightRef.current = false;
      setTransitioning(false);
    }
  }, []);

  const goBack = useCallback(async () => {
    await runTransition(async () => {
      const index = STEP_ORDER.indexOf(step);
      if (index <= 0) return;
      await moveTo(STEP_ORDER[index - 1]);
    });
  }, [moveTo, runTransition, step]);

  const retrySave = useCallback(() => {
    void flushSave();
  }, [flushSave]);

  const toggleChannel = useCallback(
    (id: OnboardingChannelId) => {
      const channels = draft.channels.includes(id)
        ? draft.channels.filter((channel) => channel !== id)
        : [...draft.channels, id];
      updateDraft({ channels });
    },
    [draft.channels, updateDraft],
  );

  async function handleContinue() {
    await runTransition(async () => {
      if (step === "build-type") {
        await moveTo("brand-details");
        return;
      }
      if (step === "brand-details") {
        if (!draft.brandName.trim()) {
          setSubmitError("Brand name is required.");
          return;
        }
        if (validateUrl(draft.websiteUrl)) return;
        await moveTo("channels");
        return;
      }
      if (step === "channels") {
        await moveTo("growth-preference");
        return;
      }
      await handleMaterialize();
    });
  }

  async function handleSkip() {
    await runTransition(async () => {
      if (step === "build-type") {
        await moveTo("brand-details", { buildType: null });
        return;
      }
      if (step === "growth-preference") {
        await handleMaterialize({ growthPreference: null });
      }
    });
  }

  async function handleMaterialize(patch: Partial<LegacyDraftAnswers> = {}) {
    const finalDraft = { ...draft, ...patch, flowVersion: 2 as const, resumeStep: "complete" as const };
    const name = finalDraft.brandName.trim();
    if (!name) {
      setSubmitError("Brand name is required.");
      return;
    }
    const urlError = validateUrl(finalDraft.websiteUrl);
    if (urlError) {
      setSubmitError(urlError);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      pendingSaveRef.current = finalDraft;
      if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
      const saved = await flushSave();
      if (!saved) {
        setSubmitError("Couldn't save your draft. Please retry.");
        return;
      }
      const supabase = createClient();
      const key = getOrCreateOnboardingIdempotencyKey(asOnboardingUserId(userId));
      const created = await materializeOnboarding(supabase, finalDraft, { idempotencyKey: key });
      if (finalDraft.websiteUrl.trim()) await handoffBrandAnalysis(created.brandId);
      router.replace(`/app/brands/${created.brandId}`);
      return;
    } catch (error) {
      try {
        if (await hasMaterializedOnboardingSession(createClient(), asOnboardingUserId(userId))) {
          router.replace("/app");
          return;
        }
      } catch {
        // Preserve the original materialization failure below.
      }
      console.error("onboarding materialization failed", error);
      setSubmitError("Couldn't create your Brand. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-[var(--muted-foreground)]">Loading…</div>;
  }
  if (loadError) {
    return <div className="p-8"><ErrorState message={loadError} /></div>;
  }

  const busy = submitting || transitioning;
  const currentIndex = STEP_ORDER.indexOf(step);
  const stepNumber = currentIndex >= 0 ? currentIndex + 1 : 4;
  const publicIdentity = draft.channelIdentities.public ?? "";

  return (
    <Card className="mx-auto w-full max-w-xl" data-testid="onboarding-form" aria-busy={busy}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 text-xs text-[var(--muted-foreground)]">
          <span>iPix onboarding</span>
          <span>Step {stepNumber} of 4</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-[width]"
            style={{ width: `${stepNumber * 25}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div ref={headingRegionRef} key={step}>
          {step === "build-type" ? (
            <BuildTypeQuestion
              value={draft.buildType}
              onChange={(buildType) => updateDraft({ buildType })}
              disabled={busy}
            />
          ) : null}
          {step === "brand-details" ? (
            <BrandDetailsQuestion
              brandName={draft.brandName}
              websiteUrl={draft.websiteUrl}
              onBrandNameChange={(brandName) => updateDraft({ brandName })}
              onWebsiteUrlChange={(websiteUrl) => updateDraft({ websiteUrl })}
              disabled={busy}
            />
          ) : null}
          {step === "channels" ? (
            <ChannelsQuestion
              channels={draft.channels}
              identity={publicIdentity}
              onToggle={toggleChannel}
              onIdentityChange={(value) =>
                updateDraft({ channelIdentities: { ...draft.channelIdentities, public: value } })
              }
              disabled={busy}
            />
          ) : null}
          {step === "growth-preference" ? (
            <GrowthPreferenceQuestion
              value={draft.growthPreference}
              onChange={(growthPreference) => updateDraft({ growthPreference })}
              disabled={busy}
            />
          ) : null}
        </div>

        {submitError ? (
          <p role="alert" data-testid="onboarding-submit-error" className="text-sm text-[var(--destructive)]">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {step !== "build-type" ? (
            <Button type="button" variant="outline" onClick={() => void goBack()} disabled={busy}>
              Back
            </Button>
          ) : null}
          {(step === "build-type" || step === "growth-preference") ? (
            <Button type="button" variant="ghost" onClick={() => void handleSkip()} disabled={busy}>
              Skip for now
            </Button>
          ) : null}
          <Button type="button" onClick={() => void handleContinue()} disabled={busy} className="ml-auto">
            {submitting ? "Creating…" : step === "growth-preference" ? "Create Brand" : "Continue"}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]" aria-live="polite">
          {saveState === "saving" ? <span>Saving…</span> : null}
          {saveState === "saved" ? <span>Draft saved.</span> : null}
          {saveState === "idle" ? <span>Your draft is saved automatically.</span> : null}
          {saveState === "error" ? (
            <>
              <span>Draft save failed.</span>
              <Button type="button" variant="ghost" size="sm" onClick={retrySave} disabled={busy}>Retry</Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
