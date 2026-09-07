import { test, expect, type Browser, type Page } from "@playwright/test";

import { signInWithCredentials } from "./support/login";

// IPI-1067 · SHOOT-001 — browser proof for the shoots browse + detail routes.
//
// Org A is the QA account (QA_EMAIL in .env.local): org
// 00000000-0000-0000-0000-000000000001 with 4 real shoots (verified
// read-only via RLS-scoped queries). Org B is qa-ipix-isolation-a@ipix.test:
// 0 brands, 0 shoots by design. The two-org proof is reciprocal: Org A sees
// its own shoots only, and Org B sees an empty list plus a 404 for a direct
// URL to an Org A shoot. Read-only — no fixtures are created or mutated.
//
// Credentials are injected by /tmp/opencode/run-e2e-ipi1067.mjs because the
// committed .env.test passwords are stale (invalid_credentials).

const NAV_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = NAV_TIMEOUT_MS + 15_000;

async function signInOrgB(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const email = process.env.E2E_TEST_EMAIL_ORG_B;
  const password = process.env.E2E_TEST_PASSWORD_ORG_B;
  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL_ORG_B / E2E_TEST_PASSWORD_ORG_B are missing — set them in .env.test",
    );
  }
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await signInWithCredentials(page, email, password);
  return { page, close: () => context.close() };
}

test.describe("shoots browse (authenticated)", () => {
  test("loads /app/shoots without console or page errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/app/shoots");
    await expect(page.getByRole("heading", { name: "Shoots", exact: true })).toBeVisible();
    expect(errors, `console/page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("lists the org's real shoots and opens a shoot record", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app/shoots");
    await expect(page.getByRole("heading", { name: "Shoots", exact: true })).toBeVisible();

    // Org A has 4 real shoots today; assert at least one card renders and
    // grab its href for the detail journey.
    const cards = page.locator('a[href^="/app/shoots/"]');
    await expect(cards.first()).toBeVisible();
    const href = await cards.first().getAttribute("href");
    expect(href).toMatch(/^\/app\/shoots\/[0-9a-f-]{36}$/);

    await cards.first().click();
    await page.waitForURL(href!, { timeout: NAV_TIMEOUT_MS });

    // Detail shell: back link, status chip, and the 9 lifecycle tabs.
    await expect(page.getByRole("link", { name: "Shoots" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Shots" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Assets" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Team" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Schedule" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Budget" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Deliverables" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Approvals" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Activity" })).toBeVisible();

    // Tab switching works: Shots panel becomes selected.
    await page.getByRole("tab", { name: "Shots" }).click();
    await expect(page.getByRole("tab", { name: "Shots" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("org B cannot see org A shoots: empty list + direct URL 404", async ({
    browser,
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    // Org A: capture a real shoot id from the list.
    await page.goto("/app/shoots");
    const href = await page.locator('a[href^="/app/shoots/"]').first().getAttribute("href");
    expect(href).toMatch(/^\/app\/shoots\/[0-9a-f-]{36}$/);
    const shootId = href!.split("/").pop();

    // Org B: fresh sign-in, empty list, and a 404 for Org A's shoot.
    const { page: orgB, close: closeOrgB } = await signInOrgB(browser);
    try {
      await orgB.goto("/app/shoots");
      await expect(orgB.getByRole("heading", { name: "Shoots", exact: true })).toBeVisible();
      await expect(orgB.getByRole("heading", { name: "No shoots yet" })).toBeVisible();

      await orgB.goto(`/app/shoots/${shootId}`);
      // Dev-mode Turbopack serves notFound() with HTTP 200; the rendered
      // 404 page is the tenant-boundary proof (no shoot record is shown).
      await expect(orgB.getByRole("heading", { name: "404" })).toBeVisible();
      await expect(orgB.getByText("This page could not be found.")).toBeVisible();
    } finally {
      await closeOrgB();
    }
  });

  test("unknown shoot id renders 404 (foreign/unknown record)", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app/shoots/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });

  test("non-UUID shoot id renders 404", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app/shoots/not-a-uuid");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});