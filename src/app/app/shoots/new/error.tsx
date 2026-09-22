"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function NewShootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="p-8"><ErrorState title="Couldn't open the Shoot Wizard" message="Please try again. Your Shoot has not been saved." onRetry={reset} /></div>;
}
