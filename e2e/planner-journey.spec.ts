import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";

import { plannerThreadStorageKey } from "../src/mastra/thread-types";
import { isAgentRun as isRun } from "./support/browser-problems";

/** Reads the thread PlannerChatDock persisted for the currently
 *  authenticated resource. Resolve resourceId from the same
 *  tenant-scoped server endpoint the UI uses, then read that exact storage
 *  key so a stale key from another resource cannot satisfy the assertion. */
async function getStoredPlannerThreadId(page: Page): Promise<string | null> {
  const response = await page.request.get("/api/planner/threads");
  expect(response.ok(), "authenticated planner thread list should load").toBe(true);
  const body = (await response.json()) as { resourceId?: unknown };
  const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
  expect(resourceId, "planner thread list should identify the active resource").not.toBe("");

  return page.evaluate(
    (storageKey) => window.localStorage.getItem(storageKey),
    plannerThreadStorageKey(resourceId),
  );
}

// Makes one real configured OpenAI-model call through the hosted Production Planner agent —
// see e2e/login-journey.spec.ts for the precedent of a real hosted call
// scoped to chromium only (mobile-chromium excludes this file, see
// playwright.config.ts) so the suite doesn't pay for it twice.
const RESPONSE_TIMEOUT_MS = 45_000;
const NAV_TIMEOUT_MS = 30_000;
/**
 * IPI-1339 · PLANNER-PAYLOAD-001 — Vercel rejects a function request body above
 * 4.5 MB with `413 FUNCTION_PAYLOAD_TOO_LARGE`. One Planner turn measured
 * ~1-9 KB, so this ceiling is generous while still catching the amplification
 * that produced an 8.5 MB body (one persisted 8,410,422-byte tool message).
 */
