import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

import { contextForSavedRole } from "./support/login";
import { plannerThreadStorageKey } from "../src/mastra/thread-types";

const orgBFile = path.resolve(__dirname, "../playwright/.auth/org-b.json");

/** Reads the exact thread id /app's PlannerChatDock resolved and persisted
 *  for the currently authenticated resource — the same lookup
 *  e2e/planner-journey.spec.ts uses. This is the real conversation identity
 *  the operator is talking to, independent of whether it's a brand-new or a
 *  restored thread — /app has no "New" control, so a message can legitimately
 *  land on an existing thread (see IPI-1225 fix note below). */
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

/**
 * IPI-1191 · COPILOT-INTEL-001 — live proof that CopilotKit Intelligence
 * hosted threads are isolated by org+user, not just proven by the mocked
 * unit coverage in tests/intelligence-001.test.ts. That suite mocks
 * CopilotKitIntelligence.prototype.listThreads/ɵconnectThread; this spec
 * hits the real /api/copilotkit/threads and .../agent/default/connect
 * endpoints against the real hosted Intelligence project, through two real
 * signed-in Supabase sessions in separate orgs.
 *
 * Org B signs in with a raw password in this file; do not persist
 * secret-bearing artifacts.
 */
test.use({ trace: "off", screenshot: "off" });
test.setTimeout(90_000);
// Never retry: a retry re-sends the real, paid OpenAI request that creates
// Org A's thread (same reasoning as planner-journey.spec.ts).
test.describe.configure({ retries: 0 });

type IntelligenceThread = { id: string; name: string | null };

async function fetchIntelligenceThreads(page: Page): Promise<IntelligenceThread[]> {
  const response = await page.request.get("/api/copilotkit/threads?agentId=default");
  expect(response.status(), "GET /api/copilotkit/threads should succeed for a signed-in operator").toBe(
    200,
  );
  const body = (await response.json()) as { threads?: IntelligenceThread[] };
  return body.threads ?? [];
}

test(
  "org A vs org B: CopilotKit Intelligence threads remain tenant-isolated live",
  async ({ browser, page }) => {
    const runMarker = `intel-isolation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // IPI-1225 · PLANNER-ROUTE-RETIRE-001 — migrated from /planner (retired
    // to a compatibility redirect). /planner's own "New" button used to
    // guarantee a fresh thread here; /app has no such control (by design —
    // see operator-panel.tsx's usePlannerThreadBootstrap) and always restores
    // this resource's persisted thread. So this test no longer requires a
    // *new* thread to appear after sending — it identifies whichever thread
    // /app actually resolved (fresh or restored, via the same localStorage
    // lookup /app itself uses) and asserts isolation on that real identity.
    await page.goto("/app");
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: 30_000,
    });

    const textarea = page.getByTestId("copilot-chat-textarea");
    await textarea.click();
    await textarea.fill(`Reply with only the word "acknowledged". [${runMarker}]`);
    await page.getByTestId("copilot-send-button").click();

    // Real assistant reply proves the run actually reached the hosted
    // Intelligence project, not just the SSE fallback.
    await expect(page.getByTestId("copilot-assistant-message").last()).toBeVisible({
      timeout: 45_000,
    });

    const resolvedThreadId = await getStoredPlannerThreadId(page);
    expect(resolvedThreadId, "/app should have resolved and persisted a thread id by now").not.toBeNull();
    const orgAThreadId = resolvedThreadId!;

    // Org B: cached storageState from a separate session — never inherits
    // Org A's Supabase session (see contextForSavedRole).
    const { page: orgBPage, close: closeOrgB } = await contextForSavedRole(
      browser,
      orgBFile,
      "Missing playwright/.auth/org-b.json — set E2E_TEST_EMAIL_ORG_B / E2E_TEST_PASSWORD_ORG_B in .env.test",
    );
    try {
      const orgBThreads = await fetchIntelligenceThreads(orgBPage);
      expect(
        orgBThreads.some((thread) => thread.id === orgAThreadId),
        "tenant leak: Org B's thread listing includes Org A's Intelligence thread",
      ).toBe(false);

      // Direct connect attempt: Org B's session, Org A's threadId. Per
      // route.ts / intelligence-001.test.ts the server must key the connect
      // by the caller's own org+user resourceId, not the requested
      // threadId's owner — so this must not surface Org A's thread. Asserting
      // rejection generically (not a hard-coded status) since the real
      // hosted Intelligence platform's exact denial code isn't guaranteed by
      // installed @copilotkit/runtime source — only that it must not be a
      // 2xx success.
      const forbiddenConnect = await orgBPage.request.post(
        "/api/copilotkit/agent/default/connect",
        {
          data: {
            threadId: orgAThreadId,
            runId: `run-${orgAThreadId}`,
            state: {},
            messages: [],
            tools: [],
            context: [],
            forwardedProps: {},
          },
        },
      );
      expect(
        forbiddenConnect.ok(),
        `Org B must not successfully connect to Org A's Intelligence thread; status=${forbiddenConnect.status()}`,
      ).toBe(false);

      const orgBThreadsAfterConnect = await fetchIntelligenceThreads(orgBPage);
      expect(
        orgBThreadsAfterConnect.some((thread) => thread.id === orgAThreadId),
        "tenant leak: Org B connected to Org A's Intelligence thread",
      ).toBe(false);
    } finally {
      await closeOrgB();
    }

    // Org A can still reach its own thread after Org B's attempt.
    const orgAThreadsAgain = await fetchIntelligenceThreads(page);
    expect(
      orgAThreadsAgain.some((thread) => thread.id === orgAThreadId),
      "Org A lost access to its own Intelligence thread",
    ).toBe(true);
  },
);
