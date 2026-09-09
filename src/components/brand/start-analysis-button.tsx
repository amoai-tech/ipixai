"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { startBrandAnalysisAction } from "@/app/app/brands/[brandId]/actions";

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

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await startBrandAnalysisAction(brandId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button variant={variant} onClick={run} disabled={isPending}>
        {isPending ? "Starting…" : label}
      </Button>
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
