"use client";

import { useEffect } from "react";

import { captureExceptionOnce } from "@/lib/sentry/capture-exception-once";

import { ErrorState } from "@/components/ui/error-state";

/** IPI-1074 · PLANS-001 — plans segment error boundary. */
export default function AppPlansError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureExceptionOnce(error);
  }, [error]);

  return (
    <div className="p-8">
      <ErrorState
        message="Something went wrong loading plans. Please try again shortly."
        onRetry={() => reset()}
      />
    </div>
  );
}
