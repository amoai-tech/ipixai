import { test, expect } from "@playwright/test";

import { previewBypassHeaders } from "../playwright.config";
import { signInAsE2ETestOperator } from "./support/login";
import { establishAndProveVercelBypass } from "./support/vercel-bypass";

/**
 * The one deliberate extra UI login in the suite, beyond auth.setup.ts —
 * proves the real login form end-to-end rather than only reusing a saved
 * cookie. Restricted to the "chromium" project only (see mobile-chromium's
 * `testIgnore` in playwright.config.ts) so the hosted account is signed
 * into exactly twice per full run (setup + this), not once per viewport.
 */
// This file enters a raw password; never persist trace/screenshot artifacts.
test.use({ trace: "off", screenshot: "off" });

test.describe("clean login journey", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(60_000);

  // IPI-1091 · E2E-PREVIEW-BYPASS-001 — this test is deliberately the one
  // context that starts with neither an iPix session nor Vercel's protection
  // cookie. Without a fresh, deployment-scoped bypass, `/login` is Vercel's
  // SSO screen instead of the iPix form. Reuse the existing scoped helpers;
  // never fix this with context-wide `extraHTTPHeaders` or by disabling
  // Deployment Protection.
  //
  // Keep this hook scoped to the clean-login describe: the dashboard journey
  // below reuses auth.setup's storageState, which already carries the bypass
  // cookie, and re-running the establishment there can fail while Vercel
  // refreshes an existing cookie without adding a new one.
  test.beforeEach(async ({ context, page, baseURL }) => {
    const headers = await previewBypassHeaders(
      baseURL ?? "",
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    );
    if (!headers) return; // localhost — no Vercel protection to clear

    if (!baseURL) {
      throw new Error(
        "E2E baseURL is required to clear Vercel Deployment Protection, but `use.baseURL` is unset.",
      );
    }

    await establishAndProveVercelBypass({
      context,
      page,
      deploymentOrigin: new URL(baseURL).origin,
      headers,
    });
  });

  test("critical journey: login succeeds @T5dbe2c0f", async ({ page }) => {
    await signInAsE2ETestOperator(page);
    // Explicit here (not just inside the shared helper) — this is the
    // public, user-observable proof that password sign-in lands the
    // operator on the /app Command Center (IPI-1058 · MARKETING-LOGIN-001),
    // not an internal implementation detail.
    await expect(page).toHaveURL(/\/app$/);
  });
});

// PR #52 (IPI-1066) merged — /app is the real Command Center now.
// Reuses the auth.setup storageState (already signed in) so this test does
// not trigger a second password sign-in that Supabase may rate-limit.
test.describe("dashboard navigation (reuses auth.setup session) @Sb901bcd7", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("critical journey: dashboard → brand navigation @T4dd34fbf", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.getByRole("link", { name: "Open Brands" }).click();
    await expect(page).toHaveURL(/\/app\/brands$/);
  });
});
