import type { CrawlRawData } from "./crawl-context.ts";
import { isCrawlThin } from "./crawl-context.ts";

export type GuardedError = {
  code: string;
  message: string;
  status: number;
};

/** Truthy after trim — whitespace-only secrets count as missing. */
function hasConfiguredSecret(value?: string | null): boolean {
  return Boolean(value?.trim());
}

/**
 * Returns 503 config_error when Gemini credentials are missing.
 * IPI-1093 — renamed from bi-groq-guards.ts and narrowed to Gemini-only;
 * Groq/Cloudflare Workers AI support was removed (unused, Gemini was
 * always the default and only actively exercised provider).
 */
export function missingBiProviderConfigError(
  secrets: { geminiApiKey?: string | null },
): GuardedError | null {
  if (!hasConfiguredSecret(secrets.geminiApiKey)) {
    return {
      code: "config_error",
      message: "Brand intelligence is not configured",
      status: 503,
    };
  }
  return null;
}

/**
 * Whether crawl text was included in the BI LLM request (telemetry +
 * diagnostic metadata) — Gemini uses Firecrawl crawl analysis when the
 * crawl is not thin and text exists; otherwise it falls back to
 * urlContext + googleSearch.
 */
export function biUsedCrawlInRequest(
  raw: CrawlRawData | null | undefined,
  crawlText: string,
): boolean {
  return !isCrawlThin(raw) && crawlText.trim().length > 0;
}
