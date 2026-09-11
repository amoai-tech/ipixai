import { test, expect, type Browser, type Page, type TestInfo } from "@playwright/test";

import { signInIsolatedContext } from "./support/login";

// IPI-1149 · DASH-MAIN-002 — Finish and Certify the Portfolio-First Command
// Center in iPix V2
//
// Deterministic populated-org proof for the /app Command Center — closes
// the gap the issue's own audit calls out: every existing /app Playwright
// assertion (dashboard.spec.ts) runs against the shared E2E_TEST_EMAIL
// account, whose org has 0 brands/0 shoots by design — so none of it can
// prove a real hero, populated Recent Work tiles, or a portfolio-aware
// Intelligence rail/chat welcome. This file signs in as the same populated
// Shoots QA account shoots-journey.spec.ts already uses (org
// 00000000-0000-0000-0000-000000000001, 4 real shoots) and asserts on /app
// itself instead of /app/shoots. Read-only — no fixtures are created,
// mutated, or deleted.

const NAV_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = NAV_TIMEOUT_MS + 30_000;

// Next.js dev mode replays a Server Component's own console.error calls
// into the browser console, prefixed "Server". The local/CI web server this
// suite runs against has no CLOUDINARY_CLOUD_NAME configured (unlike
// production), so loadRecentWorkPreviews's per-asset catch — the same
// honest-placeholder contract recent-work-tile.tsx renders on — logs
// exactly this message for every candidate asset. Expected in this
// environment, not a regression; any *other* console error still fails the
// test below.
const IGNORABLE_SERVER_REPLAY = /dashboard\.loadRecentWorkPreviews: candidate preview threw/;

async function signInPopulatedOrg(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  return signInIsolatedContext(
    browser,
    process.env.E2E_TEST_EMAIL_SHOOTS,
    process.env.E2E_TEST_PASSWORD_SHOOTS,
    "E2E_TEST_EMAIL_SHOOTS / E2E_TEST_PASSWORD_SHOOTS are missing — set them in .env.test",
  );
}

/** Attaches a full-page screenshot to the HTML report/artifact instead of
 *  writing a loose file — the CI playwright-report upload already carries
 *  test attachments, so this is the same evidence path dashboard.spec.ts's
 *  existing assertions ride, not a new artifact mechanism. */
async function attachScreenshot(testInfo: TestInfo, name: string, page: Page) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: false }), contentType: "image/png" });
}

