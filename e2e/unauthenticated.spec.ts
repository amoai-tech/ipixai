import { test, expect } from "@playwright/test";

// Explicitly signed-out — overrides the chromium/mobile-chromium projects'
// default authenticated storageState (https://playwright.dev/docs/auth).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("unauthenticated access @Sdc28f877", () => {
  test("redirects /app to /login @T89d8f450", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  });

  // IPI-1225 · PLANNER-ROUTE-RETIRE-001 — /planner is a compatibility
  // redirect only now; a signed-out deep link must still land on /login,
  // same as any other protected route, not 404.
  test("redirects /planner to /login when signed out @T1225plannerredirect", async ({ page }) => {
    await page.goto("/planner");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  });
});
