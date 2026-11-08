import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";

import { contextForSavedRole } from "./support/login";
import { getOwnOrgId, supabaseForPage } from "./support/tenant-supabase";

const orgBFile = path.resolve(__dirname, "../playwright/.auth/org-b.json");

test.setTimeout(90_000);

/**
 * usera@ipix.co and userb@ipix.co are dedicated QA users in separate,
 * isolated organizations. Their brand counts differ as QA data evolves, so
 * isolation is proven reciprocally — the other org's IDs must not be readable
 * through RLS and its names must not render — rather than by assuming either
 * org is empty. Credentials stay in .env.test / CI secrets and each account
 * gets its own Playwright storageState.
 */

/**
 * Org B's storageState is cached once by the "setup" project's dependency
 * chain (see auth.setup.ts) instead of authenticating fresh in this file —
 * this is a security proof, not a login-UX test, so a real hosted sign-in
 * here bought nothing but an extra login. Missing credentials still fail
 * closed (missing cache file throws), matching the prior contract.
 */
async function signInOrgB(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  return contextForSavedRole(
    browser,
    orgBFile,
    "Missing playwright/.auth/org-b.json — set E2E_TEST_EMAIL_ORG_B / E2E_TEST_PASSWORD_ORG_B in .env.test",
  );
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

async function readOwnBrands(page: Page): Promise<Array<{ id: string; name: string }>> {
  const supabase = await supabaseForPage(page);
  const { data, error } = await supabase
    .from("brands")
    .select("id,name")
    .order("created_at");
  expect(error, `own-brand read failed unexpectedly: ${error?.message ?? "unknown"}`).toBeNull();
  return data ?? [];
}

/** Read-only negative check: the other organization's brands must be absent
 *  from both the RLS-protected API and the rendered dashboard. This does not
 *  assume either QA org is empty — QA data changes over time. */
async function expectNoForeignBrands(
  page: Page,
  foreignBrands: Array<{ id: string; name: string }>,
) {
  const supabase = await supabaseForPage(page);
  if (foreignBrands.length > 0) {
    const { data, error } = await supabase
      .from("brands")
      .select("id")
      .in(
        "id",
        foreignBrands.map((brand) => brand.id),
      );
    expect(error, `cross-org brand read failed unexpectedly: ${error?.message ?? "unknown"}`).toBeNull();
    expect(data, "RLS leak: this session can read another organization's brand").toHaveLength(0);
  }

  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 30_000,
  });
  for (const brand of foreignBrands) {
    await expect(page.getByText(brand.name, { exact: true })).toHaveCount(0);
  }
}

// PR #52 (IPI-1066) merged — /app has the real "Dashboard" heading and
// brand list now. This is the real, intended two-account reciprocal proof.
test(
  "org A vs org B: signed-in dashboards remain tenant-isolated @T1cb98401",
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

      const orgABrands = await readOwnBrands(page);
      const orgBBrands = await readOwnBrands(orgBPage);
      await expectNoForeignBrands(page, orgBBrands);
      await expectNoForeignBrands(orgBPage, orgABrands);
    } finally {
      await closeOrgB();
    }
  },
);
