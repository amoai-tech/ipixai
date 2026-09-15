/**
 * IPI-1208 · PLANNER-TOOLGATE-001 — tests for the intent-heuristic gate
 * that determines which tools the model can see.
 *
 * These are pure tests — no LLM, no network, no model credentials required.
 */

import { describe, expect, it } from "vitest";
import {
  isBrandIntelligenceTurn,
  resolveActiveTools,
  normaliseToMessages,
  wrapPlannerStreamWithToolGate,
  wrapPlannerResumeStreamWithToolGate,
  PLANNING_ONLY_TOOLS,
  CONSEQUENTIAL_WRITE_TOOLS,
  ALL_AGENT_TOOLS,
  type MessageLike,
} from "../src/mastra/planner-tool-gate";

const PLANNING_MSG: MessageLike = { role: "user", content: "Plan a shopify + instagram shoot for this collection" };
const BRAND_APPROVE_MSG: MessageLike = { role: "user", content: "Approve the brand draft please" };
const BRAND_REJECT_MSG: MessageLike = { role: "user", content: "Reject this profile" };
const BRAND_ANALYSIS_MSG: MessageLike = { role: "user", content: "Start a brand analysis" };
const BRAND_ANALYSIS_LONG: MessageLike = { role: "user", content: "Can you analyze this brand for me?" };
const BRAND_REVIEW_MSG: MessageLike = { role: "user", content: "Review the brand draft" };
const AMBIGUOUS: MessageLike = { role: "user", content: "What tools do I have?" };
const SHOOT_APPROVE: MessageLike = { role: "user", content: "Approve this shoot plan" };
const BRAND_SHOOT_APPROVE: MessageLike = { role: "user", content: "Approve the brand shoot plan" };
const MULTIMODAL: MessageLike = {
  role: "user",
  content: [
    { type: "text", text: "Approve the brand draft please" },
    { type: "image", contentType: "image/png" as any, fileName: "ref.png" },
  ],
};
const MULTIMODAL_PLANNING: MessageLike = {
  role: "user",
  content: [
    { type: "text", text: "Plan a shopify shoot" },
    { type: "image", contentType: "image/png" as any, fileName: "ref.png" },
  ],
};

describe("isBrandIntelligenceTurn — approval/rejection patterns", () => {
  it("returns false for an empty message list", () => {
    expect(isBrandIntelligenceTurn([])).toBe(false);
  });

  it("returns false for a pure planning request", () => {
    expect(isBrandIntelligenceTurn([PLANNING_MSG])).toBe(false);
  });

  it("returns true for 'approve the brand draft'", () => {
    expect(isBrandIntelligenceTurn([BRAND_APPROVE_MSG])).toBe(true);
  });

  it("returns true for 'reject this profile'", () => {
    expect(isBrandIntelligenceTurn([BRAND_REJECT_MSG])).toBe(true);
  });

  it("returns true for 'review the brand draft' (analysis pattern)", () => {
    expect(isBrandIntelligenceTurn([BRAND_REVIEW_MSG])).toBe(true);
  });

  it("returns false for 'approve this shoot plan' (not brand)", () => {
    expect(isBrandIntelligenceTurn([SHOOT_APPROVE])).toBe(false);
  });

  it("returns false for 'approve the brand shoot plan' (brand + shoot = planning)", () => {
    // "brand" appears but the target noun is "plan" not "draft/profile" —
    // the regex requires `draft|profile` after approve/reject/decline.
    expect(isBrandIntelligenceTurn([BRAND_SHOOT_APPROVE])).toBe(false);
  });

  it("returns false for ambiguous text without prior tool context", () => {
    expect(isBrandIntelligenceTurn([AMBIGUOUS])).toBe(false);
  });

  it("returns false when toolCalls is present but empty", () => {
    expect(isBrandIntelligenceTurn([
      AMBIGUOUS,
      { role: "assistant", toolCalls: [] },
    ])).toBe(false);
  });

  it("tolerates toolCalls entries without a function name", () => {
    expect(isBrandIntelligenceTurn([
      { role: "assistant", toolCalls: [{ function: undefined }] },
    ])).toBe(false);
  });
});

