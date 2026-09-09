"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { startBrandAnalysisAction } from "@/app/app/brands/[brandId]/actions";

// startBrandAnalysis's workflow.startAsync() is fire-and-forget (see the
// installed @mastra/core types): it returns as soon as the run is
// dispatched, before the workflow's first step (the one that actually
// claims intake_status) has necessarily committed. An immediate refresh
// can therefore still render the old status. This brief pause is the
// lightweight fix — not a poll loop — before re-reading durable state.
const REFRESH_SETTLE_MS = 800;

/** Shared "start/regenerate analysis" trigger — used for the no-analysis,
 *  failed, and draft_ready-regenerate states. On success it refreshes the
 *  Server Component so intake_status/draft reflect the new run without a
 *  full navigation. */
export function StartAnalysisButton({
  brandId,
  label,
  variant = "default",
}: {
  brandId: string;
  label: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  function run() {
    setError(null);
    setStarted(false);
    startTransition(async () => {
      const result = await startBrandAnalysisAction(brandId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStarted(true);
      await new Promise((resolve) => setTimeout(resolve, REFRESH_SETTLE_MS));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button variant={variant} onClick={run} disabled={isPending}>
        {isPending ? "Starting…" : label}
      </Button>
      {isPending && started && (
        <p role="status" className="text-sm text-[var(--muted-foreground)]">
          Analysis started — updating…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}
