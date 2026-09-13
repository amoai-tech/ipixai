import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../e2e/support/context", () => ({
  gotoPageWithRetry: vi.fn(async () => undefined),
}));

import { SIGN_IN_TIMEOUT_MS, signInWithCredentials } from "../e2e/support/login";

function never<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

function timeoutError() {
  const error = new Error("page.waitForURL: Timeout 30000ms exceeded.");
  error.name = "TimeoutError";
  return error;
}
describe("Playwright E2E harness hardening", () => {
  it("reports a clear Supabase Auth timeout instead of a raw Playwright TimeoutError", async () => {
    const passwordFill = vi.fn(async () => undefined);
    const genericLocator = { fill: vi.fn(async () => undefined) };
    const signIn = {
      waitFor: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
    };
    const page = {
      url: () => "http://localhost:3015/login",
      getByRole: vi.fn((role: string) => (role === "button" ? signIn : genericLocator)),
      getByLabel: vi.fn(() => ({ fill: passwordFill })),
      waitForURL: vi.fn(() => Promise.reject(timeoutError())),
      waitForEvent: vi.fn(() => never()),
      waitForResponse: vi.fn(() => never()),
    };

    await expect(signInWithCredentials(page as never, "qa@example.com", "secret-password")).rejects.toThrow(
      `Sign-in timed out after ${SIGN_IN_TIMEOUT_MS}ms waiting for Supabase Auth`,
    );
    expect(passwordFill).toHaveBeenLastCalledWith("");
  });

  it("deletes stale secondary-role storageState before optional credential checks can skip", () => {
    const source = readFileSync(path.resolve(process.cwd(), "e2e/auth.setup.ts"), "utf8");
    expect(source).toContain('await rm(orgBFile, { force: true });');
    expect(source).toContain('await rm(shootsFile, { force: true });');
  });

  it("keeps UI, headed, and debug commands on deterministic browser projects", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    for (const script of ["e2e:ui", "e2e:headed", "e2e:debug"]) {
      expect(pkg.scripts[script]).toContain("--project=chromium");
      expect(pkg.scripts[script]).toContain("--project=mobile-chromium");
      expect(pkg.scripts[script]).not.toContain("chromium-ai-smoke");
    }
  });
});
