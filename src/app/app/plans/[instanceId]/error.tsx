"use client";

import { ErrorState } from "@/components/ui/error-state";

/** IPI-1074 · PLANS-001 — plan workspace error boundary. */
export default function AppPlanDetailError({ reset }: { reset: () => void }) {
  return (
    <div className="p-8">
      <ErrorState
        message="Couldn't load this plan. Please try again shortly."
        onRetry={() => reset()}
      />
    </div>
  );
}