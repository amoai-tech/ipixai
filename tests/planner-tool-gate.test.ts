/**
 * IPI-1208 · PLANNER-TOOLGATE-001 — tests for the intent-heuristic gate
 * that determines which tools the model can see.
 *
 * These are pure tests — no LLM, no network, no model credentials required.
 * The second test file (planner-tool-gate-registry.test.ts) covers the real
 * agent integration (that activeTools reaches the adapter's stream path).
 */

import { describe, expect, it } from "vitest";
import {
  isBrandIntelligenceTurn,
  resolveActiveTools,
  PLANNING_ONLY_TOOLS,
  CONSEQUENTIAL_WRITE_TOOLS,
  ALL_AGENT_TOOLS,
  type MessageLike,
} from "../src/mastra/planner-tool-gate";

const PLANNING_MSG: MessageLike = { role: "user", content: "Plan a shopify + instagram shoot for this collection" };
const BRAND_APPROVE_MSG: MessageLike = { role: "user", content: "Approve the brand draft please" };
const BRAND_REJECT_MSG: MessageLike = { role: "user", content: "Reject this profile" };
const BRAND_ANALYSIS_MSG: MessageLike = { role: "user", content: "What does the brand draft look like?" };
const AMBIGUOUS: MessageLike = { role: "user", content: "What tools do I have?" };
const SHOOT_APPROVE: MessageLike = { role: "user", content: "Approve this shoot plan" };

describe("isBrandIntelligenceTurn", () => {
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

  it("returns true when the conversation has a prior brand-intelligence tool call", () => {
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

  it("returns false for 'approve this shoot plan' (not brand)", () => {
    expect(isBrandIntelligenceTurn([SHOOT_APPROVE])).toBe(false);
  });

  it("returns false for ambiguous text without prior tool context", () => {
    expect(isBrandIntelligenceTurn([AMBIGUOUS])).toBe(false);
  });

  it("returns false when toolCalls is present but empty", () => {
    const msgs: MessageLike[] = [
      AMBIGUOUS,
      { role: "assistant", toolCalls: [] },
    ];
    expect(isBrandIntelligenceTurn(msgs)).toBe(false);
  });

  it("tolerates toolCalls entries without a function name", () => {
    const msgs: MessageLike[] = [
      { role: "assistant", toolCalls: [{ function: undefined }] },
    ];
    expect(isBrandIntelligenceTurn(msgs)).toBe(false);
  });
});

describe("resolveActiveTools", () => {
  it("returns planning-only tools by default", () => {
    expect(resolveActiveTools([PLANNING_MSG])).toEqual([...PLANNING_ONLY_TOOLS]);
  });

  it("returns all tools for brand-intelligence turns", () => {
    expect(resolveActiveTools([BRAND_APPROVE_MSG])).toEqual([...ALL_AGENT_TOOLS]);
  });

  it("honours an explicit defaultActiveTools override", () => {
    const custom = ["composeShootPlan"];
    expect(resolveActiveTools([BRAND_APPROVE_MSG], custom)).toEqual(custom);
  });

  it("returns only planning tools for 'approve this shoot plan'", () => {
    expect(resolveActiveTools([SHOOT_APPROVE])).toEqual([...PLANNING_ONLY_TOOLS]);
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