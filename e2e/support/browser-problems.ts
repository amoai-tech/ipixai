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
 * Filtering is by exact path segment, never a blanket "ignore 404s" rule,
 * which would hide real application 404s.
 */
const PROVIDER_OWNED_RESOURCE_PATHS = ["/_vercel/insights/", "/_vercel/speed-insights/"];

export function isProviderOwnedResource(url: string | undefined | null): boolean {
  if (!url) return false;
  return PROVIDER_OWNED_RESOURCE_PATHS.some((path) => url.includes(path));
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
    if (isProviderOwnedResource(location.url)) return;
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
