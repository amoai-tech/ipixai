"use client";

import { useEffect } from "react";

import { captureExceptionOnce } from "@/lib/sentry/capture-exception-once";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Next.js attaches a digest to sanitized Server Component/render errors.
    // Those are already captured server-side by instrumentation.onRequestError.
    if (typeof error.digest === "string") return;
    captureExceptionOnce(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main>
          <h1>Something went wrong</h1>
          <p>Please try again shortly.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
