import type { MastraMemory } from "@mastra/core/memory";
import type { A2UIOperation } from "@copilotkit/shared";

import { getMastra } from "@/mastra/runtime";
import type { PlannerChatMessage, PlannerThreadRow } from "@/mastra/thread-types";

export type { PlannerChatMessage, PlannerThreadRow };

// IPI-1233 · PLAN-CARD-001 — the only tool whose historical call/result is
// preserved through reload today. Every other tool-invocation part still
// collapses to assistant text exactly like before this task; widen this set
// only when a later ticket adds another reload-surviving named renderer.
const RICH_HISTORY_TOOL_NAMES = new Set(["composeShootPlan"]);

const RUN_STORE_SEP = "\u001f";

export const THREAD_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lowercase UUID locators; opaque CopilotKit tokens pass through unchanged. */
export function canonicalizePlannerThreadId(threadId: unknown): string | null {
  if (typeof threadId !== "string" || !THREAD_ID.test(threadId)) return null;
  return threadId.toLowerCase();
}

function mastraThreadKey(threadId: string): string {
  return canonicalizePlannerThreadId(threadId) ?? threadId;
}

/** Canonical UUID plus the uppercase spelling used by pre-canonical Mastra rows. */
function mastraThreadLookupIds(threadId: string): string[] {
  const canonical = canonicalizePlannerThreadId(threadId);
  if (!canonical) return [threadId];
  const legacy = canonical.toUpperCase();
  return legacy === canonical ? [canonical] : [canonical, legacy];
}

export async function findMastraThread(
  memory: MastraMemory,
  threadId: string,
) {
  for (const id of mastraThreadLookupIds(threadId)) {
    const thread = await memory.getThreadById({ threadId: id });
    if (thread) return thread;
  }
  return null;
}

export function splitRunThreadIds(resourceId: string, clientThreadId: string) {
  const mastraThreadId = mastraThreadKey(clientThreadId);
  return {
    runnerThreadId: `${resourceId}${RUN_STORE_SEP}${mastraThreadId}`,
    mastraThreadId,
  };
}

export async function getPlannerMemory(): Promise<MastraMemory | undefined> {
  // Resolve through the registry (not a direct agent import) so `default` stays
  // the single source of truth for which agent instance the runtime uses.
  return getMastra().getAgent("default").getMemory();
}

export async function ensureMastraThread(
  memory: MastraMemory,
  input: { threadId: string; resourceId: string; title?: string },
): Promise<{ created: boolean }> {
  const threadId = mastraThreadKey(input.threadId);
  const existing = await findMastraThread(memory, input.threadId);
  if (existing) {
    if (existing.resourceId !== input.resourceId) {
      throw new Error("thread belongs to another resource");
    }
    return { created: false };
  }
  // IPI-1164: leave title unset unless the caller explicitly provides one.
  // Mastra's generateTitle only fires when `!thread.title` (verified in
  // @mastra/core's agent runtime) — persisting a placeholder here would
  // permanently block it for every planner thread. "Planner chat" is still
  // the display fallback for an untitled thread, in listMastraThreadsForResource.
  const title = input.title?.trim();
  await memory.createThread({
    threadId,
    resourceId: input.resourceId,
    ...(title ? { title } : {}),
  });
  return { created: true };
}

export async function listMastraThreadsForResource(
  memory: MastraMemory,
  resourceId: string,
): Promise<PlannerThreadRow[]> {
  const listed = await memory.listThreads({
    filter: { resourceId },
    perPage: false,
  });
  return listed.threads
    .filter((thread) => thread.resourceId === resourceId)
    .map((thread) => ({
      id: thread.id,
      title: thread.title?.trim() || "Planner chat",
      createdAt:
        thread.createdAt instanceof Date
          ? thread.createdAt.toISOString()
          : String(thread.createdAt),
      updatedAt:
        thread.updatedAt instanceof Date
          ? thread.updatedAt.toISOString()
          : String(thread.updatedAt),
    }));
}

export type PlannerGenUIActivity = {
  target: "planner-comparison";
  surfaceId: string;
  catalogId: string;
  operations: A2UIOperation[];
};

export type PlannerHistory = {
  messages: PlannerChatMessage[];
  genui: PlannerGenUIActivity | null;
};

