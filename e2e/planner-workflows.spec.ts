import { test, expect, type Page } from "@playwright/test";

import { collectBrowserProblems, isAgentRun } from "./support/browser-problems";

/**
 * IPI-1290 · COPILOTKIT-UPGRADE-001 — real-app Planner workflows after the
 * CopilotKit 1.73.3 upgrade: compose a shoot plan, navigate while an answer
 * streams, and recover from forced failures. Every journey must finish with no
 * console errors, uncaught page errors, or unexpected 5xx.
 *
 * Makes real, paid model calls, so it lives in chromium-ai-smoke (see
 * playwright.config.ts), never in required CI.
 */
const NAV_TIMEOUT_MS = 30_000;
const RESPONSE_TIMEOUT_MS = 90_000;
const PLAN_TIMEOUT_MS = 150_000;

async function openPlanner(page: Page) {
  await page.goto("/app");
  await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
    timeout: NAV_TIMEOUT_MS,
  });
  const dock = page.getByTestId("operator-chat-dock");
  await expect(dock.getByTestId("copilot-chat-textarea")).toBeVisible({ timeout: NAV_TIMEOUT_MS });
  return dock;
}

async function send(page: Page, text: string) {
  const dock = page.getByTestId("operator-chat-dock");
  const textarea = dock.getByTestId("copilot-chat-textarea");
  await expect(textarea).toBeEditable({ timeout: NAV_TIMEOUT_MS });
  await textarea.fill(text);
  const run = page.waitForRequest(isAgentRun);
  await dock.getByTestId("copilot-send-button").click();
  await run;
}

const marker = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

