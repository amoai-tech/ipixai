import type { Page, Request } from "@playwright/test";

/**
 * Resource paths Vercel owns and only serves for deployments it builds itself.
 *
 * `@vercel/analytics` renders `/_vercel/insights/script.js` on every Vercel
 * deployment, but Vercel serves that path only for Vercel-built deployments.
 * Measured 2026-09-26 on this project: 200 `application/javascript` on the
 * production deployment (Vercel-built), 404 on every `vercel build --prebuilt`
 * deployment — the exact-SHA Preview workflow, preview URLs, and a
 * `--prebuilt` production attempt. That is provider-owned noise, not an
 * application defect.
 *
 * Filtering requires both conditions, never a blanket "ignore 404s" rule,
 * which would hide real application 404s:
 *
 * 1. the request path is a provider-owned root path — matched on the parsed
 *    `pathname` with `startsWith`, so an application route or query value that
 *    merely contains the text (for example
 *    `/api/proxy?resource=/_vercel/insights/script.js`) is still reported;
 * 2. the console message is the browser's own failed-subresource message for a
 *    404 — so a runtime error, CSP violation, or explicit `console.error`
 *    raised by that script is still reported.
 */
const PROVIDER_OWNED_RESOURCE_PATHS = ["/_vercel/insights/", "/_vercel/speed-insights/"];

/** The browser's own console message for a subresource that failed to load. */
const FAILED_RESOURCE_NOT_FOUND =
  /^Failed to load resource: the server responded with a status of 404\b/;

export function isProviderOwnedResourcePath(url: string | undefined | null): boolean {
  if (!url) return false;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  return PROVIDER_OWNED_RESOURCE_PATHS.some((path) => pathname.startsWith(path));
}

export function isProviderOwnedMissingResource(
  url: string | undefined | null,
  message: string,
): boolean {
  return isProviderOwnedResourcePath(url) && FAILED_RESOURCE_NOT_FOUND.test(message);
}

/**
 * Collects every console.error, uncaught page error, and 5xx response a page
 * produces. A journey ends with `expect(problems).toEqual([])`.
 *
 * `expected` lists messages a test deliberately provokes (for example a forced
 * 500 and the app's own logged handling of it). Anything else still fails.
 *
 * Console errors carry the failing resource URL so a recorded problem names
 * the exact request instead of an anonymous "Failed to load resource".
 */
export function collectBrowserProblems(page: Page, expected: RegExp[] = []) {
  const problems: string[] = [];
  const record = (line: string) => {
    if (!expected.some((pattern) => pattern.test(line))) problems.push(line);
  };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    if (isProviderOwnedMissingResource(location.url, message.text())) return;
    record(
      `console.error: ${message.text()}${location.url ? ` (${location.url})` : ""}`,
    );
  });
  page.on("pageerror", (error) => {
    record(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      record(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return problems;
}

export const isAgentRun = (request: Request) =>
  request.method() === "POST" && /\/agent\/[^/]+\/run/.test(request.url());

export const isAgentStop = (request: Request) =>
  request.method() === "POST" && /\/stop\//.test(request.url());
