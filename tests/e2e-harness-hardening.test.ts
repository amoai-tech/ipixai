import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

vi.mock("../e2e/support/context", () => ({
  gotoPageWithRetry: vi.fn(async () => undefined),
}));

import { SIGN_IN_TIMEOUT_MS, signInWithCredentials } from "../e2e/support/login";
import { isAllowedE2EBaseUrl } from "../playwright.config";
import { E2E_WEBSERVER_MARKER, plannerSeedRoutesEnabled } from "../src/lib/planner/seed-routes";


type WorkflowStep = {
  run?: string;
  uses?: string;
  env?: Record<string, unknown>;
};

type WorkflowJob = {
  steps?: WorkflowStep[];
};

function workflowJob(source: string, jobName: string): WorkflowJob {
  let workflow: { jobs?: Record<string, WorkflowJob> };
  try {
    workflow = (parse(source) ?? {}) as { jobs?: Record<string, WorkflowJob> };
  } catch (error) {
    throw new Error(`Failed to parse workflow YAML: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  const job = workflow.jobs?.[jobName];
  if (!job) throw new Error(`Workflow job "${jobName}" is missing`);
  return job;
}

function never<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

function timeoutError() {
  const error = new Error("page.waitForURL: Timeout 30000ms exceeded.");
  error.name = "TimeoutError";
  return error;
}
describe("Playwright E2E harness hardening", () => {
  it("allows current amoco iPix Vercel previews and rejects unsafe hosts", () => {
    expect(isAllowedE2EBaseUrl("https://ipixai-5y1wsa98w-amoco.vercel.app")).toBe(true);
    expect(isAllowedE2EBaseUrl("https://ipixai-amoco.vercel.app")).toBe(true);
    expect(isAllowedE2EBaseUrl("http://localhost:3015")).toBe(true);
    expect(isAllowedE2EBaseUrl("https://ipixai-5y1wsa98w-amo1000.vercel.app")).toBe(false);
    expect(isAllowedE2EBaseUrl("https://evil-amoco.vercel.app")).toBe(false);
    expect(isAllowedE2EBaseUrl("https://ipix.co")).toBe(false);
    expect(isAllowedE2EBaseUrl("http://ipixai-5y1wsa98w-amoco.vercel.app")).toBe(false);
  });

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

  it("runs the required e2e job against a production build with the seed-route opt-in wired end to end", () => {
    const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), "utf8");
    const ci = read(".github/workflows/ci.yml");
    const job = workflowJob(ci, "playwright-e2e");
    const steps = job.steps ?? [];
    // The job builds first, then runs the suite with the production-server switch and the opt-in.
    const build = steps.findIndex((step) => step.run?.trim() === "npm run build");
    const e2e = steps.findIndex((step) => step.run?.trim() === "npm run e2e");
    expect(build).toBeGreaterThan(-1);
    expect(e2e).toBeGreaterThan(build);
    const e2eStep = steps[e2e];
    expect(e2eStep?.env?.E2E_SERVER).toBe("production");
    expect(String(e2eStep?.env?.IPIX_E2E_SEED_ROUTES)).toBe("1");

    // The production server script exists and serves the same port as the dev server.
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["start:e2e"]).toContain("next start -p 3015");
    expect(pkg.scripts["dev:e2e"]).toContain("-p 3015");

    // Playwright starts that script and sets the exact marker the seed route checks.
    const config = read("playwright.config.ts");
    expect(config).toContain('process.env.E2E_SERVER === "production" ? "npm run start:e2e" : "npm run dev:e2e"');
    expect(config).toContain(`env: { ${E2E_WEBSERVER_MARKER.key}: "${E2E_WEBSERVER_MARKER.value}" }`);
    expect(
      plannerSeedRoutesEnabled({
        NODE_ENV: "production",
        IPIX_E2E_SEED_ROUTES: "1",
        [E2E_WEBSERVER_MARKER.key]: E2E_WEBSERVER_MARKER.value,
      }),
    ).toBe(true);
  });

  it("reads the playwright e2e job by YAML structure, regardless of job order or scalar quoting", () => {
    const ci = `jobs:
  playwright-approval-tenant:
    steps:
      - run: echo approval
  playwright-e2e:
    steps:
      - run: |
          npm run build
      - run: |
          npm run e2e
        env:
          E2E_SERVER: production
          IPIX_E2E_SEED_ROUTES: 1
`;
    const job = workflowJob(ci, "playwright-e2e");
    const e2eStep = job.steps?.find((step) => step.run?.trim() === "npm run e2e");

    expect(e2eStep?.env?.E2E_SERVER).toBe("production");
    expect(String(e2eStep?.env?.IPIX_E2E_SEED_ROUTES)).toBe("1");
  });

  it("reports a descriptive missing-job error for an empty workflow", () => {
    expect(() => workflowJob("", "playwright-e2e")).toThrow(
      'Workflow job "playwright-e2e" is missing',
    );
  });

  it("reports workflow context when YAML parsing fails", () => {
    expect(() => workflowJob("jobs:\n  playwright-e2e: [", "playwright-e2e")).toThrow(
      "Failed to parse workflow YAML",
    );
  });

  it("gives Playwright time to flush reports before the CI hard timeout", () => {
    const source = readFileSync(path.resolve(process.cwd(), "playwright.config.ts"), "utf8");
    expect(source).toContain("globalTimeout: process.env.CI ? 12 * 60_000 : undefined");
  });

  it("does not use networkidle to decide whether Recent Work previews are ready", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "e2e/dash-main-002-populated-command-center.spec.ts"),
      "utf8",
    );
    expect(source).not.toContain('waitForLoadState("networkidle")');
    expect(source).toContain("preview request or placeholder must settle");
  });

  it("keeps production-only smoke tests out of the deterministic chromium project", () => {
    const source = readFileSync(path.resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const start = source.indexOf('name: "chromium"');
    const end = source.indexOf('name: "chromium-ai-smoke"', start);
    const chromiumProject = source.slice(start, end);
    expect(chromiumProject).toContain('/production-smoke\\.spec\\.ts/');
  });

  it("keeps live AI monitoring in its own non-release workflow", () => {
    const ci = readFileSync(path.resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const aiSmoke = readFileSync(path.resolve(process.cwd(), ".github/workflows/ai-smoke.yml"), "utf8");
    expect(ci).not.toContain("  playwright-ai-smoke:");
    expect(aiSmoke).toContain("workflow_dispatch:");
    expect(aiSmoke).toContain("schedule:");
    expect(aiSmoke).toContain("timeout-minutes: 15");
    expect(aiSmoke).toContain("npm run e2e:ai-smoke");
  });

  it("does not upload authenticated Playwright reports from public CI", () => {
    const ci = readFileSync(path.resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const aiSmoke = readFileSync(path.resolve(process.cwd(), ".github/workflows/ai-smoke.yml"), "utf8");
    expect(ci).not.toContain("name: playwright-report");
    expect(aiSmoke).not.toContain("name: playwright-ai-smoke-report");
  });

  it("keeps Testomat reporting but does not publish authenticated Playwright artifacts", () => {
    const source = readFileSync(path.resolve(process.cwd(), ".github/workflows/testomatio.yml"), "utf8");
    const job = workflowJob(source, "playwright");
    const steps = job.steps ?? [];

    const reportStep = steps.find((step) => step.run?.includes("@testomatio/reporter@"));
    expect(reportStep).toBeDefined();
    expect(String(reportStep?.env?.TESTOMATIO_DISABLE_ARTIFACTS)).toBe("1");
    expect(steps.some((step) => step.uses?.startsWith("actions/upload-artifact@"))).toBe(false);
  });

  it("keeps live-AI planner smoke health-only instead of requiring composeShootPlan tool selection", () => {
    const source = readFileSync(path.resolve(process.cwd(), "e2e/planner-journey.spec.ts"), "utf8");
    expect(source).not.toContain('test("real agent reaches composeShootPlan');
    expect(source).not.toContain('getByTestId("compose-shoot-plan-card")');
  });

});
