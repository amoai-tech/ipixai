import { test, expect, type Browser } from "@playwright/test";

import { signInIsolatedContext } from "./support/login";

// IPI-1068 · BRAND-001 — browser proof for the /app/brands browse route.
//
// Org A/B here are the same qa-ipix-isolation-a@ipix.test (E2E_TEST_EMAIL,
// the shared storageState account) / qa-ipix-isolation-b@ipix.test
// (E2E_TEST_EMAIL_ORG_B) pair used by tenant-isolation.spec.ts. Org B still
// has 0 brands, the right fixture for the empty-state and cross-org-denial
// proofs. Org A now has 1 real brand (added by earlier IPI-1093 live
// verification, superseding tenant-isolation.spec.ts's "0 brands" note for
// this account) — used below as a real-data render proof instead of a mock.
// "majji" is a real brand confirmed (read-only, same as
// tenant-isolation.spec.ts) to belong to a third organization neither QA
// account is a member of — a direct-URL open of it is therefore a tenant
// leak if it ever succeeds. Read-only, no fixtures created or mutated.

const NAV_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = NAV_TIMEOUT_MS + 15_000;
const OTHER_ORG_BRAND_ID = "cf31e7e0-de5e-48be-b8f7-1d5c3cbe05a4"; // "majji"

async function signInOrgB(browser: Browser) {
  return signInIsolatedContext(
    browser,
    process.env.E2E_TEST_EMAIL_ORG_B,
    process.env.E2E_TEST_PASSWORD_ORG_B,
    "E2E_TEST_EMAIL_ORG_B / E2E_TEST_PASSWORD_ORG_B are missing — set them in .env.test",
  );
}

test.describe("brands browse (authenticated)", () => {
  test("loads /app/brands without console or page errors", async ({ page }) => {
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
  test("lists the org's real brand and links to its detail page", async ({ page }) => {
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

  test("org B cannot open a brand belonging to another org: direct URL 404", async ({
    browser,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { page: orgB, close: closeOrgB } = await signInOrgB(browser);
    try {
      await orgB.goto("/app/brands");
      await expect(orgB.getByRole("heading", { name: "Brands", exact: true })).toBeVisible();
      await expect(orgB.getByRole("heading", { name: "No brands yet" })).toBeVisible();

      await orgB.goto(`/app/brands/${OTHER_ORG_BRAND_ID}`);
      // Dev-mode Turbopack serves notFound() with HTTP 200; the rendered
      // 404 page is the tenant-boundary proof (no brand record is shown,
      // and the brand name never appears in the response).
      await expect(orgB.getByRole("heading", { name: "404" })).toBeVisible();
      await expect(orgB.getByText("This page could not be found.")).toBeVisible();
      await expect(orgB.getByText("majji", { exact: true })).toHaveCount(0);
    } finally {
      await closeOrgB();
    }
  });

  test("unknown brand id renders 404 (foreign/unknown record)", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app/brands/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });

  test("non-UUID brand id renders 404", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app/brands/not-a-uuid");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});
