import { test, expect, type Browser, type Page } from "@playwright/test";

import { signInWithCredentials } from "./support/login";
import { getOwnOrgId, supabaseForPage } from "./support/tenant-supabase";

// Org B signs in with a raw password in this file; do not persist secret-bearing artifacts.
test.use({ trace: "off", screenshot: "off" });
test.setTimeout(60_000);

/**
 * usera@ipix.co and userb@ipix.co are dedicated QA users in separate,
 * isolated organizations. Both orgs intentionally have 0 brands, so any
 * rendered brand is a tenant leak. Credentials stay in .env.test / CI
 * secrets and each account gets its own Playwright storageState.
 */

const otherOrgBrandNames = [
  "majji",
  "QA Test Brand — IPI-404 parity check",
  "IPI-370 Smoke Co 1784673279581",
];

/**
 * Org B has no saved storageState — it's only needed by this one test, so
 * it authenticates fresh here (https://playwright.dev/docs/auth#multiple-signed-in-roles)
 * instead of running as a project dependency for every browser project.
 * Missing credentials throw (fail closed), matching signInAsE2ETestOperator:
 * this is a security proof, not a test to silently skip.
 */
async function signInOrgB(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const email = process.env.E2E_TEST_EMAIL_ORG_B;
  const password = process.env.E2E_TEST_PASSWORD_ORG_B;
  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL_ORG_B / E2E_TEST_PASSWORD_ORG_B are missing — set them in .env.test",
    );
  }
  // browser.newContext() defaults to the project's own `use` options — which,
  // under chromium/mobile-chromium, is Org A's storageState. Without this
  // override the "fresh" Org B context silently starts pre-authenticated as
  // Org A instead of logged out, so /login redirects away and Org B never
  // actually signs in. Empty storageState is the explicit logged-out state.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await signInWithCredentials(page, email, password);
  return { page, close: () => context.close() };
}

/** Read-only negative check: RLS must return zero rows, not leak another
 *  organization's membership row, when a session queries for it directly. */
async function assertCannotReadOtherOrg(page: Page, otherOrgId: string) {
  const supabase = await supabaseForPage(page);
  const { data: rows, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", otherOrgId);
  expect(error, `cross-org read failed unexpectedly: ${error?.message ?? "unknown"}`).toBeNull();
  expect(rows, "RLS leak: this session can read another organization's membership row").toHaveLength(0);
}

async function expectEmptyIsolatedDashboard(page: Page) {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  // Primary, robust assertion: this org's real brand count is 0, so the
  // brand list must render nothing at all — this holds regardless of what
  // any other org's data looks like today, unlike matching specific names.
  await expect(page.getByTestId("command-center-brand-list")).toHaveCount(0);
  // Defense in depth: these 3 brand names are confirmed (read-only) to
  // belong to other organizations right now. Secondary check, not the
  // primary isolation proof above — if any of these are renamed or
  // deleted, the count-based assertion still catches a real regression.
  for (const name of otherOrgBrandNames) {
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  }
}

// PR #52 (IPI-1066) merged — /app has the real "Dashboard" heading and
// brand list now. This is the real, intended two-account reciprocal proof.
test(
  "org A vs org B: signed-in dashboards remain tenant-isolated",
  async ({ browser, page }) => {
    const orgAId = await getOwnOrgId(page);

    const { page: orgBPage, close: closeOrgB } = await signInOrgB(browser);
    try {
      const orgBId = await getOwnOrgId(orgBPage);

      expect(orgAId, "Org A and Org B sessions must belong to different organizations").not.toBe(
        orgBId,
      );

      // Each session can read its own org membership (above) but is denied
      // the other's — proven in both directions, not just B-cannot-read-A.
      await assertCannotReadOtherOrg(page, orgBId);
      await assertCannotReadOtherOrg(orgBPage, orgAId);

      await expectEmptyIsolatedDashboard(page);
      await expectEmptyIsolatedDashboard(orgBPage);
    } finally {
      await closeOrgB();
    }
  },
);
