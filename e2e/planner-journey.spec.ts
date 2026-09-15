import { test, expect, type Page } from "@playwright/test";

// Authenticated Production Planner journey on the real product surface.
//
// IPI-1081 · PLAN-001 migrated this file off the legacy CopilotKit starter
// route /planner (src/app/planner-app.tsx) onto /app, which is the only
// surface that certifies the shipped Planner:
//   /app (src/app/app/layout.tsx, force-dynamic, requireResolvedAppWorkspace)
//     → OperatorPanel
//     → PlannerChatDock → CopilotChat agentId="default"
//     → src/mastra/index.ts registry key "default" → productionPlannerAgent
// /planner is NOT acceptance evidence for PLAN-001 and must not be used here.
//
// These tests prove the operator-facing transport contract only: an
// authenticated operator on /app sends a real brief and gets a real,
// non-empty assistant response. They deliberately do NOT assert which tool
// ran — Mastra owns tool selection and it is probabilistic. The decisive
// "composeShootPlan actually executes and returns a schema-valid ShootPlan"
// proof is the deterministic runtime test in
// tests/plan-001-planner-runtime.test.ts (mock model, real agent loop).
//
// Real, paid OpenAI calls: this file runs only under the chromium-ai-smoke
// project (see playwright.config.ts) via `npm run e2e:ai-smoke`, so the
// deterministic `npm run e2e` suite never depends on hosted AI availability.
const RESPONSE_TIMEOUT_MS = 45_000;
const NAV_TIMEOUT_MS = 30_000;

/** Wait for the /app chat dock to be mounted and interactive. Unlike the
 *  legacy /planner surface there is no New button, no threads drawer and no
 *  "Loading conversation…" gate on /app — CopilotChat is rendered inline and
 *  the route's auth is resolved server-side before the page streams. The
 *  dock's own welcome copy is the honest signal that the chat mounted. */
async function openOperatorChat(page: Page): Promise<void> {
  const chatDock = page.getByTestId("operator-chat-dock");
  await expect(chatDock).toBeVisible({ timeout: NAV_TIMEOUT_MS });
  await expect(chatDock.getByTestId("copilot-chat-textarea")).toBeVisible({
    timeout: NAV_TIMEOUT_MS,
  });
}

test.describe("planner journey (authenticated) @Sc4711801", () => {
  // Never retry: a retry re-sends the real, paid OpenAI request and leaves
  // a second junk thread in the shared QA account. A flaky failure here
  // should surface, not be hidden by CI's default retries: 2.
  test.describe.configure({ retries: 0 });

  test("operator gets a real budget draft from the Production Planner @Tc732f1af", async ({
    page,
  }) => {
    test.setTimeout(RESPONSE_TIMEOUT_MS + NAV_TIMEOUT_MS * 3 + 30_000);

    // Unique per run so a later run against the same long-lived shared QA
    // account can prove which turn this was, and so a stale assistant
    // message from an earlier conversation can't satisfy the assertion.
    const runMarker = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prompt = `Estimate the shoot budget for 2 crew members, a rental studio, 10 shots, and 20 total assets to be post-produced, over 1 shoot day, in USD, using default rates. [${runMarker}]`;

    await page.goto("/app");
    await openOperatorChat(page);

    const chatDock = page.getByTestId("operator-chat-dock");
    const textarea = chatDock.getByTestId("copilot-chat-textarea");
    await textarea.click();
    await textarea.fill(prompt);
    await chatDock.getByTestId("copilot-send-button").click();

    // Real user-visible outcome: a genuine assistant response appears.
    // Do NOT assert an exact dollar total or exact wording — verified live
    // that the LLM's tool-call parameters (and therefore the total) are
    // not perfectly reproducible run to run. Assert the structural signal
    // that a real budget computation happened, not its precise phrasing.
    const assistantMessages = chatDock.getByTestId("copilot-assistant-message");
    await expect(assistantMessages.last()).toContainText(/\$[\d,]+/, {
      timeout: RESPONSE_TIMEOUT_MS,
    });
    const responseText = await assistantMessages.last().innerText();
    expect(
      /budget|estimate|total/i.test(responseText),
      `expected a budget-shaped response, got: ${responseText}`,
    ).toBe(true);
  });

  // IPI-1211 · COPILOT-INTELLIGENCE-RELIABILITY-001 — regression coverage
  // for the 2026-09-14 silent-response incident, now driven through the real
  // /app Planner (IPI-1081 · PLAN-001). The prompt below is the literal,
  // unparaphrased incident report, and unlike the budget test above it's
  // shaped to trigger composeShootPlan's multi-tool turn. As with every test
  // in this file, it verifies the operator-facing contract only: a real
  // authenticated /app Planner request produces visible assistant output.
  // It does NOT assert which model/tool path produced the answer —
  // composeShootPlan can legitimately return "complete" or "needs_input",
  // or the model may reasonably ask a clarifying question instead of
  // calling it at all on this exact turn. Asserting a specific tool call
  // here would make an incident-response regression test depend on a
  // probabilistic model decision (Mastra's agent owns tool selection, not
  // the caller); that's a job for tests/plan-001-planner-runtime.test.ts,
  // not this browser/transport-health test.
  test("operator gets a Planner response for the real shoot-brief regression @Td9c2e211", async ({
    page,
  }) => {
    // Longer than the budget test's timeout: this prompt can trigger
    // composeShootPlan's multi-tool turn, which is slower than a single
    // tool call.
    const PLAN_RESPONSE_TIMEOUT_MS = 90_000;
    test.setTimeout(PLAN_RESPONSE_TIMEOUT_MS + NAV_TIMEOUT_MS * 2 + 30_000);

    const runMarker = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Incident prompt plus a unique marker so this turn is identifiable.
    const prompt = `Plan a Shopify product shoot for our new linen dress collection. Photos only, launching next month. [${runMarker}]`;

    await page.goto("/app");
    await openOperatorChat(page);

    const chatDock = page.getByTestId("operator-chat-dock");
    const textarea = chatDock.getByTestId("copilot-chat-textarea");
    await textarea.click();
    await textarea.fill(prompt);
    await chatDock.getByTestId("copilot-send-button").click();

    // The entire point of this test: some real assistant response must
    // appear. The live incident's exact symptom was silence — no response,
    // no error — after this same prompt, so simply reaching a non-empty
    // assistant message is the decisive assertion here.
    const assistantMessages = chatDock.getByTestId("copilot-assistant-message");
    await expect(assistantMessages.last()).not.toHaveText("", {
      timeout: PLAN_RESPONSE_TIMEOUT_MS,
    });
    const responseText = await assistantMessages.last().innerText();
    expect(responseText.trim().length, `expected a non-empty plan response, got: "${responseText}"`).toBeGreaterThan(
      0,
    );
  });
});
