import { test, expect, type Browser } from "@playwright/test";

import { signInIsolatedContext } from "./support/login";
import { getOwnOrgId } from "./support/tenant-supabase";

// IPI-1068 · BRAND-001 — browser proof for the /app/brands browse route.
//
// Org A/B here are the same qa-ipix-isolation-a@ipix.test (E2E_TEST_EMAIL,
// the shared storageState account) / qa-ipix-isolation-b@ipix.test
// (E2E_TEST_EMAIL_ORG_B) pair used by tenant-isolation.spec.ts. Org B still
// has 0 brands, the right fixture for the empty-state and cross-org-denial
// proofs. Org A now has 1 real brand (added by earlier IPI-1093 live
// verification, superseding tenant-isolation.spec.ts's "0 brands" note for
// this account) — used below as a real-data render proof instead of a mock.
//
// The cross-org denial test targets Org A's own real brand rather than a
// third party's ("majji", used by tenant-isolation.spec.ts) — a fixture we
// have no account authorized to verify. Org A's brand existence/identity is
// independently asserted by an account we control ("lists the org's real
// brand" below), and the denial test asserts Org A's and Org B's own org
// ids differ (via each account's own authenticated session) before treating
// a 404 as a tenant-isolation proof rather than a rotted/never-existed id.

const NAV_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = NAV_TIMEOUT_MS + 15_000;
// Verified live against production, this brand: exists, is named "QA Test
// Brand — IPI-1093 live verification", and belongs to Org A (org_id
// 8859e5c4-603e-4a58-ad5b-dd37a6c1b890 at time of writing) — also asserted
// by "lists the org's real brand and links to its detail page" below.
const ORG_A_BRAND_ID = "941f679d-14d0-405d-bd81-3cbea56ef24c";
const ORG_A_BRAND_NAME = "QA Test Brand — IPI-1093 live verification";

async function signInOrgA(browser: Browser) {
  return signInIsolatedContext(
    browser,
    process.env.E2E_TEST_EMAIL,
    process.env.E2E_TEST_PASSWORD,
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD are missing — set them in .env.test",
  );
}

async function signInOrgB(browser: Browser) {
  return signInIsolatedContext(
    browser,
    process.env.E2E_TEST_EMAIL_ORG_B,
    process.env.E2E_TEST_PASSWORD_ORG_B,
    "E2E_TEST_EMAIL_ORG_B / E2E_TEST_PASSWORD_ORG_B are missing — set them in .env.test",
  );
}

test.describe("brands browse (authenticated) @S5260fbc5", () => {
  test("loads /app/brands without console or page errors @T9d7146c1", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/app/brands");
    await expect(page.getByRole("heading", { name: "Brands", exact: true })).toBeVisible();
    expect(errors, `console/page errors: ${errors.join("; ")}`).toEqual([]);
  });

  // The shared storageState org (E2E_TEST_EMAIL) now has 1 real brand (from
  // earlier IPI-1093 live verification) — assert against that real card
  // rather than the stale "0 brands" assumption tenant-isolation.spec.ts
  // documented for this account. Confirms the whole read path live: DAL →
  // status label → card → detail link, against real Supabase data, not a
  // mock.
  test("lists the org's real brand and links to its detail page @Tea1666e7", async ({ page }) => {
    await page.goto("/app/brands");
    await expect(page.getByRole("heading", { name: "Brands", exact: true })).toBeVisible();
    await expect(page.getByText("1 brand", { exact: true })).toBeVisible();

    const card = page.getByRole("link", {
      name: /QA Test Brand — IPI-1093 live verification/,
    });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute(
      "href",
      "/app/brands/941f679d-14d0-405d-bd81-3cbea56ef24c",
    );
    // Honest status label + hostname, not a fabricated Active/Approved state.
    await expect(card.getByText("Crawl complete")).toBeVisible();
    await expect(card.getByText("www.maaji.co")).toBeVisible();
  });

  test("search narrows the list live, and clears back to the full grid @T614d56dc", async ({ page }) => {
    await page.goto("/app/brands");
    const search = page.getByRole("searchbox", { name: "Search brands" });
    await expect(search).toBeVisible();

    await search.fill("nonexistent brand name");
    await expect(page.getByRole("heading", { name: "No matching brands" })).toBeVisible();
    await expect(
      page.getByText("QA Test Brand — IPI-1093 live verification"),
    ).toHaveCount(0);

    await search.fill("maaji");
    await expect(
      page.getByText("QA Test Brand — IPI-1093 live verification"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "No matching brands" })).toHaveCount(0);
  });

  test("the Approved status filter excludes an unapproved real brand @T966eb8c7", async ({ page }) => {
    await page.goto("/app/brands");
    await page.getByRole("button", { name: "Approved", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No matching brands" })).toBeVisible();
    await expect(
      page.getByText("QA Test Brand — IPI-1093 live verification"),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(
      page.getByText("QA Test Brand — IPI-1093 live verification"),
    ).toBeVisible();
  });

  test("org B cannot open a brand belonging to another org: direct URL 404 @T1eb5d917", async ({
    browser,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { page: orgA, close: closeOrgA } = await signInOrgA(browser);
    const { page: orgB, close: closeOrgB } = await signInOrgB(browser);
    try {
      // Establish the fixture through an account authorized for its own
      // organization, not by trusting the hardcoded id: Org A's own session
      // confirms the brand exists and is really named ORG_A_BRAND_NAME, and
      // each account's own org id (via its own authenticated session, RLS-
      // enforced) is asserted distinct — so the 404 below actually exercises
      // cross-tenant denial rather than a rotted/never-existed brand id.
      await orgA.goto(`/app/brands/${ORG_A_BRAND_ID}`);
      await expect(orgA.getByRole("heading", { name: ORG_A_BRAND_NAME })).toBeVisible();
      const orgAId = await getOwnOrgId(orgA);
      const orgBId = await getOwnOrgId(orgB);
      expect(orgAId, "fixture invalid: Org A and Org B resolved to the same org").not.toBe(
        orgBId,
      );

      await orgB.goto("/app/brands");
      await expect(orgB.getByRole("heading", { name: "Brands", exact: true })).toBeVisible();
      await expect(orgB.getByRole("heading", { name: "No brands yet" })).toBeVisible();

      await orgB.goto(`/app/brands/${ORG_A_BRAND_ID}`);
      // Dev-mode Turbopack serves notFound() with HTTP 200; the rendered
      // 404 page is the tenant-boundary proof (no brand record is shown,
      // and the brand name never appears in the response).
      await expect(orgB.getByRole("heading", { name: "404" })).toBeVisible();
      await expect(orgB.getByText("This page could not be found.")).toBeVisible();
      await expect(orgB.getByText(ORG_A_BRAND_NAME, { exact: true })).toHaveCount(0);
    } finally {
      await closeOrgA();
      await closeOrgB();
    }
  });

  test("unknown brand id renders 404 (foreign/unknown record) @T6fa3ff83", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app/brands/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });

  test("non-UUID brand id renders 404 @T3637b977", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app/brands/not-a-uuid");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});
