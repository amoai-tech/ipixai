import { notFound } from "next/navigation";

import { StartAnalysisButton } from "@/components/brand/start-analysis-button";
import { BrandDNAReviewCard } from "@/components/brand/brand-dna-review-card";
import { InvalidDraftErrorState } from "@/components/brand/invalid-draft-error-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatusChip } from "@/components/ui/status-chip";
import { appWorkspaceDependencies, requireResolvedAppWorkspace } from "@/lib/auth/app-shell";
import { isDatabaseUuid } from "@/lib/database-uuid";
import { loadBrandDetail, type BrandDetail } from "@/lib/brand/get-brand-detail";
import { selectBrandDetailView } from "./select-view";

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
 * State selection lives in `./select-view` as a pure function — see its
 * doc comment for the parse-failure-vs-no-draft bug it exists to prevent.
 */

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

  let body: React.ReactNode;
  switch (selectBrandDetailView(detail)) {
    case "review":
      // Non-null asserted for TS: selectBrandDetailView's "review" case is
      // exactly `detail.draft && detail.draftHash` both truthy.
      body = (
        <BrandDNAReviewCard
          brandId={detail.id}
          draft={detail.draft!}
          draftHash={detail.draftHash!}
          draftScores={detail.draftScores}
        />
      );
      break;
    case "parse_error":
      // Non-null asserted for TS: selectBrandDetailView's "parse_error" case
      // is exactly `detail.draftHash !== null && detail.draft === null`.
      body = <InvalidDraftErrorState brandId={detail.id} draftHash={detail.draftHash!} />;
      break;
    case "approved":
      body = <ApprovedState detail={detail} />;
      break;
    case "running":
      body = <RunningState />;
      break;
    case "failed":
      body = <FailedState brandId={detail.id} />;
      break;
    case "no_analysis":
      body = <NoAnalysisState detail={detail} />;
      break;
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
