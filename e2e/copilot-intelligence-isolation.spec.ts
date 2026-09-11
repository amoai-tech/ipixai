import { test, expect, type Page } from "@playwright/test";

import { signInIsolatedContext } from "./support/login";

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
    // Org A is the default authenticated `page` fixture (storageState from
    // auth.setup.ts, same account as every other chromium-project test).
    const before = await fetchIntelligenceThreads(page);

    const runMarker = `intel-isolation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/planner");
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole("status", { name: "Loading conversation…" })).toHaveCount(0, {
      timeout: 30_000,
    });

    // Guaranteed-fresh thread — don't reuse whatever this shared QA account
    // already has.
    await page.getByRole("button", { name: "New" }).click();

    const toggle = page.getByTestId("copilot-chat-toggle");
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }

    const textarea = page.getByTestId("copilot-chat-textarea");
    await textarea.click();
    await textarea.fill(`Reply with only the word "acknowledged". [${runMarker}]`);
    await page.getByTestId("copilot-send-button").click();

    // Real assistant reply proves the run actually reached the hosted
    // Intelligence project, not just the SSE fallback.
    await expect(page.getByTestId("copilot-assistant-message").last()).toBeVisible({
      timeout: 45_000,
    });

    const after = await fetchIntelligenceThreads(page);
    const orgAThread = after.find((thread) => !before.some((prior) => prior.id === thread.id));
    expect(
      orgAThread,
      `expected a new Intelligence thread after a real message; before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    ).toBeTruthy();
    const orgAThreadId = orgAThread!.id;

    // Org B: fresh, fully logged-out context — never inherits Org A's
    // Supabase session (see signInIsolatedContext).
    const { page: orgBPage, close: closeOrgB } = await signInIsolatedContext(
      browser,
      process.env.E2E_TEST_EMAIL_ORG_B,
      process.env.E2E_TEST_PASSWORD_ORG_B,
      "E2E_TEST_EMAIL_ORG_B / E2E_TEST_PASSWORD_ORG_B are missing — set them in .env.test",
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
      // threadId's owner — so this must not surface Org A's thread.
      await orgBPage.request.post("/api/copilotkit/agent/default/connect", {
        data: {
          threadId: orgAThreadId,
          runId: `run-${orgAThreadId}`,
          state: {},
          messages: [],
          tools: [],
          context: [],
          forwardedProps: {},
        },
      });

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
