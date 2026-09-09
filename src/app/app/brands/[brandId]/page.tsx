import { notFound } from "next/navigation";

import { StartAnalysisButton } from "@/components/brand/start-analysis-button";
import { BrandDNAReviewCard } from "@/components/brand/brand-dna-review-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatusChip } from "@/components/ui/status-chip";
import { appWorkspaceDependencies, requireResolvedAppWorkspace } from "@/lib/auth/app-shell";
import { isDatabaseUuid } from "@/lib/database-uuid";
import { loadBrandDetail, type BrandDetail } from "@/lib/brand/get-brand-detail";

/**
 * IPI-1093 · BRAND-INTEL-001 — `/app/brands/[brandId]` Brand DNA review.
 *
 * Durable-state architecture (not an AG-UI interrupt): this workflow's
 * `startAsync` is fire-and-forget, so its later `saveDraftAndWait`
 * suspension is not reliably the same active AG-UI turn. This page reads
 * durable Supabase state directly (`intake_status` / `ai_profile_draft` /
 * server-computed `get_brand_draft_hash`) instead of assuming
 * `useInterrupt` bridges a background workflow it was never proven to
 * reach.
 *
 * IN_PROGRESS_STATUSES / RUNNING intentionally covers every intake_status
 * that isn't a terminal or reviewable state — see brand_intake_status.
 */
const RUNNING_STATUSES = new Set(["crawl_running", "crawl_complete", "analysis_running", "scores_complete"]);

function RunningState() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <StatusChip dot="var(--color-info, #3b82f6)" label="Analyzing" />
        </div>
        <CardDescription>
          Crawling the site and drafting a Brand DNA profile — this typically takes 2–5
          minutes. Refresh this page in a moment.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function FailedState({ brandId }: { brandId: string }) {
  return (
    <Card>
      <CardHeader>
        <StatusChip dot="var(--color-destructive, #ef4444)" label="Analysis failed" />
        <CardDescription>The last analysis run didn&apos;t complete. Try again.</CardDescription>
      </CardHeader>
      <CardContent>
        <StartAnalysisButton brandId={brandId} label="Retry analysis" />
      </CardContent>
    </Card>
  );
}

function ApprovedState({ detail }: { detail: BrandDetail }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{detail.approvedProfile?.name ?? detail.name} — Approved Brand DNA</CardTitle>
          <StatusChip dot="var(--color-approved, #22c55e)" label="Approved" />
        </div>
        <CardDescription>
          Approved {detail.approvedProfileAt ? new Date(detail.approvedProfileAt).toLocaleString() : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {detail.approvedProfile ? (
          <p className="text-[var(--muted-foreground)]">{detail.approvedProfile.tagline?.value}</p>
        ) : (
          <p className="text-[var(--muted-foreground)]">
            Approved, but the stored profile couldn&apos;t be displayed in this view.
          </p>
        )}
        <StartAnalysisButton brandId={detail.id} label="Run a new analysis" variant="outline" />
      </CardContent>
    </Card>
  );
}

function NoAnalysisState({ detail }: { detail: BrandDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No Brand DNA yet</CardTitle>
        <CardDescription>
          {detail.brandUrl
            ? "Start an analysis to generate an evidence-backed Brand DNA draft for review."
            : "Add a website URL to this brand before starting an analysis."}
        </CardDescription>
      </CardHeader>
      {detail.brandUrl && (
        <CardContent>
          <StartAnalysisButton brandId={detail.id} label="Start analysis" />
        </CardContent>
      )}
    </Card>
  );
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  await requireResolvedAppWorkspace(appWorkspaceDependencies);

  const supabase = await appWorkspaceDependencies.getServerClient();
  if (!supabase) {
    return (
      <div className="p-8">
        <ErrorState message="The workspace is temporarily unavailable. Please try again shortly." />
      </div>
    );
  }

  const { brandId } = await params;
  if (!isDatabaseUuid(brandId)) notFound();

  const result = await loadBrandDetail(supabase, brandId);
  if (result.status === "not_found") notFound();
  if (result.status !== "found") {
    return (
      <div className="p-8">
        <ErrorState message="Couldn't load this brand. Please try again shortly." />
      </div>
    );
  }

  const { detail } = result;

  // Priority: an actionable draft always takes precedence — including when
  // a re-run produced a new draft for an already-approved brand.
  let body: React.ReactNode;
  if (detail.draft && detail.draftHash) {
    body = (
      <BrandDNAReviewCard
        brandId={detail.id}
        draft={detail.draft}
        draftHash={detail.draftHash}
        draftScores={detail.draftScores}
      />
    );
  } else if (detail.draftHash === null && detail.intakeStatus === "draft_ready") {
    // Draft exists in DB but failed to parse into the current schema shape.
    body = <ErrorState message="This draft couldn't be displayed. Please re-run the analysis." />;
  } else if (detail.approvedProfileAt) {
    body = <ApprovedState detail={detail} />;
  } else if (RUNNING_STATUSES.has(detail.intakeStatus)) {
    body = <RunningState />;
  } else if (detail.intakeStatus === "failed") {
    body = <FailedState brandId={detail.id} />;
  } else {
    body = <NoAnalysisState detail={detail} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{detail.name}</h1>
        {detail.brandUrl && (
          <a
            href={detail.brandUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--muted-foreground)] underline"
          >
            {detail.brandUrl}
          </a>
        )}
      </div>
      {body}
    </div>
  );
}
