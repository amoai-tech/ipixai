import { randomUUID } from "node:crypto";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

import { contextForSavedRole } from "./support/login";
import { plannerThreadStorageKey } from "../src/mastra/thread-types";

/**
 * IPI-1233 · PLAN-CARD-001 — deterministic browser proof for the structured
 * Production Plan Card.
 *
 * Fully deterministic: no model call. A completed `composeShootPlan` result
 * is seeded through the exact real Mastra/thread/history path (see
 * `seed-rich-history/route.ts`) — `ensureMastraThread` + `memory.saveMessages`,
 * the same calls production code uses — then read back through the real
 * `/api/planner/threads/:id/messages` → `mastraMessagesToChat` →
 * `RestoreMastraHistory` → `useRenderTool` path already proven by
 * `tests/thread-persistence.test.ts`'s unit coverage. This spec is the live
 * browser proof that the same wiring actually renders in `/app`.
 *
 * Runs in both the "chromium" (desktop) and "mobile-chromium" (~390px)
 * projects automatically (see responsive.spec.ts) — no per-test viewport
 * handling needed, and it belongs to the required `playwright-e2e` job
 * (deterministic suite), not `chromium-ai-smoke`.
 */
test.use({ trace: "off" });
test.setTimeout(90_000);

const orgBFile = path.resolve(__dirname, "../playwright/.auth/org-b.json");
const THREADS_API = "/api/planner/threads";
const RESTORE_TIMEOUT_MS = 30_000;

function buildSeedPlan(objectiveText: string, runMarker: string) {
  const assumption = {
    key: "budget",
    value: 1200,
    currency: "USD",
    source: "ipix_default_v1",
    assumed: true,
  };
  return {
    channels: ["shopify", "instagram_feed"],
    shootTypeResult: {
      status: "ok",
      missingInputs: [],
      assumptions: [],
      warnings: [],
      candidates: ["product"],
      shootType: "product",
      confidence: "high",
      rationale: `Deterministic Playwright seed [${runMarker}]`,
    },
    deliverablesResult: {
      status: "ok",
      missingInputs: [],
      assumptions: [assumption],
      warnings: [],
      totalAssets: 12,
      deliverables: [
        {
          channel: "shopify",
          format: "1:1 JPG white-bg",
          formatSource: "ipix_default_v1",
          quantity: 6,
          source: "ipix_default_v1",
          assumed: true,
        },
        {
          channel: "instagram_feed",
          format: "1:1 JPG",
          formatSource: "ipix_default_v1",
          quantity: 6,
          source: "ipix_default_v1",
          assumed: true,
        },
      ],
    },
    shotListResult: {
      status: "ok",
      missingInputs: [],
      assumptions: [],
      warnings: [],
      totalShots: 2,
      shots: [
        {
          shotNumber: 1,
          description: "Front PDP",
          angle: "front",
          lighting: "studio",
          deliverableIds: [],
          referenceId: "seed-r1",
        },
        {
          shotNumber: 2,
          description: "Detail",
          angle: "macro",
          lighting: "studio",
          deliverableIds: [],
          referenceId: "seed-r2",
        },
      ],
    },
    budgetResult: { status: "ok", missingInputs: [], assumptions: [], warnings: [] },
    objective: { status: "confirmed", value: objectiveText, source: "operator" },
    mediaType: { status: "needs_input" },
    location: { status: "needs_input" },
    lighting: { status: "needs_input" },
    setBackground: { status: "needs_input" },
    talent: { status: "needs_input" },
    crew: { status: "needs_input" },
    studio: { status: "needs_input" },
    equipment: { status: "needs_input" },
    schedule: { status: "needs_input" },
    campaignContext: { status: "needs_input" },
    risks: [],
    assumptions: [assumption],
    missingInputs: [],
    warnings: [],
    referencesUsed: [{ id: "seed-r1", angle: "front" }],
    status: "complete",
  };
}

async function seedRichHistory(page: Page, threadId: string, plan: unknown) {
  const response = await page.request.post(
    `${THREADS_API}/${encodeURIComponent(threadId)}/seed-rich-history`,
    { data: { plan } },
  );
  expect(
    response.ok(),
    `seed-rich-history should succeed: ${response.status()} ${await response.text().catch(() => "")}`,
  ).toBe(true);
}

async function assertCardRenders(page: Page, objectiveText: string) {
  await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
    timeout: RESTORE_TIMEOUT_MS,
  });
  const card = page.getByTestId("compose-shoot-plan-card");
  await expect(card).toBeVisible({ timeout: RESTORE_TIMEOUT_MS });
  await expect(card).toHaveAttribute("data-status", "complete");
  await expect(page.getByTestId("compose-shoot-plan-objective")).toHaveText(objectiveText);
  await expect(page.getByText("Deliverables (12 assets)")).toBeVisible();
  const assumptions = page.getByTestId("compose-shoot-plan-assumptions");
  await expect(assumptions).toBeVisible();
  await expect(assumptions).toContainText("budget");
  // Composer must remain usable alongside the rendered card.
  const textarea = page.getByTestId("copilot-chat-textarea");
  await expect(textarea).toBeVisible();
  await expect(textarea).toBeEditable();
}

