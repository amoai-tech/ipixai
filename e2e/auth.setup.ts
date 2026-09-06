import path from "node:path";
import { test as setup } from "@playwright/test";

import { signInAsE2ETestOperator } from "./support/login";

/**
 * https://playwright.dev/docs/auth — project-dependency auth setup.
 * Runs once, signs in through the real /login UI with the E2E test account,
 * and saves storageState for the chromium / mobile-chromium projects to
 * reuse via their `use.storageState`. No test signs in more than this once
 * (login-journey.spec.ts is the one deliberate exception — see its header).
 */
const authFile = path.resolve(__dirname, "../playwright/.auth/user.json");

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
