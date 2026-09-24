import { test, expect, type Page, type Request } from "@playwright/test";

/**
 * IPI-1290 · COPILOTKIT-UPGRADE-001 — the real browser Stop journey.
 *
 * R1 streams → user presses Stop → R2 is sent → the exact Stop(R1) request is
 * replayed while R2 streams → R2 must still finish. Also proves the browser's
 * /stop body names the run, and that the whole journey produces no console
 * errors, uncaught page errors, or 5xx responses.
 *
 * Makes real, paid model calls through the Planner, so it lives in the
 * chromium-ai-smoke project (see playwright.config.ts), never in required CI.
 */
const NAV_TIMEOUT_MS = 30_000;
const RESPONSE_TIMEOUT_MS = 90_000;

function collectProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      problems.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return problems;
}

const isStop = (request: Request) => request.method() === "POST" && /\/stop\//.test(request.url());
const isRun = (request: Request) => request.method() === "POST" && /\/agent\/[^/]+\/run/.test(request.url());

test.describe("planner stop journey (authenticated) @S6b1f0290", () => {
  // Never retry: each attempt re-sends real, paid model requests.
  test.describe.configure({ retries: 0 });

  test("Stop ends only its own run; a late Stop(R1) leaves R2 running to completion", async ({ page }) => {
    test.setTimeout(RESPONSE_TIMEOUT_MS * 2 + NAV_TIMEOUT_MS * 4);
    const problems = collectProblems(page);
    const marker = `r2-${Date.now().toString(36)}`;

    await page.goto("/app");
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });
    const dock = page.getByTestId("operator-chat-dock");
    const textarea = dock.getByTestId("copilot-chat-textarea");
    const sendOrStop = dock.getByTestId("copilot-send-button");
    const assistant = dock.getByTestId("copilot-assistant-message");

    // R1: a long answer, stopped once it is visibly streaming.
    await textarea.fill(
      "Write a detailed 800-word creative brief for a linen dress lookbook shoot, section by section.",
    );
    const r1Run = page.waitForRequest(isRun);
    await sendOrStop.click();
    await r1Run;
    await expect(assistant.last()).toHaveText(/\S/, { timeout: RESPONSE_TIMEOUT_MS });

    const stopRequest = page.waitForRequest(isStop);
    await sendOrStop.click(); // the send button is the Stop button while a run streams
    const stop = await stopRequest;
    const stopBody = stop.postDataJSON() as { runId?: unknown } | null;
    expect(typeof stopBody?.runId, "browser Stop must name the exact run").toBe("string");
    expect(String(stopBody?.runId)).not.toBe("");
    const stopResponse = await stop.response();
    expect(stopResponse?.status(), "Stop(R1) must be accepted").toBe(200);

    // R2: send, then replay the exact Stop(R1) while R2 streams.
    await expect(textarea).toBeEditable({ timeout: NAV_TIMEOUT_MS });
    await textarea.fill(
      `List 8 one-line shot ideas for a linen dress collection. After the list, end with the exact line ${marker}`,
    );
    const r2Run = page.waitForRequest(isRun);
    await sendOrStop.click();
    await r2Run;
    const replay = await page.request.post(stop.url(), {
      data: stop.postData() ?? "",
      headers: { "content-type": "application/json" },
    });
    // 200 + stopped:false is CopilotKit's "nothing to stop" answer, so an auth
    // or not-found rejection cannot pass for a stale Stop that was ignored.
    expect(replay.status(), "the late Stop(R1) is accepted as a no-op").toBe(200);
    expect(((await replay.json()) as { stopped?: unknown }).stopped, "the late Stop(R1) stops nothing").toBe(false);

    await expect(assistant.last(), "R2 must finish despite the late Stop(R1)").toContainText(marker, {
      timeout: RESPONSE_TIMEOUT_MS,
    });

    // History: after reload the R2 turn restores exactly once.
    await page.reload();
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(dock.getByTestId("copilot-user-message").filter({ hasText: marker })).toHaveCount(1, {
      timeout: NAV_TIMEOUT_MS,
    });
    await expect(assistant.filter({ hasText: marker })).toHaveCount(1, {
      timeout: NAV_TIMEOUT_MS,
    });

    expect(problems, "no console errors, page errors, or 5xx during the journey").toEqual([]);
  });
});