test.describe("populated Command Center (authenticated, real org data) @S4a09cc59", () => {
  test("loads /app with a real hero, no console/page errors, no 0-brand empty state @T5d09e888", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { page, close } = await signInPopulatedOrg(browser);
    try {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error" && !IGNORABLE_SERVER_REPLAY.test(msg.text())) {
          errors.push(msg.text());
        }
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/app");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

      // Real brand/shoot data, not the honest-empty path dashboard.spec.ts
      // already covers for the 0-brand account.
      await expect(page.getByRole("heading", { name: "No brands yet" })).toHaveCount(0);
      await expect(page.getByTestId("command-center-hero")).toBeVisible();
      await expect(page.getByTestId("command-center-brand-list")).toBeVisible();

      expect(errors, `console/page errors: ${errors.join("; ")}`).toEqual([]);
      await attachScreenshot(testInfo, "desktop-1440x900-app-populated", page);
    } finally {
      await close();
    }
  });

  test("chat welcome and Intelligence rail are portfolio-aware, not generic @T166229d1", async ({ browser }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { page, close } = await signInPopulatedOrg(browser);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/app");

      // Portfolio-aware welcome (portfolioWelcomeText in operator-panel.tsx):
      // never the generic "Ask a question to get started." once real stats
      // exist for this route.
      const chatDock = page.getByTestId("operator-chat-dock");
      await expect(chatDock).toBeVisible();
      await expect(chatDock.getByText("Ask a question to get started.")).toHaveCount(0);
      await expect(chatDock.getByText(/^You're working with /)).toBeVisible();

      const rail = page.getByTestId("intelligence-rail");
      await expect(rail.getByTestId("intelligence-brand-context")).toBeVisible();
      await expect(rail.getByTestId("intelligence-workspace-stats")).not.toHaveText(
        "0 brands · 0 shoots in this workspace.",
      );
      // Real signal only — same acceptance criterion as the 0-brand test.
      await expect(rail.getByText(/approval/i)).toHaveCount(0);
      await expect(rail.getByText(/activity/i)).toHaveCount(0);
    } finally {
      await close();
    }
  });

  test("Recent Work renders real tiles that deep-link to their exact shoot @T8e54ea68", async ({ browser }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { page, close } = await signInPopulatedOrg(browser);
    try {
      await page.goto("/app");
      const shootList = page.getByTestId("command-center-shoot-list");
      await expect(shootList).toBeVisible();

      const tiles = shootList.locator('a[href^="/app/shoots/"]');
      await expect(tiles.first()).toBeVisible();
      const href = await tiles.first().getAttribute("href");
      expect(href).toMatch(/^\/app\/shoots\/[0-9a-f-]{36}$/);

      // Exact per-shoot deep link — not a generic /app/shoots fallback.
      await tiles.first().click();
      await page.waitForURL(href!, { timeout: NAV_TIMEOUT_MS });
    } finally {
      await close();
    }
  });

  test("an authorized Recent Work image, when present, loads over HTTP 200 from Cloudinary @T10b2799c", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { page, close } = await signInPopulatedOrg(browser);
    try {
      // Listen for the actual network responses instead of the post-load
      // DOM: recent-work-tile.tsx swaps a failed <img> for the placeholder
      // in its onError handler, so by the time a test can query the DOM, a
      // *configured-but-failed* preview and *no preview configured at all*
      // both look identical (zero <img> elements). The response list below
      // is captured before that swap can happen, so the two cases stay
      // distinguishable.
      const cloudinaryResponses: Array<{ url: string; status: number }> = [];
      page.on("response", (response) => {
        if (/\.cloudinary\.com\//.test(response.url())) {
          cloudinaryResponses.push({ url: response.url(), status: response.status() });
        }
      });

      await page.goto("/app");
      const shootList = page.getByTestId("command-center-shoot-list");
      await expect(shootList).toBeVisible();
      // Let any in-flight authorized-preview image requests settle before
      // deciding whether one was configured at all.
      await page.waitForLoadState("networkidle").catch(() => {});

      if (cloudinaryResponses.length === 0) {
        // Honest, not a failure: no shoot in this fixture currently has an
        // authorized preview (or, in this dev/CI environment, Cloudinary
        // isn't configured at all — see IGNORABLE_SERVER_REPLAY above) — so
        // every tile fell back to its placeholder (recent-work-tile.tsx's
        // showImage=false branch). Assert a real placeholder tile rendered
        // rather than silently passing — .first() because every populated
        // tile renders its own title/meta text, so the bare matcher below
        // resolves to several elements, not one.
        //
        // This is *not* proof of the signed-preview → HTTP 200 path — that
        // path is only exercised when a Cloudinary-configured environment
        // actually returns a preview. Flagged in the report, not just this
        // comment, so a green run here is never read as full media-path
        // certification.
        testInfo.annotations.push({
          type: "note",
          description:
            "No Cloudinary preview response observed — the HTTP 200 signed-preview path was NOT exercised this run (placeholder path only).",
        });
        await expect(shootList.getByText(/./).first()).toBeVisible();
        return;
      }

      const preview = cloudinaryResponses[0];
      // Every assertion below is boolean/status-only — never the raw signed
      // URL itself — so a failure's "Received"/"Expected" output can't leak
      // it. Only the HTTP status and a redacted asset label (the URL's last
      // path segment) identify which preview failed.
      const redactedLabel = new URL(preview.url).pathname.split("/").pop() ?? "unknown-asset";
      expect(preview.status, `expected HTTP 200 for authorized preview (${redactedLabel})`).toBe(200);
      // Never the raw, unsigned column this contract explicitly forbids —
      // asserted as a boolean so a failure never prints the actual URL.
      const isRawMoodBoardUrl = preview.url.includes("mood_board_urls");
      expect(
        isRawMoodBoardUrl,
        `authorized preview must never be a raw mood_board_urls URL (asset: ${redactedLabel})`,
      ).toBe(false);
    } finally {
      await close();
    }
  });

  test("mobile viewport keeps Recent Work horizontally scrollable and usable @T77fd0222", async ({ browser }, testInfo) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { page, close } = await signInPopulatedOrg(browser);
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/app");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

      const shootList = page.getByTestId("command-center-shoot-list");
      await expect(shootList).toBeVisible();
      await expect(page.getByTestId("operator-chat-dock")).toBeVisible();
      await attachScreenshot(testInfo, "mobile-390x844-app-populated", page);

      // Real horizontal-scroll proof, not just visibility: fixed-width
      // tiles must overflow their row (command-center.module.css's
      // .recentScroll), and scrolling it must actually move the position.
      const { scrollWidth, clientWidth } = await shootList.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(scrollWidth, "Recent Work row must overflow to be horizontally scrollable").toBeGreaterThan(
        clientWidth,
      );

      const before = await shootList.evaluate((el) => el.scrollLeft);
      await shootList.evaluate((el) => el.scrollBy({ left: 200 }));
      await expect
        .poll(() => shootList.evaluate((el) => el.scrollLeft), {
          message: "scrolling the Recent Work row must move its scroll position",
        })
        .toBeGreaterThan(before);

      // Still usable after scrolling — a tile remains clickable and
      // navigates to its exact shoot.
      const tiles = shootList.locator('a[href^="/app/shoots/"]');
      const href = await tiles.first().getAttribute("href");
      expect(href).toMatch(/^\/app\/shoots\/[0-9a-f-]{36}$/);
      await tiles.first().click();
      await page.waitForURL(href!, { timeout: NAV_TIMEOUT_MS });
    } finally {
      await close();
    }
  });
});
