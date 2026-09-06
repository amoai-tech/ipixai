import { test, expect } from "@playwright/test";

// Makes one real GPT-4o call through the hosted Production Planner agent —
// see e2e/login-journey.spec.ts for the precedent of a real hosted call
// scoped to chromium only (mobile-chromium excludes this file, see
// playwright.config.ts) so the suite doesn't pay for it twice.
const RESPONSE_TIMEOUT_MS = 45_000;
const NAV_TIMEOUT_MS = 30_000;

test.describe("planner journey (authenticated)", () => {
  test("operator gets a real budget draft from the Production Planner, and it survives reload", async ({
    page,
  }) => {
    test.setTimeout(RESPONSE_TIMEOUT_MS + NAV_TIMEOUT_MS + 15_000);

    await page.goto("/planner");

    // Two sequential async gates before the chat exists at all — auth
    // handshake, then the threads-list fetch (both confirmed live).
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: NAV_TIMEOUT_MS });
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });

    // Guaranteed-fresh, isolated thread — don't reuse whatever the shared
    // QA account already has (confirmed live: New always resets state).
    await page.getByRole("button", { name: "New" }).click();

    const toggle = page.getByTestId("copilot-chat-toggle");
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }

    const textarea = page.getByTestId("copilot-chat-textarea");
    await textarea.click();
    await textarea.fill(
      "Estimate the shoot budget for 2 crew members, a rental studio, and 10 shots, over 1 shoot day, using default rates.",
    );
    await page.getByTestId("copilot-send-button").click();

    // Real user-visible outcome: a genuine assistant response appears.
    // Do NOT assert an exact dollar total or exact wording — verified live
    // that the LLM's tool-call parameters (and therefore the total) are
    // not perfectly reproducible run to run. Assert the structural signal
    // that a real budget computation happened, not its precise phrasing.
    const assistantMessages = page.getByTestId("copilot-assistant-message");
    await expect(assistantMessages.last()).toContainText(/\$[\d,]+/, {
      timeout: RESPONSE_TIMEOUT_MS,
    });
    const responseText = await assistantMessages.last().innerText();
    expect(
      /budget|estimate|total/i.test(responseText),
      `expected a budget-shaped response, got: ${responseText}`,
    ).toBe(true);

    // Persistence: reload and confirm the same real conversation comes back
    // (confirmed live — auto-restores without an extra click).
    await page.reload();
    await expect(page.getByTestId("copilot-user-message").last()).toContainText(
      "Estimate the shoot budget for 2 crew members",
      { timeout: NAV_TIMEOUT_MS },
    );
    await expect(page.getByTestId("copilot-assistant-message").last()).toContainText(/\$[\d,]+/, {
      timeout: NAV_TIMEOUT_MS,
    });
  });
});
