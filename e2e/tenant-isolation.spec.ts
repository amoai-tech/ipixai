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

const BRAND_PAGE_SIZE = 100;
const BRAND_ID_BATCH_SIZE = 50;

type BrandSnapshot = { id: string; name: string };

async function readOwnBrands(page: Page): Promise<BrandSnapshot[]> {
  const supabase = await supabaseForPage(page);
  const brands: BrandSnapshot[] = [];
  const maxPages = 10;
  let exhausted = false;
  // PostgREST paginates; a single request silently truncates at the project
  // row limit. Read every page so a newer brand cannot escape the proof.
  for (let from = 0; from < BRAND_PAGE_SIZE * maxPages; from += BRAND_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("brands")
      .select("id,name")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + BRAND_PAGE_SIZE - 1);
    expect(error, `own-brand read failed unexpectedly: ${error?.message ?? "unknown"}`).toBeNull();
    const rows = (data ?? []) as BrandSnapshot[];
    brands.push(...rows);
    if (rows.length < BRAND_PAGE_SIZE) {
      exhausted = true;
      break;
    }
  }
  expect(
    exhausted,
    `brand list exceeded ${BRAND_PAGE_SIZE * maxPages} rows; refusing to certify a truncated snapshot`,
  ).toBe(true);
  return brands;
}

function snapshotKey(brands: BrandSnapshot[]): string {
  return brands
    .map((brand) => `${brand.id}:${brand.name}`)
    .sort()
    .join("|");
}

async function readDashboardBrandNames(page: Page): Promise<string[]> {
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 30_000,
  });
  const list = page.getByTestId("command-center-brand-list");
  if ((await list.count()) === 0) return [];
  return (await list.locator("li").allInnerTexts())
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Read-only negative check: the other organization's brands must be absent
 *  from both the RLS-protected API and the rendered dashboard. This does not
 *  assume either QA org is empty — QA data changes over time. */
async function expectNoForeignBrands(
  page: Page,
  foreignBrands: BrandSnapshot[],
  ownBrands: BrandSnapshot[],
) {
  const supabase = await supabaseForPage(page);
  // Bound each `.in()` filter so a large foreign list cannot exceed the
  // PostgREST request budget; every batch must still return zero rows.
  for (let index = 0; index < foreignBrands.length; index += BRAND_ID_BATCH_SIZE) {
    const batch = foreignBrands.slice(index, index + BRAND_ID_BATCH_SIZE);
    const { data, error } = await supabase
      .from("brands")
      .select("id")
      .in(
        "id",
        batch.map((brand) => brand.id),
      );
    expect(error, `cross-org brand read failed unexpectedly: ${error?.message ?? "unknown"}`).toBeNull();
    expect(data, "RLS leak: this session can read another organization's brand").toHaveLength(0);
  }

  // Scoped to the rendered brand cards, and compared with this session's own
  // names. A foreign brand with a unique name is therefore caught without a
  // whole-page `getByText` that could match unrelated copy.
  const renderedNames = await readDashboardBrandNames(page);
  const ownNames = new Set(ownBrands.map((brand) => brand.name));
  expect(
    renderedNames.filter((name) => !ownNames.has(name)),
    "dashboard rendered a brand that is not in this session's own brand list",
  ).toEqual([]);
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
      // A brand-level direction can only be exercised when the other org has
      // at least one brand. Local CI seeds both QA orgs empty; staging has
      // brands on Org A. Never claim a bidirectional brand proof in the empty
      // case — record the partial scope and keep the membership RLS proof.
      if (orgABrands.length === 0 || orgBBrands.length === 0) {
        test.info().annotations.push({
          type: "partial-brand-proof",
          description:
            "One QA organization has no brands, so that brand direction has no foreign row to probe; membership RLS still runs both ways.",
        });
      }

      await expectNoForeignBrands(page, orgBBrands, orgABrands);
      await expectNoForeignBrands(orgBPage, orgABrands, orgBBrands);

      // A concurrent add/rename would make the snapshots stale. Fail closed
      // rather than report a pass on data that changed mid-proof.
      expect(snapshotKey(await readOwnBrands(page)), "Org A brand data changed during the isolation proof; rerun").toBe(
        snapshotKey(orgABrands),
      );
      expect(snapshotKey(await readOwnBrands(orgBPage)), "Org B brand data changed during the isolation proof; rerun").toBe(
        snapshotKey(orgBBrands),
      );
    } finally {
      await closeOrgB();
    }
  },
);