const GENUI_TARGET = "planner-comparison";
const GENUI_CATALOG_ID = "ipix/planner@1";
const GENUI_MAX_OPERATIONS = 20;
const GENUI_MAX_SERIALIZED_BYTES = 64_000;

type HistoryToolInvocation = {
  type?: string;
  toolInvocation?: {
    state?: string;
    toolCallId?: string;
    toolName?: string;
    args?: unknown;
    result?: unknown;
  };
};

type HistoryMessage = {
  id?: string;
  role?: string;
  content?: {
    content?: unknown;
    parts?: Array<{ type?: string; text?: string } & HistoryToolInvocation>;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Extract only the last render_ui call the runtime itself marked rendered.
 *  The operations are already validated by GenerativeUIMiddleware before it
 *  emits the activity; this second pass enforces the bounded replay contract
 *  and rejects failed, partial, deleted or foreign-target history. */
export function extractPlannerGenUIActivity(
  messages: HistoryMessage[],
): PlannerGenUIActivity | null {
  let latest: PlannerGenUIActivity | null = null;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.content?.parts ?? []) {
      if (part.type !== "tool-invocation") continue;
      const invocation = part.toolInvocation;
      if (!invocation || invocation.state !== "result" || invocation.toolName !== "render_ui") continue;
      const args = asRecord(invocation.args);
      const result = asRecord(invocation.result);
      if (!args || !result) continue;
      if (args.target !== GENUI_TARGET) continue;
      if (result.status !== "rendered") continue;
      if (typeof result.applied !== "number" || result.applied <= 0) continue;
      if (!Array.isArray(result.rejected) || result.rejected.length > 0) continue;

      const operations = args.operations;
      if (!Array.isArray(operations) || operations.length === 0 || operations.length > GENUI_MAX_OPERATIONS) continue;
      let serialized: string;
      try {
        serialized = JSON.stringify(operations);
      } catch {
        continue;
      }
      if (serialized.length > GENUI_MAX_SERIALIZED_BYTES) continue;

      const ops = operations.filter((op): op is Record<string, unknown> => Boolean(op) && typeof op === "object" && !Array.isArray(op));
      if (ops.length !== operations.length) continue;
      if (!ops.every((op) => op.version === "1.0")) continue;
      if (ops.some((op) => "deleteSurface" in op)) {
        latest = null;
        continue;
      }
      const create = ops.find((op) => {
        const value = op.createSurface;
        return value && typeof value === "object" && !Array.isArray(value);
      })?.createSurface as Record<string, unknown> | undefined;
      if (!create) continue;
      if (typeof create.surfaceId !== "string" || create.surfaceId.length === 0) continue;
      if (create.catalogId !== GENUI_CATALOG_ID) continue;
      const hasRoot = ops.some((op) => {
        const update = op.updateComponents;
        if (!update || typeof update !== "object" || Array.isArray(update)) return false;
        const components = (update as Record<string, unknown>).components;
        return Array.isArray(components) && components.some((component) => {
          const value = component as Record<string, unknown> | null;
          return value?.id === "root" && value?.component === "ConceptComparison";
        });
      });
      if (!hasRoot) continue;
      latest = {
        target: GENUI_TARGET,
        surfaceId: create.surfaceId,
        catalogId: create.catalogId,
        operations: ops as unknown as A2UIOperation[],
      };
    }
  }
  return latest;
}

export async function recallPlannerHistory(
  memory: MastraMemory,
  input: { threadId: string; resourceId: string },
): Promise<PlannerHistory> {
  const thread = await findMastraThread(memory, input.threadId);
  if (!thread || thread.resourceId !== input.resourceId) {
    return { messages: [], genui: null };
  }
  const recalled = await memory.recall({
    threadId: thread.id,
    resourceId: input.resourceId,
    perPage: false,
  });
  const raw = (recalled.messages ?? []) as HistoryMessage[];
  return {
    messages: mastraMessagesToChat(raw),
    genui: extractPlannerGenUIActivity(raw),
  };
}

export async function recallPlannerChatMessages(
  memory: MastraMemory,
  input: { threadId: string; resourceId: string },
): Promise<PlannerChatMessage[]> {
  return (await recallPlannerHistory(memory, input)).messages;
}