describe("isBrandIntelligenceTurn — brand analysis patterns", () => {
  it("returns true for 'start a brand analysis'", () => {
    expect(isBrandIntelligenceTurn([BRAND_ANALYSIS_MSG])).toBe(true);
  });

  it("returns true for 'analyze this brand'", () => {
    expect(isBrandIntelligenceTurn([BRAND_ANALYSIS_LONG])).toBe(true);
  });

  it("returns true for 'brand intelligence' context phrase", () => {
    const msg: MessageLike = { role: "user", content: "Show brand intelligence results" };
    expect(isBrandIntelligenceTurn([msg])).toBe(true);
  });

  it("returns true for 'run analysis on the brand'", () => {
    const msg: MessageLike = { role: "user", content: "Run analysis on the brand please" };
    expect(isBrandIntelligenceTurn([msg])).toBe(true);
  });
});

describe("isBrandIntelligenceTurn — prior tool call detection", () => {
  it("returns true when the conversation has a prior startBrandAnalysis call", () => {
    const msgs: MessageLike[] = [
      AMBIGUOUS,
      { role: "assistant", toolCalls: [{ function: { name: "startBrandAnalysis" } }] },
    ];
    expect(isBrandIntelligenceTurn(msgs)).toBe(true);
  });

  it("returns true when the conversation has a prior approveDraft call", () => {
    const msgs: MessageLike[] = [
      AMBIGUOUS,
      { role: "assistant", toolCalls: [{ function: { name: "approveDraft" } }] },
      { role: "user", content: "yes, approve it" },
    ];
    expect(isBrandIntelligenceTurn(msgs)).toBe(true);
  });

  it("detects tool_calls in snake_case (AI SDK variant)", () => {
    const msgs: any[] = [
      AMBIGUOUS,
      {
        role: "assistant",
        tool_calls: [{ function: { name: "startBrandAnalysis" } }],
      },
    ];
    expect(isBrandIntelligenceTurn(msgs)).toBe(true);
  });

  it("detects AG-UI tool-call parts in assistant content", () => {
    const msgs: MessageLike[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "startBrandAnalysis",
            args: {},
          },
        ],
      },
      { role: "user", content: "yes, approve it" },
    ];
    expect(isBrandIntelligenceTurn(msgs)).toBe(true);
  });
});

describe("isBrandIntelligenceTurn — multi-modal content", () => {
  it("extracts text from structured content arrays: brand approval", () => {
    expect(isBrandIntelligenceTurn([MULTIMODAL])).toBe(true);
  });

  it("extracts text from structured content arrays: planning stays planning", () => {
    expect(isBrandIntelligenceTurn([MULTIMODAL_PLANNING])).toBe(false);
  });
});

describe("normaliseToMessages", () => {
  it("passes an array of messages through unchanged", () => {
    const msgs: MessageLike[] = [PLANNING_MSG];
    expect(normaliseToMessages(msgs)).toBe(msgs);
  });

  it("wraps a single message object in an array", () => {
    const result = normaliseToMessages(PLANNING_MSG);
    expect(result).toEqual([PLANNING_MSG]);
  });

  it("wraps a plain string in a user message", () => {
    const result = normaliseToMessages("Plan a shoot");
    expect(result).toEqual([{ role: "user", content: "Plan a shoot" }]);
  });

  it("returns empty array for null/undefined/empty-string input", () => {
    expect(normaliseToMessages("")).toEqual([]);
    expect(normaliseToMessages(null as any)).toEqual([]);
    expect(normaliseToMessages(undefined as any)).toEqual([]);
  });

  it("fails closed for null or malformed message arrays", () => {
    expect(normaliseToMessages([null] as unknown as MessageLike[])).toEqual([]);
    expect(
      normaliseToMessages([PLANNING_MSG, null] as unknown as MessageLike[]),
    ).toEqual([]);
    expect(
      normaliseToMessages([{ content: "missing role" }] as unknown as MessageLike[]),
    ).toEqual([]);
  });
});

