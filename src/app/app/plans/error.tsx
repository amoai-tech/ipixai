"use client";

import { ErrorState } from "@/components/ui/error-state";

/** IPI-1074 · PLANS-001 — plans segment error boundary. */
export default function AppPlansError() {
  return (
    <div className="p-8">
      <ErrorState message="Something went wrong loading plans. Please try again shortly." />
    </div>
  );
}