/** A Mastra `tool-invocation` message part, duck-typed to the fields this
 *  module reads (see `@mastra/core`'s `MastraToolInvocationPart`/
 *  `LegacyToolInvocation`). Only a completed (`state: "result"`) invocation
 *  of a `RICH_HISTORY_TOOL_NAMES` tool is ever replayed — an in-flight or
 *  unrecognized tool-invocation part is dropped exactly like before this task. */
type ToolInvocationPart = {
  type?: string;
  toolInvocation?: {
    state?: string;
    toolCallId?: string;
    toolName?: string;
    args?: unknown;
    result?: unknown;
  };
};

/** `undefined`/unserializable → `"null"`, never a thrown error mid-conversion. */
function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null) ?? "null";
  } catch {
    return "null";
  }
}

/**
 * IPI-1339 · PLANNER-PAYLOAD-001 — a restored rich tool result can be JSON
 * *text that itself contains* JSON text: CopilotKit re-forwards the restored
 * transcript, `@ag-ui/mastra` treats the synthetic tool result as new history,
 * and Mastra persists it back. Because `safeJsonStringify` re-serializes
 * whatever it is given, each restore/replay cycle wrapped the previous string
 * in one more escaping layer until the message had grown geometrically
 * (measured: 14 layers, one 8,410,422-byte row, Vercel `413`
 * `FUNCTION_PAYLOAD_TOO_LARGE`).
 *
 * Unwrap those layers back to the single canonical serialization so the rich
 * history round trip is idempotent. Decoding only while the value still parses
 * as JSON text keeps a genuine object/array result serialized exactly once, and
 * the hard cap bounds the work on a pathological or hostile value. Past the cap
 * the deepest value reached is kept, which the plan-card renderer already shows
 * as an unreadable result instead of crashing — never a throw, never invented
 * data, and never a durable write.
 */
export const RICH_RESULT_DECODE_CAP = 20;

export function canonicalRichToolResult(value: unknown): string {
  let current: unknown = value;
  for (let depth = 0; depth < RICH_RESULT_DECODE_CAP; depth += 1) {
    if (typeof current !== "string") break;
    try {
      current = JSON.parse(current);
    } catch {
      break; // not JSON text — this string is the terminal value
    }
  }
  return safeJsonStringify(current);
}

function richToolInvocations(parts: ToolInvocationPart[] | undefined) {
  const found: Array<{ toolCallId: string; toolName: string; args: unknown; result: unknown }> = [];
  for (const part of parts ?? []) {
    if (part.type !== "tool-invocation") continue;
    const invocation = part.toolInvocation;
    if (!invocation || invocation.state !== "result") continue;
    if (typeof invocation.toolCallId !== "string" || typeof invocation.toolName !== "string") continue;
    if (!RICH_HISTORY_TOOL_NAMES.has(invocation.toolName)) continue;
    found.push({
      toolCallId: invocation.toolCallId,
      toolName: invocation.toolName,
      args: invocation.args,
      result: invocation.result,
    });
  }
  return found;
}

export function mastraMessagesToChat(
  messages: HistoryMessage[],
): PlannerChatMessage[] {
  const out: PlannerChatMessage[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const id = typeof message.id === "string" ? message.id : "";
    if (!id) continue;
    const direct =
      typeof message.content?.content === "string"
        ? message.content.content
        : "";
    const fromParts = (message.content?.parts ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    const content = direct.length > 0 ? direct : fromParts;

    if (message.role === "user") {
      out.push({ id, role: "user", content });
      continue;
    }

    const richCalls = richToolInvocations(message.content?.parts);
    if (richCalls.length === 0) {
      out.push({ id, role: "assistant", content });
      continue;
    }

    out.push({
      id,
      role: "assistant",
      content,
      toolCalls: richCalls.map((call) => ({
        id: call.toolCallId,
        type: "function",
        function: { name: call.toolName, arguments: safeJsonStringify(call.args) },
      })),
    });
    for (const call of richCalls) {
      out.push({
        id: `${id}:tool:${call.toolCallId}`,
        role: "tool",
        toolCallId: call.toolCallId,
        content: canonicalRichToolResult(call.result),
      });
    }
  }
  return out;
}
