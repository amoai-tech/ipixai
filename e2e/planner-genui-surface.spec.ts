import { expect, test } from "@playwright/test";

import { plannerThreadStorageKey } from "../src/mastra/thread-types";
import { ensureCopilotOpen } from "./support/copilot-panel";

// One real, paid model call. This file belongs to the `chromium-ai-smoke`
// project only; the deterministic Surface lifecycle lives in
// `genui-surface-fixture.spec.ts` and the normal Chromium suites.
test.use({ trace: "off" });
test.describe.configure({ retries: 0 });
test.setTimeout(120_000);

test.describe("GenUI real-model Surface", () => {
  test("a real model renders the comparison card into planner-comparison", async ({
    page,
  }) => {
    // Start from a genuinely new thread. A stored id that is not in the
    // server's thread list makes `resolvePlannerThreadId` call randomUUID,
    // so the assertion below cannot pass on a card persisted by an earlier
    // test run.
    const threadsResponse = await page.request.get("/api/planner/threads");
    expect(threadsResponse.ok()).toBe(true);
    const threadsBody = (await threadsResponse.json()) as { resourceId?: unknown };
    expect(typeof threadsBody.resourceId).toBe("string");
    await page.addInitScript(
      (storageKey) => {
        window.localStorage.setItem(storageKey, crypto.randomUUID());
      },
      plannerThreadStorageKey(threadsBody.resourceId as string),
    );

    await page.goto("/app");
    await ensureCopilotOpen(page);
    await expect(
      page.getByRole("status", { name: "Loading conversation…" }),
    ).toHaveCount(0, { timeout: 30_000 });

    const textarea = page.getByTestId("copilot-chat-textarea");
    await textarea.fill(
      "Compare three summer campaign concepts for a fashion brand: studio, outdoor, and editorial. Render the comparison in the planner-comparison area, not the chat, using the ConceptComparison component with two or three options.",
    );
    await page.getByTestId("copilot-send-button").click();

    await expect(page.getByTestId("genui-concept-comparison")).toBeVisible({
      timeout: 90_000,
    });
    // A tool-only turn may have no assistant text; the rendered Surface is
    // the observable result. Do not require a hidden empty message.
    await expect(page.getByTestId("genui-concept-comparison")).toContainText(
      /Studio|Outdoor|Editorial/,
    );

    await page.screenshot({
      path: "test-results/genui-real-model.png",
      fullPage: true,
    });
  });
});
