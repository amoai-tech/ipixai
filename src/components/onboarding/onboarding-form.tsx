"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import {
  asOnboardingIdempotencyKey,
  asOnboardingSessionId,
  asOnboardingUserId,
  getOrCreateOnboardingIdempotencyKey,
  getOrCreateOnboardingSession,
  hasMaterializedOnboardingSession,
  materializeOnboarding,
  parseDraftAnswers,
  resolveSemanticStep,
  serializeDraftAnswers,
  updateOnboardingSessionDraft,
  validateUrl,
  type LegacyDraftAnswers,
  type OnboardingSessionId,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/client";

const SAVE_DEBOUNCE_MS = 400;

type SaveState = "idle" | "saving" | "saved" | "error";

const inputClassName =
  "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

/**
 * IPI-1089 · ONBOARD-001 — minimal first-brand materialization.
 *
 * Brand name is required and trimmed; website is optional for tenancy and
 * validated only when supplied. The draft autosaves to the user's own
 * onboarding_sessions row (resumable across refresh), and submit calls the
 * existing materialize_onboarding_session RPC — the database atomically
 * creates the organization, owner membership (organizations_auto_add_owner),
 * and brand. On success we hand off to /app and let the existing AUTH-002
 * server routing re-resolve membership. AI/Brand DNA never blocks tenancy.
 */
export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const sessionIdRef = useRef<OnboardingSessionId | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<LegacyDraftAnswers | null>(null);
  const saveInFlightRef = useRef(false);
  // IPI-1263 · ONBOARD-COMPAT-001 — keys draft_answers holds that this app
  // version doesn't understand (an older onboarding iteration's fields).
  // Carried through every autosave so they're never dropped on write.
  const legacyDraftRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const operatorId = asOnboardingUserId(userId);
        const key = getOrCreateOnboardingIdempotencyKey(operatorId);
        const session = await getOrCreateOnboardingSession(supabase, operatorId, key);
        if (cancelled) return;
        const draft = parseDraftAnswers(session.draft_answers);
        // Same mapper IPI-1260's lean wizard will consume — one compatibility
        // implementation, not a second ad-hoc check. current_screen is only a
        // hint here; durable status/brand_id/organization_id decide.
        const step = resolveSemanticStep({
          status: session.status,
          currentScreen: session.current_screen,
          brandId: session.brand_id,
          organizationId: session.organization_id,
          draft,
        });
        // Already materialized (idempotent resume) — the workspace owns the user now.
        if (step === "materialized") {
          router.replace("/app");
          return;
        }
        // Defense-in-depth: a user who completed onboarding under a different
        // key (e.g. cleared browser storage) must not be shown the form again.
        const alreadyOnboarded = await hasMaterializedOnboardingSession(supabase, operatorId);
        if (cancelled) return;
        if (alreadyOnboarded) {
          router.replace("/app");
          return;
        }
        sessionIdRef.current = asOnboardingSessionId(session.id);
        const { brandName: draftBrandName, websiteUrl: draftWebsiteUrl, ...legacy } = draft;
        legacyDraftRef.current = legacy;
        setBrandName(draftBrandName);
        setWebsiteUrl(draftWebsiteUrl);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("onboarding load failed", err);
        setLoadError("Couldn't load your onboarding. Please refresh and try again.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
    };
  }, [router, userId]);

  /**
   * Serialized autosave: writes run one at a time and always end on the latest
   * snapshot, so an older in-flight request can never overwrite a newer draft.
   * On failure the snapshot is kept (unless a newer edit superseded it) so
   * Retry re-saves the newest state. Returns false when a write failed.
   */
  const flushSave = useCallback(async (): Promise<boolean> => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return true;
    // Wait for any in-flight save to settle so submit can drain the queue
    // before materializing — a stale autosave must never touch a materialized row.
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
          // Restore the failed snapshot only when no newer edit arrived while it
          // was in flight — otherwise Retry would persist stale edits.
          if (!pendingSaveRef.current) {
            pendingSaveRef.current = snapshot;
          }
          setSaveState("error");
          return false;
        }
      }
      return true;
    } finally {
      saveInFlightRef.current = false;
    }
  }, []);

  const saveDraft = useCallback(
    (name: string, url: string) => {
      // Merge onto any preserved legacy keys so autosave never overwrites
      // draft_answers with a smaller object than what was loaded.
      pendingSaveRef.current = { ...legacyDraftRef.current, brandName: name, websiteUrl: url };
      if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void flushSave();
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  const retrySave = useCallback(() => {
    void flushSave();
  }, [flushSave]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = brandName.trim();
    if (!name) {
      setSubmitError("Brand name is required.");
      return;
    }
    const urlError = validateUrl(websiteUrl);
    if (urlError) {
      setSubmitError(urlError);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Persist any pending draft first; a failed save must block materialization
      // so the user's latest edits are never lost.
      const saved = await flushSave();
      if (!saved) {
        setSubmitError("Couldn't save your draft. Please retry.");
        setSubmitting(false);
        return;
      }
      const supabase = createClient();
      const key = getOrCreateOnboardingIdempotencyKey(asOnboardingUserId(userId));
      await materializeOnboarding(supabase, { brandName: name, websiteUrl }, { idempotencyKey: key });
      router.replace("/app");
    } catch (err) {
      // A concurrent materialization from another storage context may have won
      // the race (the DB partial unique index rejects the second). Recover by
      // checking whether the user is now onboarded instead of showing an error.
      try {
        const supabase = createClient();
        const alreadyOnboarded = await hasMaterializedOnboardingSession(
          supabase,
          asOnboardingUserId(userId),
        );
        if (alreadyOnboarded) {
          router.replace("/app");
          return;
        }
      } catch {
        // fall through to the error path below
      }
      console.error("onboarding materialization failed", err);
      setSubmitError("Couldn't create your brand. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-sm text-[var(--muted-foreground)]" data-testid="onboarding-loading">
        Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8">
        <ErrorState message={loadError} />
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md" data-testid="onboarding-form">
      <CardHeader>
        <CardTitle>Set up your brand</CardTitle>
        <CardDescription>
          Create your first brand to open the workspace. You can add your website later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="brandName" className="text-sm font-medium">
              Brand name
            </label>
            <input
              id="brandName"
              name="brandName"
              value={brandName}
              onChange={(event) => {
                setBrandName(event.target.value);
                saveDraft(event.target.value, websiteUrl);
              }}
              disabled={submitting}
              autoComplete="organization"
              placeholder="Maison Noir"
              className={inputClassName}
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="websiteUrl" className="text-sm font-medium">
              Website{" "}
              <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
            </label>
            <input
              id="websiteUrl"
              name="websiteUrl"
              value={websiteUrl}
              onChange={(event) => {
                setWebsiteUrl(event.target.value);
                saveDraft(brandName, event.target.value);
              }}
              disabled={submitting}
              inputMode="url"
              autoComplete="url"
              placeholder="https://maisonnoir.com"
              className={inputClassName}
            />
          </div>

          {submitError ? (
            <p
              role="alert"
              className="text-sm text-[var(--destructive)]"
              data-testid="onboarding-submit-error"
            >
              {submitError}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create brand"}
          </Button>
          <div
            className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"
            aria-live="polite"
          >
            {saveState === "saving" ? (
              <span>Saving draft…</span>
            ) : saveState === "error" ? (
              <>
                <span>Couldn&rsquo;t save your draft.</span>
                <button type="button" onClick={retrySave} className="underline">
                  Retry
                </button>
              </>
            ) : (
              <span>Your draft is saved automatically.</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}