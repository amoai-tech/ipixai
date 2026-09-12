import type { GroqRateLimitHeaders } from "./types.ts";

const RETRYABLE_STATUS = new Set([429, 502, 503]);

export function parseGroqRateLimitHeaders(
  headers: Headers,
): GroqRateLimitHeaders {
  const retryAfterRaw = headers.get("retry-after");
  const retryAfterMs = retryAfterRaw
    ? Number(retryAfterRaw) * 1000
    : undefined;

  const parseIntHeader = (name: string) => {
    const raw = headers.get(name);
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
    limitRequests: parseIntHeader("x-ratelimit-limit-requests"),
    remainingRequests: parseIntHeader("x-ratelimit-remaining-requests"),
    limitTokens: parseIntHeader("x-ratelimit-limit-tokens"),
    remainingTokens: parseIntHeader("x-ratelimit-remaining-tokens"),
  };
}

export function computeRetryDelayMs(
  attempt: number,
  headers: GroqRateLimitHeaders,
): number {
  if (headers.retryAfterMs && headers.retryAfterMs > 0) {
    return headers.retryAfterMs;
  }
  const base = 250 * 2 ** attempt;
  return Math.min(base, 8_000);
}

export async function withGroqRetry<T>(
  fn: () => Promise<Response>,
  maxAttempts = 3,
): Promise<Response> {
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fn();
    if (!RETRYABLE_STATUS.has(response.status)) {
      return response;
    }
    lastResponse = response;
    if (attempt === maxAttempts - 1) break;
    const delayMs = computeRetryDelayMs(
      attempt,
      parseGroqRateLimitHeaders(response.headers),
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return lastResponse!;
}

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}
