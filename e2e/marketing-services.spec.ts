import { test, expect } from "@playwright/test";

import { SERVICES } from "../src/components/marketing/services";

// IPI-1060 · MARKETING-SERVICES-001 — signed-out browser proof that every
// canonical service route actually serves (this task exists to close 5 live
// production 404s) and its "Start Planning" CTA reaches the real signup
// route. services-routes.test.tsx (vitest) only proves the page.tsx file
// exists on disk; this proves the route responds and the CTA works in a
// real browser. Public marketing page — no auth needed (same pattern as
// marketing-nav.spec.ts/unauthenticated.spec.ts).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("service pages: signed-out route + CTA proof", () => {
  for (const service of SERVICES) {
    test(`${service.href} returns 200 and "Start Planning" reaches /signup`, async ({ page }) => {
      const response = await page.goto(service.href);
      expect(response?.status(), `${service.href} did not return 200`).toBe(200);
      // page.goto() returns the *final* response after following any
      // redirects — a 200 alone doesn't prove the route didn't redirect
      // somewhere else that also happens to return 200. Assert we're still
      // on the requested route before trusting anything rendered on it.
      expect(
        new URL(page.url()).pathname,
        `${service.href} did not stay on its own route (redirected to ${page.url()})`,
      ).toBe(service.href);

      // Hero and the shared CTASection both render a "Start Planning" link;
      // either one reaching /signup proves the CTA, so the first is enough.
      await page.getByRole("link", { name: "Start Planning" }).first().click();
      await expect(page).toHaveURL(/\/signup$/);
    });
  }
});
