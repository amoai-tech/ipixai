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
});
