import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

import { contextForSavedRole } from "./support/login";

const shootsFile = path.resolve(__dirname, "../playwright/.auth/shoots.json");

// IPI-1087 · PLANNER-CONTEXT-001 — live proof that the visible Production
// Copilot Context line (a consumer of the same PlannerContext CopilotKit's
// useAgentContext receives — see planner-context.tsx) actually follows real
// Shoot navigation and clears on returning to /app. Unit tests
// (planner-context.test.tsx, operator-panel.test.tsx) already prove this at
// the component level with synthetic contexts; this is the one thing only a
// real browser session proves: that two *real* Shoot pages produce two
// *different* authorized contexts end to end.
//
// Deliberately does NOT add an Org B denial case here: /app/shoots/[shootId]
// calls notFound() before ReportPlannerContext ever renders (see
// shoots-journey.spec.ts's own "org B ... direct URL 404" test), and there is
// no not-found.tsx under src/app/app/, so a denied request bubbles to the
// root 404 boundary — outside AppLayout's <OperatorPanel> entirely. The
// Production Copilot panel structurally never mounts for a denied request,
// so there is no separate PlannerContext-leak path to prove beyond the
// existing page-level 404 proof.
//
// Uses the same "shoots" QA account as shoots-journey.spec.ts (org
// 00000000-0000-0000-0000-000000000001, 4 real shoots) — reused, not
// duplicated, so this stays a read-only navigation proof with no new fixture.

const NAV_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = NAV_TIMEOUT_MS + 15_000;

function contextLineLocator(page: Page) {
  return page.getByTestId("operator-chat-dock").getByTestId("production-copilot-context-line");
}

test.describe("Production Copilot Context line follows the active Shoot (IPI-1087)", () => {
  test("updates across two real Shoots and clears on returning to /app", async ({ browser }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { page, close } = await contextForSavedRole(
      browser,
      shootsFile,
      "Missing playwright/.auth/shoots.json — set E2E_TEST_EMAIL_SHOOTS / E2E_TEST_PASSWORD_SHOOTS in .env.test",
    );
    try {
      await page.goto("/app/shoots");
      await expect(page.getByRole("heading", { name: "Shoots", exact: true })).toBeVisible();

      const cards = page.locator('a[href^="/app/shoots/"]');
      const count = await cards.count();
      test.skip(count < 2, "shoots QA account needs at least 2 real shoots for this journey");

      const firstHref = await cards.nth(0).getAttribute("href");
      const secondHref = await cards.nth(1).getAttribute("href");
      expect(firstHref).toMatch(/^\/app\/shoots\/[0-9a-f-]{36}$/);
      expect(secondHref).toMatch(/^\/app\/shoots\/[0-9a-f-]{36}$/);
      expect(firstHref, "the two shoot cards should be different records").not.toBe(secondHref);

      await page.goto(firstHref!);
      await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
        timeout: NAV_TIMEOUT_MS,
      });
      const firstContext = (await contextLineLocator(page).textContent())?.trim();
      expect(firstContext, "Context line should name the open Shoot").toBeTruthy();

      await page.goto(secondHref!);
      await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
        timeout: NAV_TIMEOUT_MS,
      });
      const secondContext = (await contextLineLocator(page).textContent())?.trim();
      expect(secondContext, "Context line should name the newly open Shoot").toBeTruthy();
      expect(
        secondContext,
        "Context line must replace the previous Shoot's label, not keep/append it",
      ).not.toBe(firstContext);

      await page.goto("/app");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      // No stale Shoot label survives returning to the workspace — /app
      // itself reports WORKSPACE_PLANNER_CONTEXT explicitly (see
      // src/app/app/page.tsx), so the second Shoot's own name must be gone,
      // even though the line may legitimately show the dashboard's own
      // hero-brand line instead (untouched pre-existing behavior).
      const dock = page.getByTestId("operator-chat-dock");
      await expect(dock.getByText(secondContext!, { exact: true })).toHaveCount(0);
    } finally {
      await close();
    }
  });
});