test(
  "Production Plan Card: renders, survives reload, and stays tenant-isolated (no model call)",
  async ({ page, browser }) => {
    const threadId = randomUUID();
    const runMarker = `plan-card-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const objectiveText = `Launch-ready PDP + campaign imagery [${runMarker}]`;
    const plan = buildSeedPlan(objectiveText, runMarker);

    // ---- Resolve Org A's resourceId (cookies already loaded via storageState).
    const threadsResponse = await page.request.get(THREADS_API);
    expect(threadsResponse.ok(), "GET /api/planner/threads should succeed for Org A").toBe(true);
    const { resourceId } = (await threadsResponse.json()) as { resourceId: string };
    expect(resourceId).toBeTruthy();

    // ---- Seed a completed composeShootPlan result through the real Mastra
    // thread/history path — no model call.
    await seedRichHistory(page, threadId, plan);

    // ---- Point PlannerChatDock's bootstrap at this exact seeded thread
    // (same technique planner-thread-isolation.spec.ts uses) so the render
    // below is deterministic instead of depending on "most recently used".
    await page.goto("/app");
    const storageKey = plannerThreadStorageKey(resourceId);
    await page.evaluate(
      ([key, id]) => window.localStorage.setItem(key, id),
      [storageKey, threadId],
    );
    await page.reload();

    // ---- Render proof (desktop via "chromium" project, compact via
    // "mobile-chromium" — this same spec runs under both automatically).
    await assertCardRenders(page, objectiveText);

    // ---- Full reload restores the same structured card with the same values.
    await page.reload();
    await assertCardRenders(page, objectiveText);

    // ---- Org B cannot retrieve or render Org A's rich history.
    const { page: orgBPage, close: closeOrgB } = await contextForSavedRole(
      browser,
      orgBFile,
      "Missing playwright/.auth/org-b.json — set E2E_TEST_EMAIL_ORG_B / E2E_TEST_PASSWORD_ORG_B in .env.test",
    );
    try {
      // API-level denial, mirroring planner-thread-isolation.spec.ts's contract.
      const forbidden = await orgBPage.request.get(
        `${THREADS_API}/${encodeURIComponent(threadId)}/messages`,
      );
      expect(forbidden.status(), "Org B must be denied Org A's seeded thread").toBe(403);
      const forbiddenText = await forbidden.text();
      expect(
        forbiddenText.includes(runMarker),
        "tenant leak: Org A's objective content appeared in Org B's denial response",
      ).toBe(false);

      // Browser-level restore attempt: plant Org A's threadId into Org B's
      // own resource-scoped storage key and reload — the real-world
      // stale/foreign-bookmark attack the resolver exists to stop.
      await orgBPage.goto("/app");
      const orgBResponse = await orgBPage.request.get(THREADS_API);
      expect(orgBResponse.ok()).toBe(true);
      const { resourceId: orgBResourceId } = (await orgBResponse.json()) as { resourceId: string };
      expect(
        orgBResourceId,
        "Org A and Org B must resolve different resourceIds",
      ).not.toBe(resourceId);
      const orgBKey = plannerThreadStorageKey(orgBResourceId);
      await orgBPage.evaluate(
        ([key, id]) => window.localStorage.setItem(key, id),
        [orgBKey, threadId],
      );
      await orgBPage.reload();
      await expect(orgBPage.getByTestId("operator-chat-dock")).toBeVisible({
        timeout: RESTORE_TIMEOUT_MS,
      });

      // The UI must mint/keep a fresh thread rather than adopt Org A's.
      await expect
        .poll(
          async () =>
            orgBPage.evaluate((key) => window.localStorage.getItem(key), orgBKey),
          {
            timeout: RESTORE_TIMEOUT_MS,
            message: "Org B's UI should not persist Org A's threadId",
          },
        )
        .not.toBe(threadId);

      await expect(
        orgBPage.getByTestId("compose-shoot-plan-card"),
        "tenant leak: Org B rendered Org A's seeded Production Plan Card",
      ).toHaveCount(0);
      await expect(
        orgBPage.getByText(runMarker),
        "tenant leak: Org B rendered Org A's seeded objective text",
      ).toHaveCount(0);
    } finally {
      await closeOrgB();
    }

    // ---- Org A retains access after Org B's attempt.
    const orgAAfter = await page.request.get(
      `${THREADS_API}/${encodeURIComponent(threadId)}/messages`,
    );
    expect(orgAAfter.ok(), "Org A lost access to its own seeded thread").toBe(true);
  },
);
