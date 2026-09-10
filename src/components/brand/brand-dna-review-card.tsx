"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { decideBrandDraft } from "@/app/app/brands/[brandId]/actions";
import type { BrandClaim, BrandDraftScore, BrandProfile } from "@/lib/brand/brand-profile-contract";

/**
 * IPI-1093 · BRAND-INTEL-001 — the D1/H1-bound Brand DNA review card.
 *
 * Consequential-action rule: this card renders the EXACT server-hashed
 * draft (`draftHash` from `get_brand_draft_hash`, never recomputed here)
 * and requires an explicit operator click before any decision is sent —
 * no automatic approval, no client-side hash computation.
 *
 * No "Regenerate" action here (task-verifier finding): the workflow's own
 * claim guard (`validateBrand` in brand-intelligence.ts) rejects starting a
 * new run while `intake_status = 'draft_ready'` — exactly the status this
 * card is shown for — so a one-click regenerate button here would always
 * fail. Reject clears the draft (`intake_status` -> `brand_created`, which
 * the guard allows), which is the one route back to starting a fresh run.
 */

function ClaimBlock({ label, claim }: { label: string; claim?: BrandClaim }) {
  if (!claim) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      <p className="mt-1 text-sm">{claim.value}</p>
      <ul className="mt-1 space-y-0.5">
        {claim.evidence.map((evidence, i) => (
          <li key={i} className="text-xs text-[var(--muted-foreground)]">
            &ldquo;{evidence.quote}&rdquo; —{" "}
            <a
              href={evidence.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {evidence.sourceUrl}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      <p className="mt-1 text-sm">{items.join(", ")}</p>
    </div>
  );
}

function ScoresBlock({ scores }: { scores: BrandDraftScore[] }) {
  if (scores.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        Scores
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {scores.map((score) => (
          <div key={score.score_type} className="flex justify-between gap-2">
            <span className="text-[var(--muted-foreground)]">
              {score.score_type.replace(/_/g, " ")}
            </span>
            <span>{score.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrandDNAReviewCard({
  brandId,
  draft,
  draftHash,
  draftScores,
  canDecide,
}: {
  brandId: string;
  draft: BrandProfile;
  draftHash: string;
  draftScores: BrandDraftScore[];
  /** Bot finding (Kilo) — the RPC already enforces editor/owner server-side
   *  (the real authorization boundary); this only hides/disables the
   *  controls so a viewer isn't shown actions that will fail. */
  canDecide: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  function decide(approved: boolean) {
    setBanner(null);
    startTransition(async () => {
      const result = await decideBrandDraft(brandId, draftHash, approved);
      setBanner({ kind: result.ok ? "info" : "error", text: result.message });
      // STALE_DRAFT / FORBIDDEN / etc. leave this exact card in place so
      // the operator sees why; a committed decision (ok:true) refreshes
      // so the page re-renders from the now-current durable Brand state.
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{draft.name} — Brand DNA draft</CardTitle>
          <StatusChip dot="var(--color-warning, #eab308)" label="Awaiting your review" />
        </div>
        <CardDescription>
          Reviewed hash:{" "}
          <code className="text-xs">{draftHash.slice(0, 16)}…</code> — approving or
          rejecting always acts on this exact draft. If it changes before you
          decide, the decision fails closed instead of applying to unseen
          content.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {banner && (
          <p
            role={banner.kind === "error" ? "alert" : "status"}
            className={
              banner.kind === "error"
                ? "text-sm text-[var(--destructive)]"
                : "text-sm text-[var(--muted-foreground)]"
            }
          >
            {banner.text}
          </p>
        )}

        <ClaimBlock label="Tagline" claim={draft.tagline} />
        <ClaimBlock label="Category" claim={draft.category} />
        <ClaimBlock label="Positioning" claim={draft.positioning} />
        <ClaimBlock label="Target audience" claim={draft.targetAudience} />
        <ClaimBlock label="Overview" claim={draft.overview} />
        <ClaimBlock label="Mission" claim={draft.mission} />
        <ClaimBlock label="Vision" claim={draft.vision} />
        <ClaimBlock label="UVP" claim={draft.uvp} />
        <ClaimBlock label="Brand personality" claim={draft.brandPersonality} />
        <ClaimBlock label="Brand voice" claim={draft.brandVoice} />
        <ListBlock label="Values" items={draft.values} />
        <ListBlock label="Content pillars" items={draft.contentPillars} />
        <ListBlock label="Recommended services" items={draft.recommendedServices} />
        <ListBlock label="Competitor signals" items={draft.competitorSignals} />

        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Visual identity
          </div>
          <p className="mt-1 text-sm">
            {draft.visualIdentity.mood} — {draft.visualIdentity.colors.join(", ")}
          </p>
        </div>

        {typeof draft.confidenceScore === "number" && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Overall confidence: {draft.confidenceScore}
          </p>
        )}

        <ScoresBlock scores={draftScores} />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2">
        <Button onClick={() => decide(true)} disabled={isPending || !canDecide}>
          {isPending ? "Submitting…" : "Approve"}
        </Button>
        <Button
          variant="destructive"
          onClick={() => decide(false)}
          disabled={isPending || !canDecide}
        >
          Reject
        </Button>
        {!canDecide && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Only editors and owners can approve or reject this draft.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
