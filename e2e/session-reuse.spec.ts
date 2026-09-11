import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { createCleanContext, gotoPageWithRetry } from "./support/context";
import { signInWithCredentials, SIGN_IN_TIMEOUT_MS } from "./support/login";
import { supabaseForPage } from "./support/tenant-supabase";

// Session-reuse regression: proves sign-out is local (a user's other sessions
// survive) and that a secondary user always starts from a clean browser, so
// QA B can never accidentally inherit QA A's auth state. All assertions are
// user-visible application behavior — no direct database probes. No
// secret-bearing artifacts.
test.use({ trace: "off", screenshot: "off" });
// Every sign-in can take up to SIGN_IN_TIMEOUT_MS, and each sign-in may run a
// second attempt after an ERR_NETWORK_CHANGED retry. Test 1 performs 3
// sign-ins (up to 6 attempts) plus dashboard navigations, so budget the whole
// test from that constant: 6 × SIGN_IN_TIMEOUT_MS for sign-ins plus one
// SIGN_IN_TIMEOUT_MS of navigation-retry headroom. No magic numbers.
test.setTimeout(SIGN_IN_TIMEOUT_MS * 7);

async function requireEnv(name: string): Promise<string> {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing — set it in .env.test`);
  }
  return value;
}

/** Sign `email`/`password` in from a brand-new clean context and land on /app. */
async function signInClean(
  browser: Browser,
  email: string,
  password: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await createCleanContext(browser);
  const page = await context.newPage();
  await signInWithCredentials(page, email, password);
  await gotoPageWithRetry(page, "/app");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  return { context, page };
}

/**
 * Local sign-out proof. QA A holds two sessions (two browsers). Signing out
 * in the first must NOT revoke the second: Supabase global sign-out would
 * kill every session for the user, so the second browser staying signed in
 * after a fresh /app navigation is exactly what distinguishes scope "local".
 * QA B then signs in from a brand-new clean context and sees its own (empty)
 * tenant, proving it never inherited QA A's session.
 *
 * The /app session check (getClaims) validates only the ACCESS TOKEN, which
 * stays valid until expiry even after a session is revoked — so the Dashboard
 * assertion alone cannot distinguish local from global sign-out. We therefore
 * also exercise session B's REFRESH path directly (refreshSession): global
 * sign-out revokes refresh tokens immediately, local sign-out does not, so a
 * successful refresh is the true local-vs-global discriminator.
 */
test("signing out in one browser leaves the user's other sessions signed in @Ta555b30b", async ({
  browser,
}) => {
  const emailA = await requireEnv("E2E_TEST_EMAIL");
  const passwordA = await requireEnv("E2E_TEST_PASSWORD");
  const emailB = await requireEnv("E2E_TEST_EMAIL_ORG_B");
  const passwordB = await requireEnv("E2E_TEST_PASSWORD_ORG_B");

  const sessionA = await signInClean(browser, emailA, passwordA);
  const sessionB = await signInClean(browser, emailA, passwordA);
  try {
    // Real-UI sign-out: operator-panel posts to /auth/sign-out, which now uses
    // supabase.auth.signOut({ scope: "local" }) — only this browser signs out.
    await sessionA.page.getByRole("button", { name: "Sign out" }).click();

    // The signed-out browser lands back on the login form.
    await expect(sessionA.page).toHaveURL(/\/login$/);
    await expect(sessionA.page.getByRole("button", { name: "Sign in" })).toBeVisible();

    // The user's OTHER session must survive. Re-navigating forces a fresh
    // server render: /app redirects to /login when the session is gone, so
    // the Dashboard still rendering is the local-vs-global proof.
    await gotoPageWithRetry(sessionB.page, "/app");
    await expect(sessionB.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // The real local-vs-global discriminator: global sign-out revokes the
    // user's refresh tokens, local sign-out does not. /app's getClaims() only
    // checks the access token (valid until expiry even when revoked), so
    // exercise session B's refresh path directly — it must still succeed.
    const supabaseB = await supabaseForPage(sessionB.page);
    const { data: refreshed, error: refreshError } = await supabaseB.auth.refreshSession();
    expect(
      refreshError,
      `session B refresh failed after local sign-out: ${refreshError?.message ?? "unknown"}`,
    ).toBeNull();
    expect(
      refreshed.session,
      "session B must still hold a valid session after local sign-out",
    ).not.toBeNull();

    // QA B authenticates in a brand-new, fully logged-out browser context so
    // it can never inherit QA A's cookies/localStorage (the original failure
    // mode). A dirty context would have bounced the sign-in as "already
    // authenticated"; succeeding as a fresh user is the isolation proof, and
    // QA B's dashboard renders its own empty tenant.
    const sessionC = await signInClean(browser, emailB, passwordB);
    try {
      await expect(sessionC.page.getByTestId("command-center-brand-list")).toHaveCount(0);
    } finally {
      await sessionC.context.close();
    }
  } finally {
    await sessionA.context.close();
    await sessionB.context.close();
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
test("an already-authenticated browser cannot sign in again — the attempt fails fast @Ta11fef0a", async ({
  browser,
}) => {
  const email = await requireEnv("E2E_TEST_EMAIL");
  const password = await requireEnv("E2E_TEST_PASSWORD");

  const session = await signInClean(browser, email, password);
  try {
    await expect(session.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(signInWithCredentials(session.page, email, password)).rejects.toThrow(
      /already authenticated/i,
    );
  } finally {
    await session.context.close();
  }
});