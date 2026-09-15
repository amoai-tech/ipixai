/**
 * IPI-1208 · PLANNER-TOOLGATE-001 — excludes consequential durable-write tools
 * from the model's toolset during planning-only turns.
 *
 * Design (cheapest reliable heuristic):
 * - Default: return only the 5 planning-only tools.
 * - Widen: include the two brand-intelligence tools when the conversation
 *   explicitly references brand drafts/analysis (keyword pattern) OR a prior
 *   turn made a brand-intelligence tool call (so multi-turn follow-ups like
 *   "yes, approve it" still work).
 *
 * The brand-intelligence *consequential* write path (approveDraft) is also
 * served independently by the explicit server-action flow
 * (src/app/app/brands/[brandId]/actions.ts) which uses the Mastra tool
 * directly with the operator's confirmed draftHash — that path is gated
 * by explicit human button-click + draft-hash binding, not by this heuristic.
 *
 * This heuristic means the chat agent can never autonomously invoke a
 * durable write during a shoot-planning conversation.
 *
 * No LLM call is made for intent classification (per the task's requirement
 * to prefer the cheapest reliable heuristic).
 */

export const PLANNING_ONLY_TOOLS = [
  "recommendShootType",
  "planDeliverables",
  "generateShotListDraft",
  "estimateShootBudget",
  "composeShootPlan",
] as const;

export const CONSEQUENTIAL_WRITE_TOOLS = [
  "approveDraft",
  "startBrandAnalysis",
] as const;

export const ALL_AGENT_TOOLS = [
  ...PLANNING_ONLY_TOOLS,
  ...CONSEQUENTIAL_WRITE_TOOLS,
] as const;

/**
 * Pattern that detects a user message about brand-intelligence actions.
 *
 * Matches combinations of approve/reject/decline + draft/profile/brand
 * (e.g. "approve the brand draft", "reject this draft", "decline the profile",
 * "approve draft"). Not matched: "approve this shoot plan" (safe — plan
 * approval is not a brand-intelligence write).
 */
const BRAND_INTENT_PATTERN = /\b(approve|reject|decline)\b[\s\S]{0,60}\b(draft|profile|brand)\b/i;

export interface MessageLike {
  role: string;
  content?: string | unknown;
  toolCalls?: Array<{ function?: { name?: string } }>;
}

/**
 * Returns true when the conversation history indicates a brand-intelligence
 * turn that should expose `approveDraft` and `startBrandAnalysis`.
 */
export function isBrandIntelligenceTurn(messages: MessageLike[]): boolean {
  for (const msg of messages) {
    const text = typeof msg.content === "string" ? msg.content : "";
    if (msg.role === "user" && BRAND_INTENT_PATTERN.test(text)) {
      return true;
    }
    if (msg.role === "assistant" && Array.isArray(msg.toolCalls)) {
      for (const tc of msg.toolCalls) {
        const name = tc.function?.name ?? "";
        if ((CONSEQUENTIAL_WRITE_TOOLS as readonly string[]).includes(name)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Returns the set of tool names that should be active for this turn.
 *
 * Default (planning-only) unless a brand-intelligence signal is detected,
 * or the caller explicitly overrides via `defaultActiveTools`.
 */
export function resolveActiveTools(
  messages: MessageLike[],
  defaultActiveTools?: string[],
): string[] {
  // Caller override wins for tests / direct use
  if (defaultActiveTools) return defaultActiveTools;
  if (isBrandIntelligenceTurn(messages)) return [...ALL_AGENT_TOOLS];
  return [...PLANNING_ONLY_TOOLS];
}