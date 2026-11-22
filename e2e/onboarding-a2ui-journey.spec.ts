import { expect, test, type Page } from "@playwright/test";
import { previewBypassHeaders } from "../playwright.config";
import { createCleanContext } from "./support/context";
import { signInWithCredentials } from "./support/login";
import { establishDeploymentAccess } from "./support/vercel-bypass";

/**
 * IPI-1462 · ONBOARD-A2UI-01 — real signed-in Screen 1 journey.
 *
 * Needs a deployment built with NEXT_PUBLIC_ONBOARDING_A2UI=1 and a QA founder
 * with ZERO organizations (E2E_ZERO_ORG_EMAIL / E2E_ZERO_ORG_PASSWORD). The
 * test never clicks Create Brand, so the account stays zero-org and reusable;
 * it only edits that account's own onboarding draft.
 */
const email = process.env.E2E_ZERO_ORG_EMAIL ?? "";
const password = process.env.E2E_ZERO_ORG_PASSWORD ?? "";

test.skip(!email || !password, "E2E_ZERO_ORG_EMAIL / E2E_ZERO_ORG_PASSWORD not set");

function trackCopilotKit(page: Page) {
  const calls: { method: string; path: string; status?: number }[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/copilotkit")) {
      calls.push({ method: response.request().method(), path: url.pathname, status: response.status() });
    }
  });
  return calls;
}

test("zero-org founder fills Screen 1 in a CopilotKit form, autosaves, survives refresh, no agent run", async ({
  browser,
  baseURL,
}) => {
  const context = await createCleanContext(browser);
  try {
    const page = await context.newPage();
    if (baseURL) {
      await establishDeploymentAccess({
        context,
        page,
        deploymentOrigin: new URL(baseURL).origin,
        headers: () => previewBypassHeaders(baseURL, process.env.VERCEL_AUTOMATION_BYPASS_SECRET),
      });
    }
    const copilotCalls = trackCopilotKit(page);
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
    });

    await signInWithCredentials(page, email, password, "/onboarding");

    // Real CopilotKit input (flag built in), not the native question.
    const name = page.getByLabel("Brand name (required)");
    await expect(name, "Preview must be built with NEXT_PUBLIC_ONBOARDING_A2UI=1").toBeVisible();
    await expect(page.locator("[data-a2ui-input]").first()).toBeVisible();

    const brand = `Maison Atelier QA ${Date.now()}`;
    await name.fill(brand);
    await page.getByLabel("Accessories").check();
    await page.getByLabel("Website (optional)").fill("https://maisonatelier.example");
    await page.getByLabel("Instagram handle or URL (optional)").fill("@maisonatelier");
    await expect(page.getByText("Draft saved.")).toBeVisible({ timeout: 10_000 });

    // Refresh: values must come back from Supabase, not memory.
    await page.reload();
    await expect(page.getByLabel("Brand name (required)")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByLabel("Brand name (required)")).toHaveValue(brand, { timeout: 15_000 });
    await expect(page.getByLabel("Accessories")).toBeChecked();
    await expect(page.getByLabel("Website (optional)")).toHaveValue("https://maisonatelier.example");
    await expect(page.getByLabel("Instagram handle or URL (optional)")).toHaveValue("@maisonatelier");

    // Browser-native URL validation stops Form.onSubmit before the host action.
    // Do not require an app-specific error when the browser has already blocked it.
    const websiteInput = page.getByLabel("Website (optional)");
    await websiteInput.fill("not a url");
    await page.getByRole("button", { name: "Continue" }).click();
    const invalidUrl = await websiteInput.evaluate((element: HTMLInputElement) => ({
      valid: element.validity.valid,
      validationMessage: element.validationMessage,
    }));
    expect(invalidUrl.valid).toBe(false);
    expect(invalidUrl.validationMessage).not.toBe("");
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await page.getByLabel("Website (optional)").fill("https://maisonatelier.example");

    // Continue → channels, Back → Screen 1 with values intact.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel("Brand name (required)")).toHaveValue(brand);

    // Keyboard editing proof. A separate Tab-only audit must test focus order.
    await page.getByLabel("Brand name (required)").focus();
    await page.keyboard.press("End");
    await page.keyboard.type("!");
    await expect(page.getByLabel("Brand name (required)")).toHaveValue(`${brand}!`);

    // No horizontal overflow at this viewport (mobile-chromium runs at 390px).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);

    // Only the agentless runtime probe reached /api/copilotkit, and it succeeded.
    expect(copilotCalls.length).toBeGreaterThan(0);
    for (const call of copilotCalls) {
      expect(call, JSON.stringify(call)).toMatchObject({ method: "GET", path: "/api/copilotkit/info", status: 200 });
    }
    expect(consoleErrors.filter((text) => /copilotkit|runtime_info/i.test(text))).toEqual([]);
  } finally {
    await context.close();
  }
});
