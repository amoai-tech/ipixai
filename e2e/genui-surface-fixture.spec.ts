import { expect, test } from "@playwright/test";

type FixtureApi = {
  create: (title?: string) => void;
  update: (title: string) => void;
  delete: () => void;
  malformed: () => void;
  switchThread: (threadId: string) => void;
};

declare global {
  interface Window {
    __genuiFixture?: FixtureApi;
  }
}

test.use({ trace: "off" });
test.setTimeout(90_000);

/**
 * Free, deterministic browser proof for the existing GenUI Surface.
 *
 * It navigates to the guarded `/genui-fixture` page, which mounts the real v2
 * provider, the same catalog and the same `planner-comparison` Surface without
 * a model call or an authenticated `/app` session. This covers create, update, delete, malformed recovery and
 * thread isolation in a real browser; the paid real-model proof lives in
 * `planner-genui-surface.spec.ts` and the `chromium-ai-smoke` project.
 */
test.describe("GenUI Surface fixture (deterministic)", () => {
  test("renders, updates, deletes, recovers and follows the active thread", async ({
    page,
  }) => {
    await page.goto("/genui-fixture");

    const card = page.getByTestId("genui-concept-comparison");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Fixture comparison")).toBeVisible();

    await page.evaluate(() => window.__genuiFixture?.update("Updated comparison"));
    await expect(page.getByText("Updated comparison")).toBeVisible();

    await page.evaluate(() => window.__genuiFixture?.delete());
    await expect(card).toHaveCount(0);
    await expect(page.getByText("No generated comparison yet.")).toHaveCount(1);

    await page.evaluate(() => window.__genuiFixture?.malformed());
    await expect(page.getByTestId("genui-comparison-recovery")).toBeVisible();

    await page.evaluate(() =>
      window.__genuiFixture?.create("Back after recovery"),
    );
    await expect(page.getByText("Back after recovery")).toBeVisible();

    await page.evaluate(() =>
      window.__genuiFixture?.switchThread("other-thread"),
    );
    await expect(card).toHaveCount(0);

    await page.evaluate(() =>
      window.__genuiFixture?.switchThread("genui-fixture-thread"),
    );
    await expect(page.getByText("Back after recovery")).toBeVisible();
  });
});