const BOUNDED_RUN_BODY_BYTES = 64 * 1024;
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

    // IPI-1225 · PLANNER-ROUTE-RETIRE-001 — migrated from /planner (retired
    // to a compatibility redirect). /app has no "New"/toggle controls —
    // its embedded CopilotChat is always visible once mounted, and (like
    // the two tests below) reuses whatever thread the shared QA account's
    // storage key already resolves to; runMarker is what proves identity
    // across reload, not a guaranteed-fresh thread.
    await page.goto("/app");
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });

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

  // IPI-1211 · COPILOT-INTELLIGENCE-RELIABILITY-001 — regression coverage
  // for the 2026-09-14 silent-response incident. The prompt below is the
  // literal, unparaphrased incident report, and unlike the budget test
  // above it's shaped to trigger composeShootPlan's multi-tool turn
  // (IPI-1081 · PLAN-001) — but this test deliberately only verifies the
  // operator-facing contract: a real authenticated Planner request
  // produces visible assistant output, and that output survives reload.
  // It does NOT assert which model/tool path produced the answer —
  // composeShootPlan can legitimately return "complete" or "needs_input",
  // or the model may reasonably ask a clarifying question instead of
  // calling it at all on this exact turn. Asserting a specific tool call
  // here would make an incident-response regression test depend on a
  // probabilistic model decision (Mastra's agent owns tool selection, not
  // the caller); that's a job for composeShootPlan's own tool-level tests,
  // not this browser/transport-health test.
  test("operator gets a real shoot-plan response from /app and it survives reload @Td9c2e211", async ({
    page,
  }) => {
    // Longer than the budget test's timeout: this prompt can trigger
    // composeShootPlan's multi-tool turn, which is slower than a single
    // tool call.
    const PLAN_RESPONSE_TIMEOUT_MS = 90_000;
    // IPI-1339 added a second real model response (the post-reload follow-up)
    // plus its own network waits, so double the response budget and give the
    // extra navigation/assertion waits their own headroom.
    test.setTimeout(PLAN_RESPONSE_TIMEOUT_MS * 2 + NAV_TIMEOUT_MS * 4 + 30_000);

    const runMarker = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Incident prompt plus a unique marker used to prove this exact
    // conversation restores after reload.
    const prompt = `Plan a Shopify product shoot for our new linen dress collection. Photos only, launching next month. [${runMarker}]`;

    await page.goto("/app");
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });

    // IPI-1339: pin a conversation belonging to this run. This hosted QA
    // account is shared, so resolving "the most recently used thread" let a
    // message written by another spec become `.last()` below and made this
    // test depend on execution order. A fresh id is absent from the account's
    // thread list, so the app's own stale-thread rule starts a new
    // conversation — no data is written or deleted.
    const threadsResponse = await page.request.get("/api/planner/threads");
    expect(threadsResponse.ok(), "planner thread list should load").toBe(true);
    const { resourceId } = (await threadsResponse.json()) as { resourceId?: unknown };
    expect(typeof resourceId, "planner thread list should identify the active resource").toBe("string");
    await page.evaluate(
      ([storageKey, threadId]) => window.localStorage.setItem(storageKey, threadId),
      [plannerThreadStorageKey(String(resourceId)), randomUUID()],
    );
    await page.reload();
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });

    const chatDock = page.getByTestId("operator-chat-dock");
    await expect(chatDock).toBeVisible({ timeout: NAV_TIMEOUT_MS });
    const textarea = chatDock.getByTestId("copilot-chat-textarea");
    await textarea.click();
    await textarea.fill(prompt);
    await chatDock.getByTestId("copilot-send-button").click();

    // The entire point of this test: some real assistant response must
    // appear. The live incident's exact symptom was silence — no response,
    // no error — after this same prompt, so simply reaching a non-empty
    // assistant message is the decisive assertion here.
    const assistantMessages = chatDock.getByTestId("copilot-assistant-message");
    await expect(assistantMessages.last()).toHaveText(/\S/, {
      timeout: PLAN_RESPONSE_TIMEOUT_MS,
    });
    const responseText = await assistantMessages.last().innerText();
    expect(responseText.trim().length, `expected a non-empty plan response, got: "${responseText}"`).toBeGreaterThan(
      0,
    );

    // Preserve IPI-1217's thread-lifecycle contract while proving PLAN-001 on
    // the real production surface: the same tenant-scoped thread must survive
    // reload and restore this exact planning turn.
    const resolvedThreadId = await getStoredPlannerThreadId(page);
    expect(resolvedThreadId, "PlannerChatDock should persist the active thread before reload").not.toBeNull();

    await page.reload();
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(page.getByTestId("operator-chat-dock").getByTestId("copilot-user-message").last()).toContainText(
      runMarker,
      { timeout: NAV_TIMEOUT_MS },
    );
    await expect(page.getByTestId("operator-chat-dock").getByTestId("copilot-assistant-message").last()).toHaveText(
      /\S/,
      { timeout: NAV_TIMEOUT_MS },
    );
    expect(await getStoredPlannerThreadId(page), "reload must keep the same tenant-scoped Planner thread").toBe(
      resolvedThreadId,
    );

    // IPI-1339 · PLANNER-PAYLOAD-001 — a real follow-up *after* restoring a
    // plan-producing conversation. This is the request that used to grow with
    // stored history until Vercel rejected it, so measure the actual browser
    // body rather than estimating it.
    await expect(textarea).toBeEditable({ timeout: NAV_TIMEOUT_MS });
    const followUpMarker = `follow-up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await textarea.fill(`Reply with only this token, nothing else: ${followUpMarker}`);
    const followUpRun = page.waitForRequest(isRun);
    const followUpResponse = page.waitForResponse((response) => isRun(response.request()));
    await chatDock.getByTestId("copilot-send-button").click();
    const [followUpRequest, followUpReply] = await Promise.all([followUpRun, followUpResponse]);

    expect(
      followUpReply.status(),
      "the restored plan thread must be accepted, not rejected as FUNCTION_PAYLOAD_TOO_LARGE",
    ).toBe(200);
    const { requestBodySize } = await followUpRequest.sizes();
    expect(
      requestBodySize,
      "the run body must stay far below Vercel's 4.5 MB function payload ceiling",
    ).toBeLessThan(BOUNDED_RUN_BODY_BYTES);
    expect(
      followUpRequest.postData() ?? "",
      "restored durable history must not be re-sent — only the newest turn is forwarded",
    ).not.toContain(runMarker);
    await expect(
      page.getByTestId("operator-chat-dock").getByTestId("copilot-assistant-message").last(),
      "the follow-up after restoring a plan must still be answered",
    ).toContainText(followUpMarker, { timeout: PLAN_RESPONSE_TIMEOUT_MS });
  });

  // IPI-1217 · COPILOT-APP-DOCK-002 — regression coverage for /app's
  // embedded chat dock. Proven live (11/11 fresh-context attempts): the
  // network run completes (RUN_STARTED/RUN_FINISHED) but the visible
  // CopilotChat stayed at messages.length === 0 forever, because /app never
  // passed CopilotChat an explicit threadId. This deliberately lives
  // alongside the other real-AI /app tests in this file (not in
  // e2e/dashboard.spec.ts) because it makes the same real, paid Production
  // Planner call — dashboard.spec.ts is matched by the default chromium/
  // mobile-chromium projects the required playwright-e2e CI job runs on
  // every PR, and putting a real LLM call there would reintroduce the
  // hosted-provider CI dependency this file is already isolated from (see
  // playwright.config.ts's chromium-ai-smoke project). /app's chat is an
  // inline CopilotChat, always visible once mounted — no toggle/popup.
  test("operator gets a real response from /app's embedded chat, and it survives reload @Tb1e0f4a2", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    const runMarker = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prompt = `Say hello and repeat this marker back to me: [${runMarker}]`;

    await page.goto("/app");
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });

    const textarea = page.getByTestId("copilot-chat-textarea");
    await textarea.click();
    await textarea.fill(prompt);
    await page.getByTestId("copilot-send-button").click();

    // The user's own message must stay visible (not just accepted) and a
    // real, non-empty assistant response must appear — the exact outcome
    // that silently failed before this fix, with no console/page error.
    await expect(page.getByTestId("copilot-user-message").last()).toContainText(runMarker, {
      timeout: NAV_TIMEOUT_MS,
    });
    // /\S/ (not just "not empty string") so a whitespace-only response
    // can't pass as a real answer — not.toHaveText("") only rejects an
    // exactly-empty string.
    const assistantMessages = page.getByTestId("copilot-assistant-message");
    await expect(assistantMessages.last()).toHaveText(/\S/, {
      timeout: RESPONSE_TIMEOUT_MS,
    });

    // Explicit thread-identity proof, not just an inferred one: /app has no
    // "New" button, so on a shared QA account with other threads created
    // moments earlier by the tests above, the resolved thread is whichever
    // one plannerThreadStorageKey pins in localStorage — capture it here so
    // a future regression that silently resolves a *different* thread after
    // reload (rather than a message simply not appearing) fails on this
    // assertion specifically, not just on the visible-text checks below.
    const resolvedThreadId = await getStoredPlannerThreadId(page);
    expect(resolvedThreadId, "PlannerChatDock should have persisted a resolved threadId by now").not.toBeNull();

    // Persistence: reload restores the same conversation under the same
    // resolved thread, matching the other real-AI /app tests above.
    await page.reload();
    await expect(page.getByTestId("copilot-user-message").last()).toContainText(runMarker, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(page.getByTestId("copilot-assistant-message").last()).toHaveText(/\S/, {
      timeout: NAV_TIMEOUT_MS,
    });
    expect(await getStoredPlannerThreadId(page), "reload must resolve the identical thread, not a different one").toBe(
      resolvedThreadId,
    );
  });


});
