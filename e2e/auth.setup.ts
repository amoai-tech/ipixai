import path from "node:path";
import { test as setup } from "@playwright/test";

import { signInAsE2ETestOperator, signInWithCredentials } from "./support/login";

/**
 * https://playwright.dev/docs/auth — project-dependency auth setup.
 * Runs once, signs in through the real /login UI with the E2E test account,
 * and saves storageState for the chromium / mobile-chromium projects to
 * reuse via their `use.storageState`. No test signs in more than this once
 * (login-journey.spec.ts is the one deliberate exception — see its header).
 */
const authFile = path.resolve(__dirname, "../playwright/.auth/user.json");
const orgBFile = path.resolve(__dirname, "../playwright/.auth/org-b.json");
const shootsFile = path.resolve(__dirname, "../playwright/.auth/shoots.json");

// This file enters a raw password; never persist trace/screenshot artifacts.
setup.use({ trace: "off", screenshot: "off" });

// A clean Next/Turbopack worktree may spend most of Playwright's default 30s
// compiling /login and /app on the first authenticated request. Keep the
// wider budget scoped to this one setup test instead of masking slow tests
// across the whole suite.
setup.setTimeout(60_000);

setup("authenticate as the E2E test operator", async ({ page }) => {
  await signInAsE2ETestOperator(page);
  await page.context().storageState({ path: authFile });
});

// Org B and the populated Shoots account are secondary roles several specs
// need (tenant/copilot isolation, brands/shoots journeys, DASH-MAIN-002).
// Authenticating them once here — instead of each spec file signing in
// fresh via its own real UI login — cuts a full suite run from up to 9 real
// hosted Supabase logins down to 3. `test.skip` (not throw) when a role's
// credentials aren't set: this setup project must not fail for developers
// who only run specs that don't need that role. Every spec that does need
// it still fails closed on the missing storageState file (see
// contextForSavedRole in support/login.ts) — never a silent skip of the
// actual proof.
setup("authenticate as Org B (secondary tenant-isolation role)", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL_ORG_B;
  const password = process.env.E2E_TEST_PASSWORD_ORG_B;
  setup.skip(!email || !password, "E2E_TEST_EMAIL_ORG_B / E2E_TEST_PASSWORD_ORG_B not set");
  await signInWithCredentials(page, email!, password!);
  await page.context().storageState({ path: orgBFile });
});

setup("authenticate as the Shoots QA operator (populated org)", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL_SHOOTS;
  const password = process.env.E2E_TEST_PASSWORD_SHOOTS;
  setup.skip(!email || !password, "E2E_TEST_EMAIL_SHOOTS / E2E_TEST_PASSWORD_SHOOTS not set");
  await signInWithCredentials(page, email!, password!);
  await page.context().storageState({ path: shootsFile });
});
