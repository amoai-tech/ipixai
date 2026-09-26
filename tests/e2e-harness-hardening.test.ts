import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

vi.mock("../e2e/support/context", () => ({
  gotoPageWithRetry: vi.fn(async () => undefined),
}));

import { SIGN_IN_TIMEOUT_MS, signInWithCredentials } from "../e2e/support/login";
import { isAllowedE2EBaseUrl, previewBypassHeaders } from "../playwright.config";
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

  // IPI-1344 · E2E-PREVIEW-BYPASS-001: certifying a Preview against Vercel
  // Deployment Protection used to depend on single-use share links, which
  // silently stopped granting access and made journeys fail on an SSO screen.
  it("requires and sends the Vercel bypass secret for Preview runs, and never locally", () => {
    expect(previewBypassHeaders("http://localhost:3015", undefined)).toBeUndefined();
    expect(previewBypassHeaders("http://127.0.0.1:3015", "ignored-secret")).toBeUndefined();

    expect(() => previewBypassHeaders("https://ipixai-abc123-amoco.vercel.app", undefined)).toThrow(
      "VERCEL_AUTOMATION_BYPASS_SECRET is required for Vercel Preview E2E",
    );
    expect(() => previewBypassHeaders("https://ipixai-abc123-amoco.vercel.app", "")).toThrow(
      /VERCEL_AUTOMATION_BYPASS_SECRET is required/,
    );
    // A whitespace-only secret is truthy, so it must still fail closed here
    // rather than be sent and fail later at Vercel's SSO boundary.
    expect(() => previewBypassHeaders("https://ipixai-abc123-amoco.vercel.app", "   ")).toThrow(
      /VERCEL_AUTOMATION_BYPASS_SECRET is required/,
    );

    expect(previewBypassHeaders("https://ipixai-abc123-amoco.vercel.app", "the-secret")).toEqual({
      "x-vercel-protection-bypass": "the-secret",
      "x-vercel-set-bypass-cookie": "true",
    });
    // A padded secret is trimmed before it is sent.
    expect(previewBypassHeaders("https://ipixai-abc123-amoco.vercel.app", "  padded\n")).toEqual({
      "x-vercel-protection-bypass": "padded",
      "x-vercel-set-bypass-cookie": "true",
    });
  });

  it("never sets a context-wide extraHTTPHeaders for the bypass", () => {
    const config = readFileSync(path.resolve(process.cwd(), "playwright.config.ts"), "utf8");
    // Playwright's extraHTTPHeaders is global to the browser context: the bypass
    // secret would be attached to cross-origin calls to Supabase and Cloudinary,
    // leaking it and forcing a CORS preflight those services need not allow.
    // Measured against the installed Playwright, cross-origin fetch/img/script
    // requests all received the header. The bypass is scoped to the deployment
    // origin in e2e/auth.setup.ts instead.
    expect(config).not.toContain("extraHTTPHeaders:");
    expect(config).toContain("previewBypassHeaders(baseURL, process.env.VERCEL_AUTOMATION_BYPASS_SECRET)");

    const authSetup = readFileSync(path.resolve(process.cwd(), "e2e/auth.setup.ts"), "utf8");
    expect(authSetup).toContain("previewBypassHeaders(");
    expect(authSetup).toContain("setup.beforeEach(");
    // The header is added only on the deployment origin...
    expect(authSetup).toContain("context.route(");
    expect(authSetup).toContain("new URL(request.url()).origin !== deploymentOrigin");
    // ...and the cookie Vercel issues is asserted, because the other projects
    // carry only storageState and would otherwise die on an SSO screen.
    expect(authSetup).toContain("_vercel_jwt");
  });

  it("keeps the exact-SHA Preview workflow's journey run wired to the deployed artifact", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), ".github/workflows/vercel-preview.yml"),
      "utf8",
    );
    const job = workflowJob(source, "deploy");
    const journey = (job.steps ?? []).find((step) =>
      step.run?.includes("npx playwright test"),
    );
    expect(journey, "the exact-SHA Preview workflow must run the Planner journeys").toBeDefined();
    // The deployed artifact must be the target, and Deployment Protection must be
    // cleared by the existing secret rather than an unprotected preview.
    expect(journey?.env?.E2E_BASE_URL).toContain("steps.deploy.outputs.url");
    expect(journey?.env?.VERCEL_AUTOMATION_BYPASS_SECRET).toContain(
      "secrets.VERCEL_AUTOMATION_BYPASS_SECRET",
    );
    expect(journey?.run).toContain("e2e/planner-stop-journey.spec.ts");
    expect(journey?.run).toContain("e2e/planner-journey.spec.ts");
    // It must not silently widen to the writing brand-intelligence journey.
    // Assert on the spec path, not the bare name, so the workflow's own
    // explanatory comment cannot satisfy or break this check.
    expect(journey?.run).not.toContain("brand-intelligence-journey.spec.ts");
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

  it("pins the repo-local Playwright CLI to the skill-supported 0.1.21 release", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    expect(pkg.devDependencies["@playwright/cli"]).toBe("0.1.21");
  });

  it("provides a Chromium-only CLI attach debug command", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    const script = pkg.scripts["e2e:debug:cli"] as string | undefined;
    expect(script).toContain("PLAYWRIGHT_HTML_OPEN=never");
    expect(script).toContain("PLAYWRIGHT_BROWSERS_PATH=0");
    expect(script).toContain("--project=chromium");
    expect(script).toContain("--debug=cli");
    expect(script).not.toContain("--project=mobile-chromium");
    expect(script).not.toContain("chromium-ai-smoke");

    const attachScript = pkg.scripts["e2e:debug:cli:attach"] as string | undefined;
    expect(attachScript).toBe("playwright-cli attach");
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
