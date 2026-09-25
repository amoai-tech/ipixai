import { test } from "@playwright/test";

/**
 * Compiles the app's routes once, signed in, before the suite runs.
 *
 * `next dev` (Turbopack) compiles each route on first request and only frees
 * that memory after a snapshot, which needs a short pause. The suite hits new
 * routes back to back, so on a 16 GB CI runner the dev server grew to ~13 GB
 * and the runner was killed mid-suite ("received a shutdown signal"). Visiting
 * each route here, pausing after any real compile, keeps the peak to one
 * route's compile; the suite then mostly reuses compiled routes.
 *
 * Read-only: page GETs as the QA user. Unknown ids just render not-found, which
 * still compiles the route. Skipped against a remote E2E_BASE_URL (no compile).
 */
const MISSING_ID = "00000000-0000-4000-8000-000000000000";
const ROUTES = [
  "/",
  "/signup",
  "/services/amazon",
  "/app",
  "/app/brands",
  `/app/brands/${MISSING_ID}`,
  "/app/shoots",
  `/app/shoots/${MISSING_ID}`,
  "/app/plans",
  "/app/plans/dashboard",
  `/app/plans/${MISSING_ID}`,
  "/app/assets",
  "/onboarding",
  "/planner",
];
// API routes compile on first request too. A plain GET is safe for every one:
// read-only handlers answer (or 401), POST-only handlers answer 405 without
// running, and either way the route is compiled.
const API_ROUTES = [
  "/api/copilotkit/info",
  "/api/planner/threads",
  `/api/planner/threads/${MISSING_ID}/messages`,
  `/api/planner/threads/${MISSING_ID}/seed-rich-history`,
  "/api/plans/references",
  "/api/plans/reviews",
  `/api/assets/${MISSING_ID}/preview`,
  `/api/references/${MISSING_ID}/preview`,
  "/api/shoots/save",
];
// A route already compiled answers in well under a second; a first compile
// takes several. Measured on a 16 GB machine: with a 6 s pause after each
// first compile the dev server fell back to 0.6-1.9 GB between routes (peak
// 4.8 GB); with 2 s pauses it did not free memory and kept climbing.
const COMPILED_MS = 1_500;
const SETTLE_MS = 6_000;

test("compile routes before the suite", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "remote target: nothing to compile");
  test.setTimeout(8 * 60_000);

  for (const route of ROUTES) {
    const started = Date.now();
    // Warmup only compiles; the suite asserts behaviour. Report, don't fail.
    await page.goto(route, { waitUntil: "load", timeout: 120_000 }).catch((error: unknown) => {
      console.warn(`[warmup] ${route} did not load: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (Date.now() - started > COMPILED_MS) await page.waitForTimeout(SETTLE_MS);
  }
  for (const route of API_ROUTES) {
    const started = Date.now();
    await page.request.get(route, { timeout: 120_000, maxRedirects: 0 }).catch((error: unknown) => {
      console.warn(`[warmup] ${route} did not respond: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (Date.now() - started > COMPILED_MS) await page.waitForTimeout(SETTLE_MS);
  }
});
