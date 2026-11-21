import path from "node:path";
import { test, expect, type Browser } from "@playwright/test";

import { contextForSavedRole } from "./support/login";

// IPI-1151: real Product journey; no mocks for approval, save, RLS, or Planner.
// This is deliberately absent from default CI: it makes paid model calls and
// creates durable QA Shoot records. Release-owner consent for both is required
// before IPI1151_APPROVED_LIVE_QA may be set by a protected staging workflow.
const authorized = process.env.IPI1151_APPROVED_LIVE_QA === "1";
const shootsFile = path.resolve(__dirname, "../playwright/.auth/shoots.json");
const orgBFile = path.resolve(__dirname, "../playwright/.auth/org-b.json");
const TIMEOUT = 120_000;

async function qaRole(browser: Browser, file: string) {
  return contextForSavedRole(
    browser, file,
    "IPI-1151 requires the setup-project's real shoots (Org A) and org-b (Org B) QA users",
  );
}

test.describe("IPI-1151 — Brand → reviewed Shoot → durable reopen and Org B denial", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!authorized, "Release owner must authorize paid AI calls AND durable QA Shoot records first");

  test("explicit human approval saves exactly once and reopens the same Shoot", async ({ browser }) => {
    test.setTimeout(5 * TIMEOUT);
    const { page: orgA, close: closeA } = await qaRole(browser, shootsFile);
    try {
      await orgA.goto("/app/brands");
      const brandHref = await orgA.locator('a[href^="/app/brands/"]').first()
        .getAttribute("href", { timeout: 30_000 });
      expect(brandHref, "Dedicated Org A QA must have a real Brand; never fabricate one").toMatch(
        /^\/app\/brands\/[0-9a-f-]{36}$/,
      );
      await orgA.goto(String(brandHref));
      const dock = orgA.getByTestId("operator-chat-dock");
      await expect(dock).toBeVisible();
      await expect(orgA.getByRole("status", { name: "Loading conversation…" }))
        .toHaveCount(0, { timeout: 30_000 });

      const runMarker = "ipi1151-" + Date.now().toString(36);
      const prompt = "Compose a COMPLETE ecommerce Shopify PDP photo Shoot Plan for this " +
        "authenticated brand now. Shoot type ecommerce PDP, 12 final photos, " +
        "studio location, 1 shoot day, USD 8000 budget, photographer and stylist, " +
        "full-body front/side/detail shots, Shopify product pages, " +
        "launch next month. Use these confirmed details, include a shot list, " +
        "deliverables and production schedule, and call the composeShootPlan tool. " +
        "Do not pretend any approval or save happened. " + runMarker;
      const composer = dock.getByTestId("copilot-chat-textarea");
      await composer.fill(prompt);
      await dock.getByTestId("copilot-send-button").click();

      // The actual composed plan must be complete and reviewable, not an
      // assistant's prose or a mocked card. A missing tool call is a real fail.
      const completeCard = dock.locator('[data-testid="compose-shoot-plan-card"][data-status="complete"]').last();
      await expect(completeCard).toBeVisible({ timeout: TIMEOUT });
      await completeCard.getByTestId("compose-shoot-plan-review-button").click();

      // The model must open the actual HITL tool; do not fake its result.
      const review = dock.getByTestId("shoot-plan-review").last();
      await expect(review).toBeVisible({ timeout: TIMEOUT });
      const approvalId = await review.getAttribute("data-approval-id");
      expect(approvalId).toMatch(/^[0-9a-f-]{36}$/i);

      const saveCalls: string[] = [];
      orgA.on("request", (request) => {
        if (new URL(request.url()).pathname === "/api/shoots/save" && request.method() === "POST") {
          saveCalls.push(request.url());
        }
      });
      expect(saveCalls).toHaveLength(0);
      const saved = orgA.waitForResponse((response) =>
        new URL(response.url()).pathname === "/api/shoots/save" &&
        response.request().method() === "POST", { timeout: TIMEOUT });
      await review.getByTestId("review-approve-and-save").click();
      const saveResponse = await saved;
      expect(saveResponse.status()).toBe(200);
      const savedResult = await saveResponse.json() as {
        ok: boolean; shootId: string; replayed: boolean;
      };
      expect(savedResult.ok).toBe(true);
      expect(savedResult.shootId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(saveCalls).toHaveLength(1);

      // Browser opens the durable Shoot, then a fresh server read restores it.
      const expectedPath = "/app/shoots/" + savedResult.shootId;
      await expect(orgA).toHaveURL((url) => url.pathname === expectedPath, { timeout: TIMEOUT });
      await expect(orgA.getByRole("tab", { name: "Overview" })).toBeVisible();
      await orgA.reload();
      await expect(orgA.getByRole("tab", { name: "Overview" })).toBeVisible();

      // Same authenticated operator retry does not create another shoot.
      const replay = await orgA.request.post("/api/shoots/save", {
        data: { approvalId },
      });
      expect(replay.status()).toBe(200);
      const replayBody = await replay.json() as {
        ok: boolean; shootId: string; replayed: boolean;
      };
      expect(replayBody).toMatchObject({
        ok: true, shootId: savedResult.shootId, replayed: true,
      });

      // Reuse the real separate Org B session to prove tenant denial, never
      // a service-role fetch that bypasses RLS or the UI.
      const { page: orgB, close: closeB } = await qaRole(browser, orgBFile);
      try {
        await orgB.goto(expectedPath);
        await expect(orgB.getByRole("heading", { name: "404" }))
          .toBeVisible({ timeout: 30_000 });
        await expect(orgB.getByRole("tab", { name: "Overview" })).toHaveCount(0);
      } finally {
        await closeB();
      }
    } finally {
      await closeA();
    }
  });
});