test.describe("planner workflows (authenticated) @S9a41c290", () => {
  // Never retry: each attempt re-sends real, paid model requests.
  test.describe.configure({ retries: 0 });

  // Workflow 2 (reachable part). Saving the approved shoot is not covered:
  // no UI calls POST /api/shoots/save yet, so a browser cannot reach that step.
  test("composes a shoot plan whose plan card renders and survives reload", async ({ page }) => {
    test.setTimeout(PLAN_TIMEOUT_MS + NAV_TIMEOUT_MS * 4);
    const problems = collectBrowserProblems(page);
    const dock = await openPlanner(page);

    await send(
      page,
      "Compose a full shoot plan for a Shopify product shoot of our linen dress collection: " +
        "photos only, about 12 final images, launching next month. Use the shoot plan composer.",
    );
    const card = dock.getByTestId("compose-shoot-plan-card");
    await expect(card.last(), "the composed plan renders as a plan card").toBeVisible({
      timeout: PLAN_TIMEOUT_MS,
    });

    await page.reload();
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(dock.getByTestId("compose-shoot-plan-card").last(), "the plan card survives reload").toBeVisible({
      timeout: NAV_TIMEOUT_MS,
    });

    expect(problems, "no console errors, page errors, or 5xx").toEqual([]);
  });

  // Workflow 9.
  test("switching pages while an answer streams leaves the chat intact and usable", async ({ page }) => {
    test.setTimeout(RESPONSE_TIMEOUT_MS * 2 + NAV_TIMEOUT_MS * 6);
    const problems = collectBrowserProblems(page);
    let runs = 0;
    page.on("request", (request) => {
      if (isAgentRun(request)) runs += 1;
    });
    const first = marker("nav1");
    const second = marker("nav2");
    const dock = await openPlanner(page);

    await send(page, `Write six short shot ideas for a linen dress lookbook, then end with the exact line ${first}`);
    await expect(dock.getByTestId("copilot-assistant-message").last()).toHaveText(/\S/, {
      timeout: RESPONSE_TIMEOUT_MS,
    });

    await page.locator('nav a[href="/app/shoots"]').first().click();
    await expect(page).toHaveURL(/\/app\/shoots$/, { timeout: NAV_TIMEOUT_MS });
    await expect(page.getByRole("heading", { name: "Shoots", level: 1 })).toBeVisible({ timeout: NAV_TIMEOUT_MS });
    await page.locator('nav a[href="/app"]').first().click();
    await expect(page).toHaveURL(/\/app$/, { timeout: NAV_TIMEOUT_MS });

    // No stuck loading state: the composer becomes usable again.
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(dock.getByTestId("copilot-chat-textarea")).toBeEditable({ timeout: RESPONSE_TIMEOUT_MS });
    await expect(dock.getByTestId("copilot-user-message").filter({ hasText: first })).toHaveCount(1);
    expect(
      await dock.getByTestId("copilot-assistant-message").filter({ hasText: first }).count(),
      "the first answer is never duplicated",
    ).toBeLessThanOrEqual(1);

    // The chat still works after navigating.
    await send(page, `Reply with exactly this and nothing else: ${second}`);
    await expect(dock.getByTestId("copilot-assistant-message").last()).toContainText(second, {
      timeout: RESPONSE_TIMEOUT_MS,
    });
    expect(runs, "navigation must not start a duplicate run").toBe(2);

    await page.reload();
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(dock.getByTestId("copilot-user-message").filter({ hasText: first })).toHaveCount(1, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(dock.getByTestId("copilot-user-message").filter({ hasText: second })).toHaveCount(1);

    expect(problems, "no console errors, page errors, or 5xx").toEqual([]);
  });

  // Workflow 10a: conversation load fails once, the user sees why, Retry recovers.
  test("a failed conversation load shows a clear error and Retry recovers", async ({ page }) => {
    test.setTimeout(NAV_TIMEOUT_MS * 4);
    const problems = collectBrowserProblems(page, [
      /PlannerChatDock: thread bootstrap failed/,
      /Failed to load resource: the server responded with a status of 500/,
      /^HTTP 500 GET .*\/api\/planner\/threads(\?|$)/,
    ]);
    const threadList = (url: URL) => url.pathname === "/api/planner/threads";
    await page.route(threadList, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' })
        : route.fallback(),
    );

    await page.goto("/app");
    const dock = page.getByTestId("operator-chat-dock");
    await expect(dock.getByRole("alert")).toContainText("Could not load conversation.", {
      timeout: NAV_TIMEOUT_MS,
    });

    await page.unroute(threadList);
    await dock.getByRole("button", { name: "Retry" }).click();
    await expect(dock.getByRole("alert")).toHaveCount(0, { timeout: NAV_TIMEOUT_MS });
    await expect(dock.getByTestId("copilot-chat-textarea")).toBeEditable({ timeout: NAV_TIMEOUT_MS });

    expect(problems, "nothing beyond the one forced failure").toEqual([]);
  });

  // Workflow 10b: a run fails once, the user sees a clear banner (no endless
  // spinner), dismisses it, and the next prompt succeeds.
  test("a failed run shows a clear error, never spins forever, and the retry succeeds", async ({ page }) => {
    test.setTimeout(RESPONSE_TIMEOUT_MS + NAV_TIMEOUT_MS * 6);
    const problems = collectBrowserProblems(page, [
      /ProductionCopilotPanel: agent run (failed|error)/,
      /Failed to load resource: the server responded with a status of 500/,
      /^HTTP 500 POST .*\/agent\/[^/]+\/run/,
    ]);
    const ok = marker("retry");
    const dock = await openPlanner(page);

    let failNext = true;
    await page.route(/\/agent\/[^/]+\/run/, (route) => {
      if (route.request().method() === "POST" && failNext) {
        failNext = false;
        return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' });
      }
      return route.fallback();
    });

    await send(page, "Say hello.");
    const banner = page.getByTestId("copilot-run-failure");
    await expect(banner, "the failure is shown to the user").toBeVisible({ timeout: NAV_TIMEOUT_MS });
    await expect(dock.getByTestId("copilot-chat-textarea"), "no endless spinner").toBeEditable({
      timeout: NAV_TIMEOUT_MS,
    });
    await banner.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner).toHaveCount(0);

    await send(page, `Reply with exactly this and nothing else: ${ok}`);
    await expect(dock.getByTestId("copilot-assistant-message").last()).toContainText(ok, {
      timeout: RESPONSE_TIMEOUT_MS,
    });

    expect(problems, "nothing beyond the one forced failure").toEqual([]);
  });
});
