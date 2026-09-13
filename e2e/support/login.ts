import { existsSync } from "node:fs";
import type { Browser, Locator, Page, Request } from "@playwright/test";

import { gotoPageWithRetry } from "./context";

const AUTH_TOKEN_PATH = "/auth/v1/token";
export const SIGN_IN_TIMEOUT_MS = 30_000;

function isAuthTokenRequest(request: Request) {
  return request.url().includes(AUTH_TOKEN_PATH);
}

async function gotoLogin(page: Page) {
  await gotoPageWithRetry(page, "/login");

  // Fail fast on a dirty/contaminated session. If this browser already has
  // another user signed in, the shared redirect-if-authenticated guard
  // (src/lib/auth/redirect-if-authenticated.ts) bounces /login away (e.g. to
  // /app) instead of rendering the form. That means we are NOT actually on
  // the login page, and waiting out the 30s sign-in timeout would just be
  // misreported as a login failure. Surface the real cause immediately.
  const pathname = new URL(page.url()).pathname;
  if (pathname !== "/login") {
    throw new Error(
      `Attempted to sign in but the browser is already authenticated (redirected to "${pathname}"). ` +
        "Start every sign-in from a fresh, clean browser context — use " +
        "createCleanContext(browser) so secondary test users never inherit another session.",
    );
  }
}

async function submitPasswordSignIn(page: Page, signIn: Locator) {
  const appNavigation = page
    .waitForURL((url) => url.pathname === "/app", { timeout: SIGN_IN_TIMEOUT_MS })
    .then(() => ({ kind: "success" as const }));
  const requestFailure = page
    .waitForEvent("requestfailed", {
      predicate: isAuthTokenRequest,
      timeout: SIGN_IN_TIMEOUT_MS,
    })
    .then((request) => ({
      kind: "request-failed" as const,
      errorText: request.failure()?.errorText ?? "unknown network failure",
    }));
  // A rejected Supabase login (bad credentials, rate-limited, etc.) completes
  // fine at the network level — it's a real HTTP response, not a
  // `requestfailed` event — so without this it fell through to the 30s
  // appNavigation timeout and reported a useless "sign-in timed out" instead
  // of the actual 400/401/429 cause.
  const httpError = page
    .waitForResponse((response) => isAuthTokenRequest(response.request()) && !response.ok(), {
      timeout: SIGN_IN_TIMEOUT_MS,
    })
    .then(async (response) => ({
      kind: "http-error" as const,
      status: response.status(),
      body: await response.text().catch(() => "<unreadable body>"),
    }));

  await signIn.click();
  try {
    return await Promise.race([appNavigation, requestFailure, httpError]);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { kind: "timeout" as const };
    }
    throw error;
  }
}

/** Shared real UI login for setup, login-journey, and tenant isolation. */
export async function signInWithCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await gotoLogin(page);

  const signIn = page.getByRole("button", { name: "Sign in" });
  await signIn.waitFor({ state: "visible" });
  const emailField = page.getByRole("textbox", { name: "Email" });
  const passwordField = page.getByLabel("Password");
  await emailField.fill(email);
  await passwordField.fill(password);

  try {
    const first = await submitPasswordSignIn(page, signIn);
    if (first.kind === "success") return;
    if (first.kind === "timeout") {
      throw new Error(`Sign-in timed out after ${SIGN_IN_TIMEOUT_MS}ms waiting for Supabase Auth`);
    }

    if (first.kind === "http-error") {
      throw new Error(`Sign-in request returned HTTP ${first.status}: ${first.body}`);
    }

    if (!first.errorText.includes("ERR_NETWORK_CHANGED")) {
      throw new Error(`Sign-in request failed: ${first.errorText}`);
    }

    // Retry once only when Chromium reports a host network-route handoff.
    // HTTP/auth failures are never retried or hidden.
    const second = await submitPasswordSignIn(page, signIn);
    if (second.kind === "success") return;
    if (second.kind === "timeout") {
      throw new Error(
        `Sign-in timed out after ${SIGN_IN_TIMEOUT_MS}ms waiting for Supabase Auth after network retry`,
      );
    }
    if (second.kind === "http-error") {
      throw new Error(`Sign-in request returned HTTP ${second.status} after network retry: ${second.body}`);
    }
    throw new Error(`Sign-in request failed after network retry: ${second.errorText}`);
  } catch (error) {
    // Keep failure snapshots/error-context from retaining the raw password.
    await passwordField.fill("").catch(() => {});
    throw error;
  }
}

export async function signInAsE2ETestOperator(page: Page): Promise<void> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL / E2E_TEST_PASSWORD are missing — set them in .env.test");
  }

  await signInWithCredentials(page, email, password);
}

/**
 * Secondary-role context from a cached storageState file written once by a
 * project-dependency setup test (see auth.setup.ts's Org B / Shoots setup)
 * instead of a fresh real hosted login. Every spec that needs a dedicated
 * non-default account — brands/shoots journeys, DASH-MAIN-002, tenant/
 * copilot isolation — used to sign in fresh per spec file (up to 8 real
 * hosted logins per full suite run); caching moves that cost to "once per
 * role, per full suite run" (https://playwright.dev/docs/auth#multiple-signed-in-roles).
 * Fails closed with `missingCredentialsMessage` when the file doesn't exist
 * (the corresponding setup test skips, rather than fails, when its
 * credentials are unset) — same contract `signInIsolatedContext` had.
 */
export async function contextForSavedRole(
  browser: Browser,
  storageStatePath: string,
  missingCredentialsMessage: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  if (!existsSync(storageStatePath)) {
    throw new Error(missingCredentialsMessage);
  }
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}
