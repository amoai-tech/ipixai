import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// E2E credentials and overrides live in .env.test (gitignored, see .env.example).
dotenv.config({ path: path.resolve(__dirname, ".env.test") });
// NEXT_PUBLIC_SUPABASE_URL / PUBLISHABLE_KEY for direct read-only REST calls
// from spec files (e.g. tenant-isolation.spec.ts's org-identity check) — the
// webServer's spawned Next process reads .env on its own, but the Playwright
// test runner process does not; load it here too. No-ops harmlessly when
// .env doesn't exist (CI supplies these as real job env vars instead).
dotenv.config({ path: path.resolve(__dirname, ".env") });

const hasExplicitBaseURL = Boolean(process.env.E2E_BASE_URL);
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3015";
const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL);

// These tests perform real sign-ins with real credentials — fail closed
// rather than let a misconfigured/malicious E2E_BASE_URL point that at
// production (ipix.co), someone else's vercel.app deployment, or any other
// host. Only localhost and this project's own Vercel previews are allowed —
// verified live (not guessed) from this repo's own PR deployment comments:
// ipixai-git-ai-ipi-1066-...-amo1000.vercel.app (PR #52),
// ipixai-git-e2e-playwright-setup-amo1000.vercel.app (PR #53). Project
// "ipixai" under the "amo1000" Vercel team/scope — any other vercel.app
// subdomain, including a bare one, is rejected.
const ALLOWED_PREVIEW_HOST = /^ipixai(-[a-z0-9-]+)?-amo1000\.vercel\.app$/i;
const parsedBaseUrl = new URL(baseURL);
const isAllowedBaseUrl =
  isLocalTarget ||
  (parsedBaseUrl.protocol === "https:" && ALLOWED_PREVIEW_HOST.test(parsedBaseUrl.hostname));
if (!isAllowedBaseUrl) {
  throw new Error(
    `E2E_BASE_URL "${baseURL}" is not localhost or an ipixai/amo1000 Vercel preview — refusing to run real sign-in against it.`,
  );
}

export default defineConfig({
  testDir: "./e2e",
  // Production smoke has its own guarded config and must never run as part of
  // the normal localhost/Preview certification suite.
  testIgnore: /production-smoke\.spec\.ts/,
  // The canonical suite shares one real Org A account and one Next dev server.
  // Keep it deterministic locally and in CI; opt into parallelism only for
  // future tests with isolated accounts/backend state.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker avoids shared-account races and Turbopack cold-compile storms.
  workers: 1,
  // https://playwright.dev/docs/ci-intro — 'github' annotates failures
  // directly on the Actions run; keep 'html' too so CI still produces the
  // playwright-report/ dir the workflow uploads as an artifact.
  reporter: process.env.CI ? [["github"], ["html"]] : "html",
  use: {
    baseURL,
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    // Authenticates once via the real UI and persists storageState — every
    // other project depends on this instead of signing in per test.
    // https://playwright.dev/docs/auth
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chromium",
      // ~390px viewport (iPhone 12/13/14 width) on the Chromium engine
      // already cached locally — no extra browser download needed.
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
      // login-journey does its own real UI login (not storageState) —
      // one extra hosted sign-in beyond setup is enough; running it per
      // viewport too would sign into the real account 3× per full run.
      // Keep the production-only smoke excluded here too because project-level
      // testIgnore replaces the inherited/global value.
      testIgnore: [/login-journey\.spec\.ts/, /production-smoke\.spec\.ts/],
    },
  ],

  // With no explicit E2E_BASE_URL, Playwright owns a dedicated :3015 server.
  // It never reuses the developer-owned :3000 process, which could be another
  // branch. Any explicit URL is caller-owned and must already be running.
  webServer: isLocalTarget && !hasExplicitBaseURL
    ? {
        command: "npm run dev:e2e",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
});
