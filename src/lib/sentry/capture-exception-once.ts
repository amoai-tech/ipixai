import * as Sentry from "@sentry/nextjs";

const capturedErrors = new WeakSet<Error>();

/** Capture one Error object once, including React Strict Mode effect remounts. */
export function captureExceptionOnce(error: Error): void {
  if (capturedErrors.has(error)) return;
  capturedErrors.add(error);
  Sentry.captureException(error);
}
