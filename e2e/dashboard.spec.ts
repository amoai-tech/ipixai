import { test, expect } from "@playwright/test";

import { getOwnOrgId, supabaseForPage } from "./support/tenant-supabase";

// Single source of truth for the cold-compile navigation timeout used below
// (was duplicated per-assertion) — see PR #73/#74. NAV_TIMEOUT_MS matches
// the toHaveURL wait; TEST_TIMEOUT_MS gives that same test's *overall*
// per-test budget (Playwright's default is 30s) enough headroom that the
// preceding goto()/click() doesn't eat into the assertion's own window.
const NAV_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = NAV_TIMEOUT_MS + 15_000;

// PR #52 (IPI-1066) merged — /app is the real Command Center now, not the
// pre-merge placeholder. These assertions run for real.
test.describe("dashboard (authenticated)", () => {
  test("loads /app without console or page errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    expect(errors, `console/page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("shows the honest empty state for the QA test org (0 brands)", async ({ page }) => {
    // The E2E account's org ("QA iPix Isolation A") has 0 brands by design —
    // this is real live state, not a fixture, so the empty state is the
    // deterministic expected outcome, not a fake "No data" placeholder.
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "No brands yet" })).toBeVisible();
  });

  test("quick links have distinct accessible names and correct destinations", async ({ page }) => {
    await page.goto("/app");

    const brands = page.getByRole("link", { name: "Open Brands" });
    const shoots = page.getByRole("link", { name: "Open Shoots" });
    const plans = page.getByRole("link", { name: "Open Plans" });

    await expect(brands).toHaveAttribute("href", "/app/brands");
    await expect(shoots).toHaveAttribute("href", "/app/shoots");
    await expect(plans).toHaveAttribute("href", "/app/plans");
  });

  // Every toHaveURL below that follows a link click (not a goto) waits
  // NAV_TIMEOUT_MS, not the 5s expect() default: each is a client-side
  // navigation to a not-yet-compiled /app/* route on a fresh checkout, and
  // Next dev compiles a route on demand on first hit — the same cold-compile
  // cost support/login.ts's /app redirect wait was widened for (PR #73).
  // Reproduced locally against a genuinely cold .next for every route in
  // this file, not just the one that happened to flake in CI, so all of
  // them are widened. Each such test also raises its own test.setTimeout so
  // the preceding goto()/click() can't eat into that assertion's budget —
  // Playwright's default 30s per-test timeout would otherwise still be able
  // to abort the test before a full NAV_TIMEOUT_MS assertion wait completes.
  test("Brands quick link navigates to /app/brands", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app");
    await page.getByRole("link", { name: "Open Brands" }).click();
    await expect(page).toHaveURL(/\/app\/brands$/, { timeout: NAV_TIMEOUT_MS });
  });

  test("Shoots quick link navigates to /app/shoots", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app");
    await page.getByRole("link", { name: "Open Shoots" }).click();
    await expect(page).toHaveURL(/\/app\/shoots$/, { timeout: NAV_TIMEOUT_MS });
  });

  test("Plans quick link navigates to /app/plans", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app");
    await page.getByRole("link", { name: "Open Plans" }).click();
    await expect(page).toHaveURL(/\/app\/plans$/, { timeout: NAV_TIMEOUT_MS });
  });

  // PR #66 additions below — the QA E2E account's org has 0 brands by
  // design (see the empty-state test above), so these prove the real,
  // live integration for what that account's actual data can exercise:
  // the chat dock, the capability-gated chip, "View all", and the
  // shell/scroll layout the dock introduced. They do not (and cannot,
  // without seeded multi-brand/multi-shoot data) prove the hero's
  // cross-brand exclusion — that's covered at the component-test level
  // (command-center.test.tsx: "never references another brand's shoot in
  // the hero subline") and recorded as a known e2e coverage gap.

  test("hero card does not render for the QA org's real 0-brand state", async ({ page }) => {
    // Deterministic, not assumed: confirm this session resolves to exactly
    // one real organization and that organization's brands really are 0
    // right now (read-only, RLS-enforced) before asserting on it — a
    // drifted QA account would otherwise fail with a confusing "No brands
    // yet" heading-not-found instead of a clear brand-count mismatch.
    const orgId = await getOwnOrgId(page);
    const supabase = await supabaseForPage(page);
    const { count, error } = await supabase
      .from("brands")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);
    expect(error, `brands count read failed: ${error?.message ?? "unknown"}`).toBeNull();
    expect(
      count,
      "expected the QA org to have 0 brands — this is the deterministic precondition for the hero-absence proof below",
    ).toBe(0);

    // Real conditional-render proof, not mocked: heroBrand is undefined
    // when brandsResult.brands is empty, so <HeroCard> must not render at
    // all — same account/org as the "No brands yet" empty-state test.
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "No brands yet" })).toBeVisible();
    await expect(page.getByTestId("command-center-hero")).toHaveCount(0);
  });

  test("persistent chat dock is visible on /app and stays capability-honest", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByTestId("operator-chat-dock")).toBeVisible();
    // No fabricated actions — real capability gate (quick-action-chips.tsx),
    // asserted live, not just in the mocked component test.
    await expect(page.getByText("Generate deliverables")).toHaveCount(0);
    await expect(page.getByText("Review approvals")).toHaveCount(0);
  });

  // IPI-1149 · DASH-MAIN-002 — portfolio-aware chat welcome + Intelligence
  // rail Overview, proven live against the same real 0-brand QA org as the
  // empty-state test above (no seeded populated org exists for this e2e
  // account — see PR description for that separately-tracked gap). The
  // rail itself (operator-panel.module.css .rail{display:none} below the
  // mobile breakpoint — pre-existing, not introduced by this PR) only
  // renders on desktop, same reasoning marketing-nav.spec.ts already uses
  // for its own desktop-only nav — so its visibility assertions are
  // desktop-scoped; the chat welcome copy isn't rail-gated and is checked
  // on every project.
  test("chat welcome stays honest for the QA org's real 0-brand state", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "No brands yet" })).toBeVisible();
    await expect(page.getByText("Start by creating a brand or planning your first shoot.")).toBeVisible();
  });

  test("Intelligence rail stays honest for the QA org's real 0-brand state", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "rail is desktop-only (operator-panel.module.css)");
    await page.goto("/app");
    const rail = page.getByTestId("intelligence-rail");
    await expect(rail.getByText("0 brands · 0 shoots in this workspace.")).toBeVisible();
    // No fabricated brand context, recent-production line, or
    // Approvals/Activity — real signal only.
    await expect(rail.getByTestId("intelligence-brand-context")).toHaveCount(0);
    await expect(rail.getByTestId("intelligence-recent-shoot")).toHaveCount(0);
    await expect(rail.getByText(/approval/i)).toHaveCount(0);
    await expect(rail.getByText(/activity/i)).toHaveCount(0);
  });

  test("Plan a shoot chip navigates to /app/plans", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app");
    await page.getByRole("link", { name: "Plan a shoot" }).click();
    await expect(page).toHaveURL(/\/app\/plans$/, { timeout: NAV_TIMEOUT_MS });
  });

  test("View all navigates to /app/shoots", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    await page.goto("/app");
    await page.getByRole("link", { name: "View all" }).click();
    await expect(page).toHaveURL(/\/app\/shoots$/, { timeout: NAV_TIMEOUT_MS });
  });

  test("scrolling the workspace does not detach the chat dock or block quick-link clicks", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    // Regression guard for the exact risk PR #66 called out: before its
    // shell height:100dvh fix, the whole page grew to fit content instead
    // of the dock pinning with independent scroll, and Quick Link clicks
    // silently stopped registering as navigation. Scrolling into view of
    // a landmark deep in the main content exercises that inner scroll
    // region; the dock and a nav link must both remain live afterward.
    await page.goto("/app");
    await page.getByRole("heading", { name: "Quick links" }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("operator-chat-dock")).toBeVisible();
    await page.getByRole("link", { name: "Open Brands" }).click();
    await expect(page).toHaveURL(/\/app\/brands$/, { timeout: NAV_TIMEOUT_MS });
  });

  test("a short viewport keeps both dashboard content and the chat dock reachable", async ({
    page,
  }) => {
    // Mobile landscape-ish height, not just mobile-chromium's 390x844
    // portrait — the dock's height:min(320px,40dvh) fix specifically
    // targets short viewports, so prove it at one.
    await page.setViewportSize({ width: 390, height: 500 });
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByTestId("operator-chat-dock")).toBeVisible();
    // Both surfaces reachable, not just present: scroll to a deep main-
    // content landmark, then confirm the dock is still there afterward.
    await page.getByRole("heading", { name: "Quick links" }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("operator-chat-dock")).toBeVisible();
  });
});
