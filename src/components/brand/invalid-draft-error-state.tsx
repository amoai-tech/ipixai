"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";
import { decideBrandDraft } from "@/app/app/brands/[brandId]/actions";

/**
 * IPI-1093 · BRAND-INTEL-001 (task-verifier finding) — a draft that fails
 * schema validation has no recovery path: startBrandAnalysis's claim guard
 * rejects intake_status='draft_ready' (same reason Regenerate was removed
 * from the review card), so "please re-run the analysis" was a dead end.
 * Reject doesn't require a parseable BrandProfile — it validates the raw
 * draft binding and clears ai_profile_draft (-> brand_created, which the
 * claim guard allows) — so it's the one exact-hash-safe way out of this
 * state.
 */
export function InvalidDraftErrorState({ brandId, draftHash }: { brandId: string; draftHash: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function discard() {
    setError(null);
    startTransition(async () => {
      const result = await decideBrandDraft(brandId, draftHash, false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <ErrorState
      message={
        error ?? "This draft couldn't be displayed and can't be re-analyzed until it's cleared."
      }
      onRetry={discard}
      retryLabel={isPending ? "Clearing…" : "Discard this draft"}
    />
  );
}
