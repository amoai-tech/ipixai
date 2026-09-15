import { describe, expect, it } from "vitest";
import { RequestContext } from "@mastra/core/request-context";
import {
  ALL_AGENT_TOOLS,
  PLANNING_ONLY_TOOLS,
  wrapPlannerResumeStreamWithToolGate,
  wrapPlannerStreamWithToolGate,
} from "../src/mastra/planner-tool-gate";


function cloneRequestContext(source: RequestContext): RequestContext {
  const clone = new RequestContext();
  for (const [key, value] of Object.entries(source.toJSON())) {
    clone.setRaw(key, value);
  }
  return clone;
}

function getPrepareStep(call: unknown[]) {
  const options = call[1] as Record<string, unknown>;
  return options.prepareStep as (args: { requestContext?: RequestContext }) =>
    | Record<string, unknown>
    | Promise<Record<string, unknown>>;
}

describe("planner tool policy across resume", () => {
  it("persists brand policy for resumed execution", async () => {
    const streamCalls: unknown[][] = [];
    const stream = wrapPlannerStreamWithToolGate((messages: unknown, options?: Record<string, unknown>) => {
      streamCalls.push([messages, options]);
      return "stream-result";
    });
    const requestContext = new RequestContext();
    stream([{ role: "user", content: "Start a brand analysis" }], {
      requestContext,
      runId: "brand-run",
    });
    const persisted = cloneRequestContext(requestContext);
    const resumeCalls: unknown[][] = [];
    const resumeData = { approved: true, nested: { value: 7 } };
    const resume = wrapPlannerResumeStreamWithToolGate((data: unknown, options: Record<string, unknown>) => {
      resumeCalls.push([data, options]);
      return "resume-result";
    });

    resume(resumeData, { runId: "brand-run" });
    const result = await getPrepareStep(resumeCalls[0])({ requestContext: persisted });

    expect(resumeCalls[0]?.[0]).toBe(resumeData);
    expect(result.activeTools).toEqual([...ALL_AGENT_TOOLS]);
  });

  it("keeps planning policy planning-only after resume", async () => {
    const requestContext = new RequestContext();
    const stream = wrapPlannerStreamWithToolGate((_messages: unknown, _options?: Record<string, unknown>) => "ok");
    stream([{ role: "user", content: "Plan a campaign shoot" }], {
      requestContext,
      runId: "planning-run",
    });

    const persisted = cloneRequestContext(requestContext);
    const resumeCalls: unknown[][] = [];
    const resume = wrapPlannerResumeStreamWithToolGate((data: unknown, options: Record<string, unknown>) => {
      resumeCalls.push([data, options]);
      return "resume-result";
    });
    resume({ approved: true }, { runId: "planning-run" });
    const result = await getPrepareStep(resumeCalls[0])({ requestContext: persisted });

    expect(result.activeTools).toEqual([...PLANNING_ONLY_TOOLS]);
    expect(result.activeTools).not.toContain("approveDraft");
    expect(result.activeTools).not.toContain("startBrandAnalysis");
  });

  it("fails closed when resume has no persisted policy", async () => {
    const calls: unknown[][] = [];
    const resume = wrapPlannerResumeStreamWithToolGate((data: unknown, options: Record<string, unknown>) => {
      calls.push([data, options]);
      return "resume-result";
    });

    resume({ approved: true }, { runId: "unknown-run" });
    const result = await getPrepareStep(calls[0])({ requestContext: new RequestContext() });

    expect(result.activeTools).toEqual([...PLANNING_ONLY_TOOLS]);
  });

  it("preserves an explicit activeTools override on resume", async () => {
    const calls: unknown[][] = [];
    const resume = wrapPlannerResumeStreamWithToolGate((data: unknown, options: Record<string, unknown>) => {
      calls.push([data, options]);
      return "resume-result";
    });
    const requestContext = new RequestContext();

    resume({ approved: true }, {
      requestContext,
      runId: "override-run",
      activeTools: ["startBrandAnalysis"],
    });
    const result = await getPrepareStep(calls[0])({ requestContext });

    expect(result.activeTools).toEqual(["startBrandAnalysis"]);
    expect((calls[0]?.[1] as Record<string, unknown>).activeTools).toEqual([
      "startBrandAnalysis",
    ]);
  });
});
