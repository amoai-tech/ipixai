/**
 * IPI-1208 · PLANNER-TOOLGATE-001 — excludes consequential durable-write tools
 * from the model's toolset during planning-only turns.
 *
 * Design (cheapest reliable heuristic):
 * - Default: return only the 5 planning-only tools.
 * - Widen: include the two brand-intelligence tools when the conversation
 *   explicitly references brand draft/profile approval/rejection, brand
 *   analysis/start commands, OR a prior turn made a brand-intelligence tool
 *   call (so multi-turn follow-ups like "yes, approve it" still work).
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
 * Matches approval/rejection of a brand draft or profile:
 *   "approve the brand draft", "reject this profile", "decline the draft"
 * Does NOT match "approve the brand shoot plan" because the regex requires
 * `draft|profile` immediately (within 60 chars) after approve/reject/decline,
 * and "brand" can appear between them — but as soon as "shoot" or "plan"
 * appears after the verb, there is no match (no overlap with planning).
 *
 * The space-limited 60-char window between verb and noun prevents false
 * matches across paragraph-length descriptions.
 */
const BRAND_APPROVAL_PATTERN = /\b(approve|reject|decline)\b[\s\S]{0,60}\b(draft|profile)\b/i;

/**
 * Matches brand analysis start/review requests:
 *   "start a brand analysis", "analyze this brand", "run analysis",
 *   "review the brand draft", "what does the brand analysis look like"
 */
/**
 * Matches brand analysis/review requests:
 *   "analyze this brand", "review the brand", "brand analysis",
 *   "start a brand analysis", "run brand analysis"
 *
 * These all require "brand" within a reasonable window of the analysis verb,
 * so bare "analyze this dataset" stays planning-only.
 */
const BRAND_ANALYSIS_VERB_PATTERN = /\b(analyze|analysis|review)\b[\s\S]{0,60}\bbrand\b/i;
const BRAND_START_PATTERN = /\b(start|run|begin)\b[\s\S]{0,60}\bbrand\b/i;
const BRAND_INTELLIGENCE_PATTERN = /\bbrand intelligence\b/i;

/**
 * Attempts to extract the textual content from a message, supporting:
 * - plain string content (the most common AI SDK form)
 * - array of content parts (multi-modal: text, image, tool-call, etc.)
 * - falsy / missing content
 */
function extractMessageText(msg: MessageLike): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((part: any): boolean => typeof part?.text === "string")
      .map((part: any): string => part.text ?? "")
      .join(" ");
  }
  return "";
}

/**
 * Normalizes Mastra/AI-SDK message into a shape we can analyse.
 * Mastra stores tool calls under `toolCalls` (assistant) as `{ function: { name, arguments } }`,
 * but may also expose them under other keys. This helper covers the common shapes.
 */
function getToolCallNames(msg: MessageLike): string[] {
  const names: string[] = [];

  // Mastra's canonical toolCalls array: [{ function: { name: "..." } }]
  if (Array.isArray(msg.toolCalls)) {
    for (const tc of msg.toolCalls) {
      if (tc?.function?.name) names.push(tc.function.name);
    }
  }

  // AI SDK / AG-UI may pass tool_calls (snake_case) or a tools dict
  const tcAny = msg as any;
  if (Array.isArray(tcAny.tool_calls)) {
    for (const tc of tcAny.tool_calls) {
      const name = tc?.function?.name ?? (typeof tc?.name === "string" ? tc.name : "");
      if (name) names.push(name);
    }
  }

  return names;
}

export interface MessageLike {
  role: string;
  content?: string | Array<{ text?: string; type?: string; [k: string]: unknown }>;
  toolCalls?: Array<{ function?: { name?: string; arguments?: string } }>;
  [k: string]: unknown; // allow extra keys (tool_calls, tool_call_id, etc.)
}

/**
 * Returns true when the conversation history indicates a brand-intelligence
 * turn that should expose `approveDraft` and `startBrandAnalysis`.
 */
export function isBrandIntelligenceTurn(messages: MessageLike[]): boolean {
  for (const msg of messages) {
    const text = extractMessageText(msg);

    // Check user message against brand-intent patterns
    if (msg.role === "user") {
      if (BRAND_APPROVAL_PATTERN.test(text)) return true;
      if (BRAND_ANALYSIS_VERB_PATTERN.test(text)) return true;
      if (BRAND_START_PATTERN.test(text)) return true;
      if (BRAND_INTELLIGENCE_PATTERN.test(text)) return true;
    }

    // Check assistant messages for prior brand-intelligence tool calls
    if (msg.role === "assistant") {
      const names = getToolCallNames(msg);
      for (const name of names) {
        if ((CONSEQUENTIAL_WRITE_TOOLS as readonly string[]).includes(name)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Normalises a single Agent.stream() call's first argument into an array
 * of MessageLike, supporting:
 * - array of messages (the common case)
 * - single message object
 * - plain string
 */
export function normaliseToMessages(
  input: string | MessageLike | MessageLike[],
): MessageLike[] {
  if (Array.isArray(input) && input.length > 0 && typeof input[0] === "object") {
    return input as MessageLike[];
  }
  if (typeof input === "object" && input !== null && "role" in input) {
    return [input as MessageLike];
  }
  if (typeof input === "string" && input.length > 0) {
    return [{ role: "user", content: input }];
  }
  return [];
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
  if (defaultActiveTools) return defaultActiveTools;
  if (isBrandIntelligenceTurn(messages)) return [...ALL_AGENT_TOOLS];
  return [...PLANNING_ONLY_TOOLS];
}