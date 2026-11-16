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
  /** A locator, NOT authorization; the resourceId and thread owner are checked server-side. */
  scopeKey?: string;
  target: "planner-comparison";
  surfaceId: string;
  catalogId: string;
  operations: A2UIOperation[];
};

export type PlannerHistory = {
  messages: PlannerChatMessage[];
  genui: PlannerGenUIActivity | null;
  genuiRecovery?: boolean;
};

const GENUI_TARGET = "planner-comparison";
const GENUI_CATALOG_ID = "ipix/planner@1";
const GENUI_MAX_OPERATIONS = 20;
const GENUI_MAX_SERIALIZED_BYTES = 64_000;

type HistoryMessage = {
  id?: string;
  role?: string;
  content?: {
    content?: unknown;
    parts?: Array<{ type?: string; text?: string } & ToolInvocationPart>;
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

/** Validate the replay contract shared by message history and persisted
 *  metadata: planner target, known catalog, bounded 1.0 operations, a
 *  ConceptComparison root, and no delete/failed content. */
export function normalizePlannerGenUIActivity(
  value: unknown,
): PlannerGenUIActivity | null {
  const row = asRecord(value);
  if (!row || row.target !== GENUI_TARGET) return null;
  const operations = row.operations;
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > GENUI_MAX_OPERATIONS) return null;
  let serialized: string;
  try {
    serialized = JSON.stringify(operations);
  } catch {
    return null;
  }
  if (serialized.length > GENUI_MAX_SERIALIZED_BYTES) return null;
  const ops = operations.filter((op): op is Record<string, unknown> => Boolean(op) && typeof op === "object" && !Array.isArray(op));
  if (ops.length !== operations.length) return null;
  if (!ops.every((op) => op.version === "1.0")) return null;
  const creates = ops.filter((op) => op.createSurface !== undefined);
  if (creates.length !== 1) return null;
  const create = asRecord(creates[0]!.createSurface);
  if (!create || typeof create.surfaceId !== "string" || !create.surfaceId) return null;
  if (create.catalogId !== GENUI_CATALOG_ID) return null;
  const selected: Record<string, unknown>[] = [];
  for (const op of ops) {
    const del = op.deleteSurface === undefined ? null : asRecord(op.deleteSurface);
    if (del) {
      if (typeof del.surfaceId !== "string") return null;
      // A cleanup delete for an older surface cannot delete the current card;
      // it also should not be re-applied when rebuilding a fresh manager.
      if (del.surfaceId === create.surfaceId) return null;
      continue;
    }
    if (op.createSurface !== undefined) {
      if (!asRecord(op.createSurface)) return null;
    } else {
      const update = asRecord(op.updateComponents ?? op.updateDataModel);
      // Every appended update must target the single surface being restored.
      if (!update || update.surfaceId !== create.surfaceId) return null;
    }
    selected.push(op);
  }
  const hasRoot = selected.some((op) => {
    const update = asRecord(op.updateComponents);
    if (!update) return false;
    const components = update.components;
    return Array.isArray(components) && components.some((component) => {
      const c = asRecord(component);
      return c?.id === "root" && c?.component === "ConceptComparison";
    });
  });
  if (!hasRoot) return null;
  return {
    ...(typeof row.scopeKey === "string" ? { scopeKey: row.scopeKey } : {}),
    target: GENUI_TARGET,
    surfaceId: create.surfaceId,
    catalogId: create.catalogId,
    operations: selected as unknown as A2UIOperation[],
  };
}

const GENUI_METADATA_KEY = "ipixGenUI";

/** Persist only a server-validated, final accepted activity in the existing
 *  thread metadata. Ownership/resource are checked here, not trusted from the
 *  browser. A null activity records a deletion marker so an older message
 *  cannot resurrect a deleted card. */
/** Save one verified surface per Planner thread. A delta-only update must
 * build on an already persisted, same-scope surface: it cannot invent a new
 * card or cause a different Brand's card to appear after reload. */
export async function savePlannerGenUIActivity(
  memory: MastraMemory,
  input: { threadId: string; resourceId: string; scopeKey?: string } & (
    | { activity: PlannerGenUIActivity | null; surfaceId?: string; reason?: "rejected" | "delete" }
    | { update: { surfaceId: string; operations: A2UIOperation[] } }
  ),
): Promise<boolean> {
  const thread = await findMastraThread(memory, input.threadId);
  if (!thread || thread.resourceId !== input.resourceId) return false;
  const existing = thread.metadata && typeof thread.metadata === "object"
    ? thread.metadata
    : {};
  const previous = normalizePlannerGenUIActivity(existing[GENUI_METADATA_KEY]);
  const scopeKey = input.scopeKey ?? "workspace";
  let stored: PlannerGenUIActivity | {
    deleted: true;
    scopeKey: string;
    reason: "rejected" | "delete";
  };
  if ("update" in input) {
    if (!previous || previous.scopeKey !== scopeKey ||
      previous.surfaceId !== input.update.surfaceId ||
      input.update.operations.length === 0) return false;
    // A replayed duplicate delta must not keep appending the same operations.
    const tail = previous.operations.slice(-input.update.operations.length);
    const identical = JSON.stringify(tail) === JSON.stringify(input.update.operations);
    const merged = identical ? previous.operations :
      [...previous.operations, ...input.update.operations];
    stored = normalizePlannerGenUIActivity({
      ...previous,
      operations: merged,
    }) ?? { deleted: true, scopeKey, reason: "rejected" };
  } else if (input.activity) {
    const validated = normalizePlannerGenUIActivity({
      ...input.activity,
      scopeKey,
    });
    if (!validated) return false;
    stored = validated;
  } else {
    // A late delete/rejection from Brand A must never erase Brand B's card.
    if (input.surfaceId && (
      !previous || previous.scopeKey !== scopeKey ||
      previous.surfaceId !== input.surfaceId
    )) return false;
    stored = {
      deleted: true,
      scopeKey,
      reason: input.reason === "rejected" ? "rejected" : "delete",
    };
  }
  try {
    await memory.updateThread({
      id: thread.id,
      // Do not provide a possibly stale title from the initial read:
      // Mastra preserves the existing title when only metadata is updated.
      // Mastra Postgres updateThread merges partial metadata with the
      // latest stored row. Passing a whole earlier snapshot would overwrite
      // unrelated working-memory metadata written after our owner read.
      metadata: { [GENUI_METADATA_KEY]: stored },
    });
    return true;
  } catch {
    // No model-generated or tenant-derived payloads in production logs.
    console.error("planner.genui.persist failed");
    return false;
  }
}

function readPersistedGenUIActivity(
  metadata: Record<string, unknown> | undefined,
): { present: boolean; activity: PlannerGenUIActivity | null } {
  if (!metadata || !Object.prototype.hasOwnProperty.call(metadata, GENUI_METADATA_KEY)) {
    return { present: false, activity: null };
  }
  return {
    present: true,
    activity: normalizePlannerGenUIActivity(metadata[GENUI_METADATA_KEY]),
  };
}

export async function recallPlannerHistory(
  memory: MastraMemory,
  input: { threadId: string; resourceId: string; scopeKey?: string },
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
  const persisted = readPersistedGenUIActivity(thread.metadata);
  const currentScope = input.scopeKey ?? "workspace";
  const marker = asRecord(thread.metadata?.[GENUI_METADATA_KEY]);
  return {
    messages: mastraMessagesToChat(raw),
    // Never recover data for a different Brand/Shoot or resurrect history
    // with no trusted saved scope.
    genui: persisted.activity?.scopeKey === currentScope
      ? persisted.activity
      : null,
    ...(marker?.deleted === true && marker.scopeKey === currentScope &&
      marker.reason === "rejected" ? { genuiRecovery: true } : {}),
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