describe("resolveActiveTools", () => {
  it("returns planning-only tools by default", () => {
    expect(resolveActiveTools([PLANNING_MSG])).toEqual([...PLANNING_ONLY_TOOLS]);
  });

  it("returns all tools for brand-intelligence turns (approval)", () => {
    expect(resolveActiveTools([BRAND_APPROVE_MSG])).toEqual([...ALL_AGENT_TOOLS]);
  });

  it("returns all tools for brand-intelligence turns (analysis)", () => {
    expect(resolveActiveTools([BRAND_ANALYSIS_MSG])).toEqual([...ALL_AGENT_TOOLS]);
  });

  it("honours an explicit defaultActiveTools override", () => {
    const custom = ["composeShootPlan"];
    expect(resolveActiveTools([BRAND_APPROVE_MSG], custom)).toEqual(custom);
  });

  it("returns only planning tools for 'approve this shoot plan'", () => {
    expect(resolveActiveTools([SHOOT_APPROVE])).toEqual([...PLANNING_ONLY_TOOLS]);
  });

  it("returns only planning tools for 'approve the brand shoot plan'", () => {
    expect(resolveActiveTools([BRAND_SHOOT_APPROVE])).toEqual([...PLANNING_ONLY_TOOLS]);
  });

  it("contains approveDraft and startBrandAnalysis in ALL_AGENT_TOOLS", () => {
    expect(ALL_AGENT_TOOLS).toContain("approveDraft");
    expect(ALL_AGENT_TOOLS).toContain("startBrandAnalysis");
  });

  it("PLANNING_ONLY_TOOLS does not contain write tools", () => {
    expect(PLANNING_ONLY_TOOLS).not.toContain("approveDraft");
    expect(PLANNING_ONLY_TOOLS).not.toContain("startBrandAnalysis");
  });
});

describe("typed runtime delegation wrappers", () => {
  it("stream preserves messages/options and injects planning-only activeTools", () => {
    const calls: unknown[][] = [];
    const original = (messages: unknown, options?: Record<string, unknown>) => {
      calls.push([messages, options]);
      return "stream-result";
    };
    const wrapped = wrapPlannerStreamWithToolGate(original);
    const messages = [{ role: "user", content: "Plan a shoot" }];

    expect(wrapped(messages, { requestId: "req-1" })).toBe("stream-result");
    expect(calls[0]?.[0]).toBe(messages);
    expect(calls[0]?.[1]).toMatchObject({
      requestId: "req-1",
      activeTools: [...PLANNING_ONLY_TOOLS],
    });
    expect(typeof (calls[0]?.[1] as Record<string, unknown>).prepareStep).toBe("function");
  });

  it("stream preserves an explicit activeTools override", () => {
    const calls: unknown[][] = [];
    const original = (messages: unknown, options?: Record<string, unknown>) => {
      calls.push([messages, options]);
      return "stream-result";
    };
    const wrapped = wrapPlannerStreamWithToolGate(original);
    const messages = [{ role: "user", content: "Plan a shoot" }];

    wrapped(messages, { activeTools: ["composeShootPlan"] });
    expect(calls[0]?.[1]).toMatchObject({ activeTools: ["composeShootPlan"] });
  });

  it("resumeStream preserves resumeData and injects tools only into streamOptions", () => {
    const calls: unknown[][] = [];
    const original = (resumeData: unknown, streamOptions: Record<string, unknown>) => {
      calls.push([resumeData, streamOptions]);
      return "resume-result";
    };
    const wrapped = wrapPlannerResumeStreamWithToolGate(original);
    const resumeData = { approved: true, nested: { value: 7 } };

    expect(wrapped(resumeData, { runId: "run-1" })).toBe("resume-result");
    expect(calls[0]?.[0]).toBe(resumeData);
    expect(calls[0]?.[1]).toMatchObject({ runId: "run-1" });
    expect(typeof (calls[0]?.[1] as Record<string, unknown>).prepareStep).toBe("function");
  });

  it("resumeStream preserves an explicit activeTools override", () => {
    const calls: unknown[][] = [];
    const original = (resumeData: unknown, streamOptions: Record<string, unknown>) => {
      calls.push([resumeData, streamOptions]);
      return "resume-result";
    };
    const wrapped = wrapPlannerResumeStreamWithToolGate(original);
    const resumeData = { approved: true };

    wrapped(resumeData, { activeTools: ["startBrandAnalysis"] });
    expect(calls[0]?.[0]).toBe(resumeData);
    expect(calls[0]?.[1]).toMatchObject({
      activeTools: ["startBrandAnalysis"],
    });
  });
});
