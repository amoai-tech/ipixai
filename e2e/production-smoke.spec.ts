import { expect, test } from "@playwright/test";

import { signInAsE2ETestOperator } from "./support/login";

/**
 * Production-only, non-destructive smoke coverage.
 *
 * This suite uses only the dedicated QA account and never creates accounts,
 * organizations, memberships, content, payments, or other durable app state.
 * The production config requires explicit opt-in and disables traces, videos,
 * and screenshots so production credentials/session material are not retained.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function gotoWithNetworkChangeRetry(page: import("@playwright/test").Page, url: string) {
  try {
    await page.goto(url);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ERR_NETWORK_CHANGED")) {
      throw error;
    }
    await page.goto(url);
  }
}

test("production auth lifecycle: sign in, sign out, and protected route stays closed", async ({
  page,
}) => {
  await gotoWithNetworkChangeRetry(page, "/login");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute(
    "href",
    "/signup",
  );

  await signInAsE2ETestOperator(page);
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole("button", { name: "Sign out", exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);

  await gotoWithNetworkChangeRetry(page, "/app");
  await expect(page).toHaveURL(/\/login$/);
});

test("production desktop marketing auth links target sign-in and sign-up", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoWithNetworkChangeRetry(page, "/");
  const header = page.getByRole("banner");
  const footer = page.getByRole("contentinfo");
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  await expect(header.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
  await expect(footer.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  await expect(footer.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
});

test("production mobile marketing auth links expose sign-in and sign-up", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoWithNetworkChangeRetry(page, "/");
  await page.getByRole("button", { name: "Toggle menu" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile" });
  await expect(nav.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Sign up" })).toBeVisible();
  await nav.getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});
