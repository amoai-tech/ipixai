import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/**
 * IPI-1332 · CERT-PROD-001 / CI-ALERT-001 — guards for the two workflows added
 * on this branch, each locking in a review finding that was a configuration
 * assumption rather than a code defect.
 */

type WorkflowStep = {
  name?: string;
  id?: string;
  if?: string;
  "continue-on-error"?: boolean;
  run?: string;
  uses?: string;
  env?: Record<string, unknown>;
  with?: Record<string, unknown>;
};

type WorkflowJob = {
  if?: string;
  env?: Record<string, unknown>;
  steps?: WorkflowStep[];
};

function readWorkflow(relativePath: string) {
  const source = readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
  const workflow = (parse(source) ?? {}) as {
    env?: Record<string, string>;
    jobs?: Record<string, WorkflowJob>;
  };
  return { source, workflow };
}

function jobOf(workflow: { jobs?: Record<string, WorkflowJob> }, name: string): WorkflowJob {
  const job = workflow.jobs?.[name];
  if (!job) throw new Error(`workflow job "${name}" is missing`);
  return job;
}

function stepNamed(job: WorkflowJob, prefix: string): WorkflowStep {
  const step = (job.steps ?? []).find((candidate) => candidate.name?.startsWith(prefix));
  if (!step) throw new Error(`no step starting with "${prefix}"`);
  return step;
}

/**
 * Only the executable lines, so a comment that mentions a pattern cannot satisfy
 * a check. Backslash continuations are joined, so a command split over several
 * physical lines is asserted as the single command the shell actually runs —
 * otherwise only its first line carries the program name and the rest look like
 * unrelated lines.
 */
