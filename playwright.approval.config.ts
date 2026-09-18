import { defineConfig, devices } from "@playwright/test";

/**
 * IPI-1084 · APPROVAL-001 — PR 2b config: the local, deterministic tenant proof.
 *
 * Separate from playwright.config.ts on purpose. The main suite signs into the
 * shared HOSTED QA accounts (setup project → storageState) and must never be
 * pointed at a local database; this config's spec signs in as its own three
 * local fixtures and must never be pointed at hosted. Keeping them in separate
 * configs is what stops either from silently reusing the other's target.
 *
 * Invoked only through `npm run e2e:approval`
 * (scripts/run-approval-001-e2e.mjs), which provisions the local Supabase stack,
 * seeds the fixtures, and exports the local Supabase env for the server this
 * config starts.
 */

const baseURL = process.env.IPI1084_BASE_URL ?? "http://localhost:3016";
const port = new URL(baseURL).port || "3016";

// Port is optional: `http://localhost` is just as local as `http://localhost:3016`.
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL)) {
  throw new Error(
    `IPI1084_BASE_URL "${baseURL}" is not a local http origin — this proof must never run against a hosted target.`,
  );
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: /approval-001-tenant-review\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // These proofs are deterministic against a freshly seeded local database; a
  // retry would hide a real ordering/state defect rather than absorb flakiness.
  retries: 0,
  timeout: 120_000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "off",
    screenshot: "off",
  },
  projects: [{ name: "approval-local", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The runner exports the LOCAL Supabase env, so the server this starts talks
    // to the local stack even when the ambient shell still has hosted values.
    command: `next dev --turbopack -p ${port}`,
    url: baseURL,
    // NEVER reuse an existing listener. A stale process on this port may have
    // been started with hosted Supabase env or older code, which would silently
    // run the "local-only" proof against the wrong target. reuseExistingServer:
    // false makes Playwright fail closed instead; the runner also checks the
    // port up front so the failure message says what to do.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
