import type { Browser, Page } from "@playwright/test";

/**
 * Central helpers for auth/session hygiene in E2E tests.
 *
 * `createCleanContext` guarantees every sign-in starts from a fully logged-out
 * browser (empty storageState), so a secondary test user never inherits
 * another user's Supabase session cookies/localStorage. This is what makes
 * the tenant-isolation and session-reuse proofs deterministic — see
 * signInOrgB and login-journey, which previously inlined the same override.
 */
export function createCleanContext(browser: Browser) {
  // browser.newContext() defaults to the project's `use` options, which under
  // chromium/mobile-chromium is the primary test user's storageState. Empty
  // storageState is the explicit logged-out state: no cookies, no origins.
  return browser.newContext({ storageState: { cookies: [], origins: [] } });
}

const RETRYABLE_NETWORK = "ERR_NETWORK_CHANGED";

function isRetryableNetworkError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(RETRYABLE_NETWORK);
}

/**
 * Run `action` (a navigation), retrying once when Chromium reports a host
 * network-route handoff (ERR_NETWORK_CHANGED → chrome-error://chromewebdata/).
 * Other failures propagate immediately — HTTP/auth failures are never hidden.
 */
export async function withNetworkRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (!isRetryableNetworkError(error)) {
      throw error;
    }
    return action();
  }
}

/** Navigate `page` to `path`, retrying a single ERR_NETWORK_CHANGED handoff. */
export async function gotoPageWithRetry(page: Page, path: string): Promise<void> {
  await withNetworkRetry(() => page.goto(path));
}
