import { test, expect, type Browser } from "@playwright/test";

import { createCleanContext, gotoPageWithRetry } from "./support/context";
import { signInWithCredentials } from "./support/login";
import { getOwnOrgId } from "./support/tenant-supabase";

// Session-reuse regression: proves sign-out is local and that a secondary
// user always starts from a clean browser, so QA B can never accidentally
// inherit QA A's auth state. No secret-bearing artifacts.
test.use({ trace: "off", screenshot: "off" });
test.setTimeout(90_000);

async function requireEnv(name: string): Promise<string> {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing — set it in .env.test`);
  }
  return value;
}

/**
 * QA A signs in, signs out through the real UI, then QA B signs in from a
 * brand-new clean context. Proves sign-out is local (the signed-out browser
 * renders the login form, not a residual session) and that QA B never
 * inherits QA A's tenant.
 *
 * Both users authenticate in their own clean contexts rather than the shared
 * auth.setup storageState: signing out QA A revokes that session server-side
 * (scope "local" revokes the current session, just not the user's other
 * sessions), so it must not invalidate a fixture other tests rely on.
 */
test("QA A sign-out is local and QA B starts from a clean session", async ({ browser }) => {
  const emailA = await requireEnv("E2E_TEST_EMAIL");
  const passwordA = await requireEnv("E2E_TEST_PASSWORD");
  const emailB = await requireEnv("E2E_TEST_EMAIL_ORG_B");
  const passwordB = await requireEnv("E2E_TEST_PASSWORD_ORG_B");

  const contextA = await createCleanContext(browser);
  const pageA = await contextA.newPage();
  try {
    await signInWithCredentials(pageA, emailA, passwordA);
    const orgAId = await getOwnOrgId(pageA);

    // Real-UI sign-out: operator-panel posts to /auth/sign-out, which now uses
    // supabase.auth.signOut({ scope: "local" }) — only this browser signs out.
    await gotoPageWithRetry(pageA, "/app");
    await expect(pageA.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await pageA.getByRole("button", { name: "Sign out" }).click();

    // Local sign-out must land the user back on the login page.
    await expect(pageA).toHaveURL(/\/login$/);

    // The same browser that just signed out must render the login form (not be
    // bounced away by a residual session), and a fresh sign-in must work.
    const signIn = pageA.getByRole("button", { name: "Sign in" });
    await expect(signIn).toBeVisible();

    // QA B authenticates in a brand-new, fully logged-out browser context so it
    // can never inherit QA A's cookies/localStorage (the original failure mode).
    const contextB = await createCleanContext(browser);
    const pageB = await contextB.newPage();
    try {
      await signInWithCredentials(pageB, emailB, passwordB);
      const orgBId = await getOwnOrgId(pageB);

      // QA A and QA B must belong to different organizations, proving the fresh
      // session did not inherit QA A's tenant.
      expect(orgAId, "Org A and Org B sessions must belong to different organizations").not.toBe(
        orgBId,
      );
    } finally {
      await contextB.close();
    }
  } finally {
    await contextA.close();
  }
});

/**
 * Dirty-session guard: signing in from a context that already holds another
 * user's session must fail fast with a clear error instead of silently
 * waiting out the sign-in timeout. We establish a real QA A session in a
 * clean context, then call the login helper again on the same page — the
 * /login server guard bounces the authenticated browser to /app, which the
 * helper detects and reports.
 */
test("login helper fails fast when the session is already dirty", async ({ browser }) => {
  const email = await requireEnv("E2E_TEST_EMAIL");
  const password = await requireEnv("E2E_TEST_PASSWORD");

  const context = await createCleanContext(browser);
  const page = await context.newPage();
  try {
    await signInWithCredentials(page, email, password);
    await gotoPageWithRetry(page, "/app");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await expect(signInWithCredentials(page, email, password)).rejects.toThrow(
      /already authenticated/i,
    );
  } finally {
    await context.close();
  }
});