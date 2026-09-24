import { test, expect, type Page } from "@playwright/test";

import { collectBrowserProblems } from "./support/browser-problems";

/**
 * IPI-1290 · COPILOTKIT-UPGRADE-001 — Brand Intelligence from the Brand page and
 * from Planner chat must both reach the Brand DNA draft.
 *
 * Opt-in only. A run starts a real site crawl and writes the brand's intake
 * status and draft in the target Supabase project, and the server needs the
 * Supabase secret key. So it never runs by default: set both
 *   E2E_BRAND_INTEL_BRAND_ID  — a dedicated QA brand in the signed-in org
 *   E2E_BRAND_INTEL_ALLOW_WRITES=1
 * and point E2E_BASE_URL at a deployment that has the crawl credentials
 * (a Vercel Preview), never Production.
 */
const brandId = process.env.E2E_BRAND_INTEL_BRAND_ID ?? "";
const allowed = process.env.E2E_BRAND_INTEL_ALLOW_WRITES === "1" && /^[0-9a-f-]{36}$/i.test(brandId);
const ANALYSIS_TIMEOUT_MS = 8 * 60_000;
const POLL_MS = 15_000;
const NAV_TIMEOUT_MS = 30_000;

/** Reloads the brand page until the draft card appears; fails fast on "Analysis failed". */
const waitForDraft = async (page: Page) => {
  const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;
  try {
    for (;;) {
      await page.goto(`/app/brands/${brandId}`);
      if (await page.getByText("Analysis failed", { exact: true }).isVisible()) {
        throw new Error("the brand page shows 'Analysis failed'");
      }
      if (await page.getByText(/— Brand DNA draft$/).isVisible()) return;
      if (Date.now() > deadline) throw new Error("the draft did not appear in time");
      await page.waitForTimeout(POLL_MS);
    }
  } catch (err) {
    // A navigation or locator failure mid-poll surfaces with the brand it was waiting on.
    throw new Error(`Waiting for the Brand DNA draft of brand ${brandId} failed: ${String(err)}`, {
      cause: err,
    });
  }
};

test.describe("brand intelligence journey (authenticated) @S3c7e1290", () => {
  test.describe.configure({ retries: 0, mode: "serial" });
  test.skip(!allowed, "Opt-in: set E2E_BRAND_INTEL_BRAND_ID and E2E_BRAND_INTEL_ALLOW_WRITES=1");

  test("started from the Brand page, the analysis reaches the Brand DNA draft", async ({ page }) => {
    test.setTimeout(ANALYSIS_TIMEOUT_MS + NAV_TIMEOUT_MS * 2);
    const problems = collectBrowserProblems(page);

    await page.goto(`/app/brands/${brandId}`);
    await page.getByRole("button", { name: /^(Start analysis|Run a new analysis|Retry analysis)$/ }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await waitForDraft(page);

    expect(problems, "no console errors, page errors, or 5xx").toEqual([]);
  });

  test("started from Planner chat, the analysis reaches the Brand DNA draft", async ({ page }) => {
    test.setTimeout(ANALYSIS_TIMEOUT_MS + NAV_TIMEOUT_MS * 4);
    const problems = collectBrowserProblems(page);

    await page.goto("/app");
    const dock = page.getByTestId("operator-chat-dock");
    await expect(dock.getByTestId("copilot-chat-textarea")).toBeEditable({ timeout: NAV_TIMEOUT_MS });
    await dock
      .getByTestId("copilot-chat-textarea")
      .fill(`Start a brand intelligence analysis for the brand with id ${brandId}.`);
    await dock.getByTestId("copilot-send-button").click();
    await expect(dock.getByTestId("copilot-assistant-message").last()).toHaveText(/\S/, {
      timeout: NAV_TIMEOUT_MS * 3,
    });
    await waitForDraft(page);

    expect(problems, "no console errors, page errors, or 5xx").toEqual([]);
  });
});