function commandLines(run: string | undefined): string[] {
  const lines = (run ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

  const joined: string[] = [];
  let pending: string | null = null;
  for (const line of lines) {
    const continues = line.endsWith("\\");
    const body = continues ? line.slice(0, -1).trim() : line;
    pending = pending === null ? body : `${pending} ${body}`;
    if (!continues) {
      joined.push(pending);
      pending = null;
    }
  }
  if (pending !== null) joined.push(pending);
  return joined;
}

const CERT_WORKFLOW = ".github/workflows/production-planner-cert.yml";
const ALERT_WORKFLOW = ".github/workflows/ai-smoke.yml";

describe("production Planner certification workflow", () => {
  it("uses required-reviewed Production credentials without generating a deployment record", () => {
    const { workflow } = readWorkflow(CERT_WORKFLOW);
    for (const name of ["verify", "logs"]) {
      const job = jobOf(workflow, name) as WorkflowJob & {
        environment?: { name: string; deployment: boolean };
      };
      expect(job.environment).toEqual({ name: "Production", deployment: false });
    }
    // Browser QA waits for the reviewed verification job, and never gets the
    // environment-scoped Vercel token itself.
    const certify = jobOf(workflow, "certify") as WorkflowJob & { needs?: string };
    expect(certify.needs).toBe("verify");
    expect(certify.steps?.some(step => JSON.stringify(step).includes("secrets.VERCEL_TOKEN"))).toBe(false);
  });

  it("runs the policy drift guard before Vercel credentials or paid model calls", () => {
    const { workflow } = readWorkflow(CERT_WORKFLOW);
    for (const name of ["verify", "logs"]) {
      const steps = jobOf(workflow, name).steps ?? [];
      const guardIndex = steps.findIndex(step => step.run?.includes("node scripts/check-production-environment.mjs"));
      const tokenIndex = steps.findIndex(step => JSON.stringify(step.env ?? {}).includes("secrets.VERCEL_TOKEN"));
      expect(guardIndex).toBeGreaterThanOrEqual(0);
      expect(tokenIndex).toBeGreaterThan(guardIndex);
      expect(steps[guardIndex].env?.GITHUB_TOKEN).toContain("secrets.GITHUB_TOKEN");
    }
  });

  it("keeps the Vercel token off runners executing released SHA npm scripts", () => {
    const { workflow } = readWorkflow(CERT_WORKFLOW);
    const verify = jobOf(workflow, "verify");
    const logs = jobOf(workflow, "logs");
    for (const job of [verify, logs]) {
      expect(job.steps?.some(step => commandLines(step.run).join("\n").includes("npm ci"))).toBe(false);
      const checkout = stepNamed(job, "Checkout trusted workflow revision");
      expect(checkout.with?.ref).toContain("github.sha");
      expect(checkout.with?.["persist-credentials"]).toBe(false);
    }
    const certify = jobOf(workflow, "certify");
    expect(stepNamed(certify, "Checkout the certified SHA").with?.ref).toContain("needs.verify.outputs.expected_sha");
    expect(stepNamed(certify, "Install dependencies").run).toContain("npm ci");
    expect(JSON.stringify(certify)).not.toContain("secrets.VERCEL_TOKEN");
  });

  it("validates the requested SHA and confirms it is already in main history", () => {
    const { workflow } = readWorkflow(CERT_WORKFLOW);
    const verify = jobOf(workflow, "verify");
    const request = stepNamed(verify, "Validate the request");
    expect(request.env?.EXPECTED_SHA).toContain("inputs.expected_sha");
    expect(commandLines(request.run).join("\n")).toContain("tr '[:upper:]' '[:lower:]'");
    expect(commandLines(stepNamed(verify, "Assert the SHA is a released commit").run).join("\n"))
      .toContain('git merge-base --is-ancestor "$EXPECTED_SHA" origin/main');
  });

  it("identifies the actual alias deployment by project and SHA, not the newest staged build", () => {
    const { workflow } = readWorkflow(CERT_WORKFLOW);
    const verify = jobOf(workflow, "verify");
    const step = stepNamed(verify, "Assert Production serves");
    expect(step.env?.VERCEL_PROJECT_ID).toContain("vars.VERCEL_PROJECT_ID");
    expect(step.env?.VERCEL_ORG_ID).toContain("vars.VERCEL_ORG_ID");
    const script = commandLines(step.run).join("\n");
    expect(script).toContain('vercel ls "$VERCEL_PROJECT_ID"');
    expect(script).toContain('deployments.find(d => d.url === alias.url)');
    expect(script).not.toContain("deployments[0]");
    // Live CLI check: vercel ls has no deployment id; vercel inspect does.
    expect(script).toContain("alias.id");
    expect(script).toContain('alias.readyState !== "READY"');
    for (const output of ["deployment_url", "deployment_sha", "deployment_id"]) {
      expect(script).toContain(output);
    }
  });

  it("serializes with CI's actual Production staging QA group, without cancelling active tests", () => {
    const { workflow: cert } = readWorkflow(CERT_WORKFLOW);
    const { workflow: ci } = readWorkflow(".github/workflows/ci.yml");
    const group = (cert as { concurrency?: { group?: string; "cancel-in-progress"?: boolean } }).concurrency;
    const ciGroup = (jobOf(ci, "vercel-production") as WorkflowJob & {
      concurrency?: { group?: string; "cancel-in-progress"?: boolean };
    }).concurrency;
    expect(group?.group).toBe("vercel-production");
    expect(group?.group).toBe(ciGroup?.group);
    expect(group?.["cancel-in-progress"]).toBe(false);
    expect(ciGroup?.["cancel-in-progress"]).toBe(false);
  });

  it("publishes only the bounded Planner trace, then reads it in a clean log runner", () => {
    const { workflow } = readWorkflow(CERT_WORKFLOW);
    const certify = jobOf(workflow, "certify");
    const logs = jobOf(workflow, "logs");
    expect(certify.env?.CERT_TRACE_FILE).toContain("planner-cert-trace.json");
    const upload = stepNamed(certify, "Upload bounded certification trace");
    expect(upload.uses).toContain("actions/upload-artifact@");
    expect(upload.if).toBe("always()");
    expect(upload.with?.path).toBe("test-results/planner-cert-trace.json");
    expect(upload.with?.["if-no-files-found"]).toBe("error");
    const download = stepNamed(logs, "Download certification thread identifiers");
    expect(download.uses).toContain("actions/download-artifact@");
    expect(download["continue-on-error"]).toBe(true);
    expect(download.with?.name).toBe(upload.with?.name);
    // Even if QA fails before writing a trace, a missing download must not
    // prevent the later alias recheck and bounded log query.
    const steps = logs.steps ?? [];
    expect(steps.indexOf(download)).toBeLessThan(steps.indexOf(stepNamed(logs, "Recheck alias")));
    expect(steps.indexOf(download)).toBeLessThan(steps.indexOf(stepNamed(logs, "Fetch bounded")));
    expect(logs.env?.CERT_TRACE_FILE).toContain("planner-cert-trace.json");
  });

  it("records the journey start before paid calls and fails closed on missing timestamps", () => {
    const { workflow } = readWorkflow(CERT_WORKFLOW);
    const certify = jobOf(workflow, "certify");
    const logs = jobOf(workflow, "logs");
    const journey = stepNamed(certify, "Run the signed-in");
    const commands = commandLines(journey.run).join("\n");
    expect(commands).toContain("started_at=");
    expect(commands.indexOf("started_at=")).toBeLessThan(commands.indexOf("e2e:production-cert"));
    expect(logs.env?.CERT_STARTED_AT).toContain("needs.certify.outputs.started_at");
    const query = commandLines(stepNamed(logs, "Fetch bounded immutable-deployment logs").run).join("\n");
    expect(query).toContain('if [ -z "${CERT_STARTED_AT:-}" ]');
    expect(query).toContain('--since "$CERT_STARTED_AT"');
    expect(query).toContain('--until');
    expect(query).toContain('--limit "$PROD_LOG_LIMIT"');
    expect(query).not.toContain("|| true");
  });

  it("rechecks the public alias, SHA and deployment ID after QA before claiming the live logs", () => {
    const { workflow } = readWorkflow(CERT_WORKFLOW);
    const logs = jobOf(workflow, "logs");
    const check = stepNamed(logs, "Recheck alias and deployment after");
    const run = commandLines(check.run).join("\n");
    expect(run).toContain("https://www.ipix.co");
    expect(run).toContain("process.env.DEPLOYMENT_URL");
    expect(run).toContain("process.env.EXPECTED_SHA");
    expect(run).toContain("process.env.DEPLOYMENT_ID");
    expect(run).toContain("alias.id !== process.env.DEPLOYMENT_ID");
    const logStep = stepNamed(logs, "Fetch bounded immutable-deployment logs");
    expect(logStep.run).toContain('vercel logs "$DEPLOYMENT_URL"');
    const parser = stepNamed(logs, "Assert no unexpected");
    expect(parser.run).toContain("node scripts/check-planner-production-logs.mjs");
    expect(parser.env).toBeUndefined();
    const summary = stepNamed(logs, "Certification summary");
    expect(summary.run).toContain("Deployed SHA");
    expect(summary.run).toContain("needs.verify.outputs.deployment_sha");
  });

  it("preserves explicit browser failure and makes logs run even if QA fails", () => {
    const { workflow } = readWorkflow(CERT_WORKFLOW);
    const logs = jobOf(workflow, "logs") as WorkflowJob & { needs?: string[] };
    expect(logs.needs).toEqual(["verify", "certify"]);
    expect(logs.if).toContain("always()");
    expect(logs.if).toContain("needs.verify.result == 'success'");
    expect(stepNamed(jobOf(workflow, "certify"), "Run the signed-in").run)
      .toContain("npm run e2e:production-cert");
  });
});

describe("ai-smoke repeated-failure alerting", () => {
  it("only alerts for scheduled runs whose predecessor also failed", () => {
    const { workflow } = readWorkflow(ALERT_WORKFLOW);
    const job = jobOf(workflow, "alert-on-repeat-failure");

    expect(job.if).toContain("failure()");
    expect(job.if).toContain("github.event_name == 'schedule'");
  });

  // Review finding: the check reads completed runs, and completed includes both
  // cancelled and skipped — so neither may be silently treated as a failure, and
  // neither may be silently ignored either.
  it("treats cancelled and skipped predecessors explicitly instead of as failures", () => {
    const { workflow } = readWorkflow(ALERT_WORKFLOW);
    const commands = commandLines(
      stepNamed(jobOf(workflow, "alert-on-repeat-failure"), "Open or update").run,
    ).join("\n");

    expect(commands).toContain("--status=completed");
    expect(commands).toContain('"$first" = "cancelled"');
    expect(commands).toContain('"$first" = "skipped"');
    // The cancelled/skipped branch must come before the failure gate, or those
    // conclusions would fall through to the generic "not a repeated failure" path.
    expect(commands.indexOf('"$first" = "cancelled"')).toBeLessThan(
      commands.indexOf('"$first" != "failure"'),
    );
  });
});
