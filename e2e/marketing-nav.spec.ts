import { test, expect } from "@playwright/test";

// IPI-1157 · AUTH-UX-001 — public marketing pages, no auth needed. Overrides
// the chromium/mobile-chromium projects' default authenticated storageState
// (same pattern as unauthenticated.spec.ts).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("marketing header/footer: Sign in vs Sign up navigation @S15d22453", () => {
  test("desktop header: Sign in and Sign up navigate to distinct routes @T4c6802e5", async ({ page }, testInfo) => {
    // The desktop nav is `hidden md:flex` — present in the DOM but not
    // visible below the md breakpoint, so this only runs where it's real.
    test.skip(testInfo.project.name !== "chromium", "desktop nav only");

    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await nav.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();

    await page.goto("/");
    await nav.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  });

  test("mobile menu: Sign in and Sign up both navigate and the sheet closes @T8d7f5190", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "mobile sheet only renders below the md breakpoint");

    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Toggle menu" });
    await toggle.click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile" });
    await mobileNav.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    // MarketingHeader is rendered by the shared (marketing) layout, which
    // persists across this client-side navigation — if the link's onClick
    // hadn't closed the sheet, it would still be open on /signup.
    await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);

    await page.goto("/");
    await toggle.click();
    await mobileNav.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);
  });

  test("footer: Sign in and Sign up navigate to distinct routes @T94dfb5cf", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await footer.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/signup$/);

    await page.goto("/");
    await footer.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
