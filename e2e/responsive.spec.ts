import { test, expect } from "@playwright/test";

// Runs in both the "chromium" (desktop) and "mobile-chromium" (~390px)
// projects automatically — no per-test viewport handling needed.
//
// PR #52 (IPI-1066) merged — /app has the real "Dashboard" heading now.
test("dashboard has no horizontal overflow @Tafece6a7", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "page scrolls horizontally — an element exceeds the viewport width").toBeLessThanOrEqual(
    clientWidth,
  );
});
