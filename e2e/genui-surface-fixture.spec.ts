import { expect, test } from "@playwright/test";

type FixtureApi = {
  create: (title?: string) => void;
  update: (title: string) => void;
  delete: () => void;
  malformed: () => void;
  switchThread: (threadId: string) => void;
  switchScope: (scope: string) => void;
  rejectedUpdate: () => void;
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
 * a model call or an authenticated `/app` session. The paid real-model proof
 * lives in `planner-genui-surface.spec.ts` and `chromium-ai-smoke`.
 */
test.describe("GenUI Surface fixture (deterministic)", () => {
  // `/genui-fixture` is enabled only in development or the guarded Playwright
  // job. A hosted Preview or production run must not select this spec: the
  // route is 404 there and the real card proof lives in `chromium-ai-smoke`.
  test.skip(
    Boolean(process.env.E2E_BASE_URL) &&
      !/^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/.test(
        process.env.E2E_BASE_URL as string,
      ),
    "The /genui-fixture seed route is local-only; hosted proof is IPI-1430.",
  );

  test("renders, updates, deletes, recovers, scopes and reloads", async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "chromium") {
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    await page.goto("/genui-fixture");

    const card = page.getByTestId("genui-concept-comparison");
    const region = page.getByRole("region", { name: "AI comparison" });
    const focusAnchor = page.getByTestId("fixture-focus-anchor");
    await expect(region).toBeVisible({ timeout: 30_000 });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Fixture comparison")).toBeVisible();

    await focusAnchor.focus();
    await expect(focusAnchor).toBeFocused();
    await page.evaluate(() => window.__genuiFixture?.update("Updated comparison"));
    await expect(page.getByText("Updated comparison")).toBeVisible();
    await expect(focusAnchor).toBeFocused();

    await page.evaluate(() => window.__genuiFixture?.delete());
    await expect(card).toHaveCount(0);
    await expect(page.getByText("No generated comparison yet.")).toHaveCount(1);
    await expect(focusAnchor).toBeFocused();

    await page.evaluate(() => window.__genuiFixture?.malformed());
    await expect(page.getByTestId("genui-comparison-recovery")).toBeVisible();

    await page.evaluate(() =>
      window.__genuiFixture?.create("Back after recovery"),
    );
    await expect(page.getByText("Back after recovery")).toBeVisible();

    // A rejected update on a live surface must be visible, not a silent stale
    // card. The recovery status is the operator-facing signal.
    await page.evaluate(() => window.__genuiFixture?.rejectedUpdate());
    await expect(page.getByTestId("genui-comparison-recovery")).toBeVisible();
    await expect(page.getByText("Back after recovery")).toHaveCount(0);

    await page.evaluate(() => window.__genuiFixture?.create("After rejection"));
    await expect(page.getByText("After rejection")).toBeVisible();
    await expect(page.getByTestId("genui-comparison-recovery")).toHaveCount(0);

    await page.evaluate(() =>
      window.__genuiFixture?.switchThread("other-thread"),
    );
    await expect(card).toHaveCount(0);

    await page.evaluate(() =>
      window.__genuiFixture?.switchThread("genui-fixture-thread"),
    );
    await expect(page.getByText("After rejection")).toBeVisible();

    // Scope switch: the Surface follows the active scope and must not show a
    // stale card from the previous scope.
    await page.evaluate(() => window.__genuiFixture?.switchScope("other"));
    await expect(card).toHaveCount(0);
    await expect(page.getByText("After rejection")).toHaveCount(0);

    await page.evaluate(() => window.__genuiFixture?.switchScope("main"));
    await expect(page.getByText("After rejection")).toBeVisible();

    // The Surface manager is in-memory. A reload with `seed=0` must be empty,
    // not restored from another scope or from the previous page instance.
    await page.goto("/genui-fixture?seed=0");
    // Wait for the client effect to install the fixture before asserting the
    // cleared state; otherwise the server HTML alone could satisfy this check.
    await page.waitForFunction(() => Boolean(window.__genuiFixture));
    // Select the thread that held the card before reload; the in-memory
    // Surface must still be gone under that thread.
    await page.evaluate(() =>
      window.__genuiFixture?.switchThread("genui-fixture-thread"),
    );
    // The labelled region remains mounted even when the in-memory Surface is
    // cleared; the card itself must be gone.
    await expect(region).toBeAttached();
    await expect(card).toHaveCount(0);
    await expect(page.getByText("Back after recovery")).toHaveCount(0);
  });
});
