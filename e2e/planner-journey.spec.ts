import { test, expect } from "@playwright/test";

// Makes one real configured OpenAI-model call through the hosted Production Planner agent —
// see e2e/login-journey.spec.ts for the precedent of a real hosted call
// scoped to chromium only (mobile-chromium excludes this file, see
// playwright.config.ts) so the suite doesn't pay for it twice.
const RESPONSE_TIMEOUT_MS = 45_000;
const NAV_TIMEOUT_MS = 30_000;
// Sequential waits this test can incur, worst case: 2 loading gates + the
// post-reload user/assistant checks (4 × NAV_TIMEOUT_MS) plus one real LLM
// response (RESPONSE_TIMEOUT_MS), with headroom for goto/reload's own
// navigation time and script overhead. A flat constant here previously sat
// well under the sum of the test's own per-step timeouts, so the outer
// deadline could fire before an inner wait got to report its real error.
const TEST_TIMEOUT_MS = RESPONSE_TIMEOUT_MS + NAV_TIMEOUT_MS * 4 + 30_000;

test.describe("planner journey (authenticated) @Sc4711801", () => {
  // Never retry: a retry re-sends the real, paid OpenAI request and leaves
  // a second junk thread in the shared QA account. A flaky failure here
  // should surface, not be hidden by CI's default retries: 2.
  test.describe.configure({ retries: 0 });

  test("operator gets a real budget draft from the Production Planner, and it survives reload @Tc732f1af", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    // Unique per run so the post-reload check provably reads back this
    // run's own thread, not a same-looking prompt left by an earlier run
    // against the same long-lived shared QA account.
    const runMarker = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prompt = `Estimate the shoot budget for 2 crew members, a rental studio, 10 shots, and 20 total assets to be post-produced, over 1 shoot day, in USD, using default rates. [${runMarker}]`;

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
    await textarea.fill(prompt);
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
    // (confirmed live — auto-restores without an extra click). Matching on
    // runMarker (not just the shared prompt prefix) proves this is *this
    // run's* thread, not a same-looking one left by an earlier run against
    // the same long-lived shared QA account.
    await page.reload();
    await expect(page.getByTestId("copilot-user-message").last()).toContainText(runMarker, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(page.getByTestId("copilot-assistant-message").last()).toContainText(/\$[\d,]+/, {
      timeout: NAV_TIMEOUT_MS,
    });
  });

  // IPI-1211 · COPILOT-INTELLIGENCE-RELIABILITY-001 — the budget test above
  // exercises exactly one TOOL-001 call and never covers composeShootPlan
  // (IPI-1081 · PLAN-001), which chains all 4 TOOL-001 tools plus a Supabase
  // read in one turn. That untested gap is exactly the shape of the live
  // "no response" incident (2026-09-14): the operator's real prompt below is
  // the literal reproduction of that report. This test's only claim is "the
  // Planner responds at all" — it does not assert a specific plan shape,
  // since composeShootPlan can legitimately return status "complete" or
  // "needs_input" depending on what the model decides is missing.
  test("operator gets a real composeShootPlan response for a multi-tool shoot brief @Td9c2e211", async ({
    page,
  }) => {
    // Longer than the budget test's timeout: composeShootPlan chains 4
    // sequential tool calls plus a Supabase read in one turn.
    const PLAN_RESPONSE_TIMEOUT_MS = 90_000;
    test.setTimeout(PLAN_RESPONSE_TIMEOUT_MS + NAV_TIMEOUT_MS * 3 + 30_000);

    const runMarker = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // The exact prompt from the live incident report — not a paraphrase.
    const prompt = `Plan a Shopify product shoot for our new linen dress collection. Photos only, launching next month. [${runMarker}]`;

    await page.goto("/planner");
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: NAV_TIMEOUT_MS });
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });

    await page.getByRole("button", { name: "New" }).click();

    const toggle = page.getByTestId("copilot-chat-toggle");
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }

    const textarea = page.getByTestId("copilot-chat-textarea");
    await textarea.click();
    await textarea.fill(prompt);
    await page.getByTestId("copilot-send-button").click();

    // The entire point of this test: some real assistant response must
    // appear. The live incident's exact symptom was silence — no response,
    // no error — after this same prompt, so simply reaching a non-empty
    // assistant message is the decisive assertion here.
    const assistantMessages = page.getByTestId("copilot-assistant-message");
    await expect(assistantMessages.last()).not.toHaveText("", {
      timeout: PLAN_RESPONSE_TIMEOUT_MS,
    });
    const responseText = await assistantMessages.last().innerText();
    expect(responseText.trim().length, `expected a non-empty plan response, got: "${responseText}"`).toBeGreaterThan(
      0,
    );

    // Persistence: same shape of check as the budget test above.
    await page.reload();
    await expect(page.getByTestId("copilot-user-message").last()).toContainText(runMarker, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(page.getByTestId("copilot-assistant-message").last()).not.toHaveText("", {
      timeout: NAV_TIMEOUT_MS,
    });
  });
});
