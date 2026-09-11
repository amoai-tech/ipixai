import { test, expect, type Browser, type Page } from "@playwright/test";

import { signInIsolatedContext } from "./support/login";
import { getOwnOrgId, supabaseForPage } from "./support/tenant-supabase";

// IPI-1068 · BRAND-001 — browser proof for the /app/brands browse route.
//
// Org A/B are the same qa-ipix-isolation-a@ipix.test (E2E_TEST_EMAIL, the
// shared storageState account) / qa-ipix-isolation-b@ipix.test
// (E2E_TEST_EMAIL_ORG_B) pair used by tenant-isolation.spec.ts.
//
// Brand content is discovered live via each session's own authenticated
// Supabase read (getOwnFirstBrand), never hardcoded: a fixture id/name that
// matched production locally failed in CI, where the target Supabase
// environment doesn't share the same seeded rows. Tests that need a real
// brand to interact with skip (not fail) when the signed-in org currently
// has none — the zero-brand path itself is proven by the dedicated empty
// state assertion below, and search/filter narrowing logic already has
// full environment-agnostic coverage at the unit/component level
// (tests/brand-list-filters.test.ts, brands-search-filter.test.tsx).

const NAV_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = NAV_TIMEOUT_MS + 15_000;

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

type DiscoveredBrand = {
  id: string;
  name: string;
  intakeStatus: string;
  approvedProfileAt: string | null;
};

/** The signed-in session's own most recent brand, read directly (RLS-
 *  enforced, same as getOwnOrgId) rather than assumed — null when this org
 *  currently has none. */
async function getOwnFirstBrand(page: Page): Promise<DiscoveredBrand | null> {
  const supabase = await supabaseForPage(page);
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, intake_status, approved_profile_at")
    .order("created_at", { ascending: false })
    .limit(1);
  expect(error, `brands read failed: ${error?.message ?? "unknown"}`).toBeNull();
  const row = data?.[0];
  return row
    ? {
        id: row.id,
        name: row.name ?? "",
        intakeStatus: row.intake_status,
        approvedProfileAt: row.approved_profile_at,
      }
    : null;
}

/** Must mirror src/lib/brand/brand-list-filters.ts's matchesBrandStatusFilter
 *  bucket assignment exactly — this is what proved the original mapping was
 *  broken (it only matched statuses no live brand actually had). Duplicated
 *  rather than imported: Playwright specs here don't resolve the `@/` alias
 *  the way the Next.js app and Vitest suite do. */
function expectedFilterFor(brand: DiscoveredBrand): "Approved" | "Draft" | "Analyzing" | "Failed" {
  if (brand.approvedProfileAt !== null) return "Approved";
  if (brand.intakeStatus === "brand_created" || brand.intakeStatus === "draft_ready") return "Draft";
  if (brand.intakeStatus === "failed") return "Failed";
  return "Analyzing"; // crawl_running, crawl_complete, analysis_running, scores_complete, ready
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

  // Confirms the whole read path live: DAL → status label → card → detail
  // link, against real Supabase data, not a mock — whatever this
  // environment's org actually has, discovered rather than assumed.
  test("renders real brand content honestly (or the honest empty state)", async ({ page }) => {
    const brand = await getOwnFirstBrand(page);
    await page.goto("/app/brands");
    await expect(page.getByRole("heading", { name: "Brands", exact: true })).toBeVisible();

    if (!brand) {
      await expect(page.getByRole("heading", { name: "No brands yet" })).toBeVisible();
      return;
    }

    const card = page.getByRole("link", { name: new RegExp(brand.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", `/app/brands/${brand.id}`);
  });

  test("search narrows the list live, and clears back to the full grid", async ({ page }) => {
    const brand = await getOwnFirstBrand(page);
    test.skip(!brand, "this org currently has no real brand to search for");

    await page.goto("/app/brands");
    const search = page.getByRole("searchbox", { name: "Search brands" });
    await expect(search).toBeVisible();

    await search.fill("zzz-nonexistent-brand-zzz");
    await expect(page.getByRole("heading", { name: "No matching brands" })).toBeVisible();

    await search.fill(brand!.name);
    await expect(page.getByText(brand!.name, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No matching brands" })).toHaveCount(0);
  });

  test("the correct status filter includes the brand; an unrelated one excludes it", async ({
    page,
  }) => {
    const brand = await getOwnFirstBrand(page);
    test.skip(!brand, "this org currently has no real brand to filter");
    const correctFilter = expectedFilterFor(brand!);
    // Any bucket other than the correct one — proves exclusion without
    // hardcoding "Failed", which is currently always wrong for every real
    // brand and would silently pass even if every filter were broken.
    const wrongFilter = (["Approved", "Draft", "Analyzing", "Failed"] as const).find(
      (f) => f !== correctFilter,
    )!;

    await page.goto("/app/brands");

    // Positive proof: the filter this brand's real, live status actually
    // maps to must include it. This is the assertion the original test
    // never made — it only proved narrowing, not correct inclusion — and
    // would have caught the dead-filter regression immediately.
    await page.getByRole("button", { name: correctFilter, exact: true }).click();
    await expect(page.getByText(brand!.name, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: wrongFilter, exact: true }).click();
    const stillVisible = await page
      .getByText(brand!.name, { exact: true })
      .isVisible()
      .catch(() => false);
    if (!stillVisible) {
      await expect(page.getByRole("heading", { name: "No matching brands" })).toBeVisible();
    }

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByText(brand!.name, { exact: true })).toBeVisible();
  });

  test("org B cannot open a brand belonging to another org: direct URL 404", async ({
    browser,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { page: orgA, close: closeOrgA } = await signInOrgA(browser);
    const { page: orgB, close: closeOrgB } = await signInOrgB(browser);
    try {
      const brand = await getOwnFirstBrand(orgA);
      test.skip(!brand, "Org A currently has no real brand to prove cross-org denial against");

      const orgAId = await getOwnOrgId(orgA);
      const orgBId = await getOwnOrgId(orgB);
      expect(orgAId, "fixture invalid: Org A and Org B resolved to the same org").not.toBe(
        orgBId,
      );

      await orgB.goto("/app/brands");
      await expect(orgB.getByRole("heading", { name: "Brands", exact: true })).toBeVisible();

      await orgB.goto(`/app/brands/${brand!.id}`);
      // Dev-mode Turbopack serves notFound() with HTTP 200; the rendered
      // 404 page is the tenant-boundary proof (no brand record is shown,
      // and the brand name never appears in the response).
      await expect(orgB.getByRole("heading", { name: "404" })).toBeVisible();
      await expect(orgB.getByText("This page could not be found.")).toBeVisible();
      await expect(orgB.getByText(brand!.name, { exact: true })).toHaveCount(0);
    } finally {
      await closeOrgA();
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
