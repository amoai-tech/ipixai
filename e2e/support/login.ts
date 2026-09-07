import type { Locator, Page, Request } from "@playwright/test";

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

  await signIn.click();
  return Promise.race([appNavigation, requestFailure]);
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

    if (!first.errorText.includes("ERR_NETWORK_CHANGED")) {
      throw new Error(`Sign-in request failed: ${first.errorText}`);
    }

    // Retry once only when Chromium reports a host network-route handoff.
    // HTTP/auth failures are never retried or hidden.
    const second = await submitPasswordSignIn(page, signIn);
    if (second.kind === "success") return;
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
