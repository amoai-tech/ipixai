import { RequestContext } from "@mastra/core/request-context";

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
      .filter((part): part is MessageContentPart & { text: string } =>
        typeof part.text === "string",
      )
      .map((part) => part.text)
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
      if (tc.function?.name) names.push(tc.function.name);
    }
  }

  // AI SDK variants may pass tool_calls (snake_case).
  const toolCalls = msg.tool_calls;
  if (Array.isArray(toolCalls)) {
    for (const tc of toolCalls) {
      if (typeof tc !== "object" || tc === null) continue;
      const record = tc as Record<string, unknown>;
      const fn = record.function;
      const functionName =
        typeof fn === "object" && fn !== null && "name" in fn
          ? (fn as { name?: unknown }).name
          : undefined;
      const directName = record.name;
      const name =
        typeof functionName === "string"
          ? functionName
          : typeof directName === "string"
            ? directName
            : "";
      if (name) names.push(name);
    }
  }

  // @ag-ui/mastra converts prior assistant tool calls to content parts:
  // { type: "tool-call", toolCallId, toolName, args }.
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type !== "tool-call") continue;
      const name =
        typeof part.toolName === "string"
          ? part.toolName
          : typeof part.name === "string"
            ? part.name
            : "";
      if (name) names.push(name);
    }
  }

  return names;
}

export interface MessageContentPart {
  type?: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  name?: string;
  args?: unknown;
  [k: string]: unknown;
}

export interface MessageLike {
  role: string;
  content?: string | MessageContentPart[];
  toolCalls?: Array<{ function?: { name?: string; arguments?: string } }>;
  tool_calls?: unknown;
  [k: string]: unknown;
}

function isMessageLike(value: unknown): value is MessageLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    typeof (value as { role?: unknown }).role === "string"
  );
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
export function normaliseToMessages(input: unknown): MessageLike[] {
  if (Array.isArray(input)) {
    return input.length > 0 && input.every(isMessageLike)
      ? (input as MessageLike[])
      : [];
  }
  if (isMessageLike(input)) {
    return [input];
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

type Callable = (..._args: never[]) => unknown;

type PrepareStepArgsLike = {
  requestContext?: RequestContext;
  [key: string]: unknown;
};

type PrepareStepResultLike = {
  activeTools?: string[];
  [key: string]: unknown;
};
type PrepareStepLike = (
  args: PrepareStepArgsLike,
) =>
  | PrepareStepResultLike
  | undefined
  | void
  | Promise<PrepareStepResultLike | undefined | void>;

type ActiveToolsOptions = {
  activeTools?: string[];
  requestContext?: RequestContext;
  prepareStep?: PrepareStepLike;
  [key: string]: unknown;
};

const PLANNER_ACTIVE_TOOLS_CONTEXT_KEY = "ipix.planner.activeTools";
function normaliseToolOptions(value: unknown): ActiveToolsOptions {
  return typeof value === "object" && value !== null
    ? (value as ActiveToolsOptions)
    : {};
}

function readPersistedToolPolicy(requestContext?: RequestContext): string[] | undefined {
  const value = requestContext?.getRaw(PLANNER_ACTIVE_TOOLS_CONTEXT_KEY);
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function persistToolPolicy(requestContext: RequestContext, activeTools: string[]): void {
  requestContext.setRaw(PLANNER_ACTIVE_TOOLS_CONTEXT_KEY, [...activeTools]);
}

function buildPolicyPrepareStep(
  existingPrepareStep: PrepareStepLike | undefined,
  fallbackActiveTools: string[],
): PrepareStepLike {
  return async (args) => {
    const existingResult = await existingPrepareStep?.(args);
    const result =
      typeof existingResult === "object" && existingResult !== null
        ? existingResult
        : {};
    const activeTools =
      readPersistedToolPolicy(args.requestContext) ?? fallbackActiveTools;

    return { ...result, activeTools: [...activeTools] };
  };
}

/**
 * Wraps Agent.stream while preserving the original callable type. The wrapper
 * applies the tool policy now and stores it in Mastra RequestContext so a
 * suspended run can recover the same policy from its durable snapshot.
 */
export function wrapPlannerStreamWithToolGate<T extends Callable>(original: T): T {
  const wrapped = (...args: Parameters<T>): ReturnType<T> => {
    const messages = args[0] as unknown;
    const options = normaliseToolOptions(args[1]);
    const activeTools = resolveActiveTools(
      normaliseToMessages(messages),
      options.activeTools,
    );
    const requestContext = options.requestContext ?? new RequestContext();
    persistToolPolicy(requestContext, activeTools);
    const prepareStep = buildPolicyPrepareStep(options.prepareStep, activeTools);

    const forwarded = [
      messages,
      { ...options, requestContext, activeTools, prepareStep },
      ...args.slice(2),
    ] as unknown as Parameters<T>;
    return Reflect.apply(original, undefined, forwarded) as ReturnType<T>;
  };
  return wrapped as T;
}

/**
 * Wraps Agent.resumeStream(resumeData, streamOptions) while preserving the
 * resume payload exactly. Mastra restores the suspended run's persisted
 * RequestContext before prepareStep executes; that hook reapplies the original
 * tool policy. Missing policy fails closed to planning-only tools.
 */
export function wrapPlannerResumeStreamWithToolGate<T extends Callable>(
  original: T,
): T {
  const wrapped = (...args: Parameters<T>): ReturnType<T> => {
    const resumeData = args[0] as unknown;
    const streamOptions = normaliseToolOptions(args[1]);
    const fallbackActiveTools = streamOptions.activeTools ?? [
      ...PLANNING_ONLY_TOOLS,
    ];
    const requestContext = streamOptions.requestContext ?? new RequestContext();
    if (streamOptions.activeTools) {
      persistToolPolicy(requestContext, streamOptions.activeTools);
    }
    const prepareStep = buildPolicyPrepareStep(
      streamOptions.prepareStep,
      fallbackActiveTools,
    );

    const forwardedOptions = {
      ...streamOptions,
      requestContext,
      prepareStep,
      ...(streamOptions.activeTools
        ? { activeTools: streamOptions.activeTools }
        : {}),
    };
    const forwarded = [
      resumeData,
      forwardedOptions,
      ...args.slice(2),
    ] as unknown as Parameters<T>;
    return Reflect.apply(original, undefined, forwarded) as ReturnType<T>;
  };
  return wrapped as T;
}
