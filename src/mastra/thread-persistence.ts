import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import type { MastraMemory } from "@mastra/core/memory";
import type { A2UIOperation } from "@copilotkit/shared";

import { getMastra } from "@/mastra/runtime";
import type { PlannerChatMessage, PlannerThreadRow } from "@/mastra/thread-types";
import {
  asRecord, GENUI_MAX_OPERATIONS, GENUI_MAX_SERIALIZED_BYTES,
  normalizePlannerGenUIActivity, type PlannerGenUIActivity,
} from "./planner-genui-activity";
import { getMastraPgPool, requireMastraPostgresUrl } from "./pg-store";
import { writePlannerGenUIKey } from "./planner-genui-atomic-save";

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

export { normalizePlannerGenUIActivity } from "./planner-genui-activity";
export type { PlannerGenUIActivity } from "./planner-genui-activity";

export type PlannerHistory = {
  messages: PlannerChatMessage[];
  genui: PlannerGenUIActivity | null;
  genuiRecovery?: boolean;
};

type HistoryMessage = {
  id?: string;
  role?: string;
  content?: {
    content?: unknown;
    parts?: Array<{ type?: string; text?: string } & ToolInvocationPart>;
  };
};

const GENUI_METADATA_KEY = "ipixGenUI";

/** Reserve a globally ordered generation from PostgreSQL before the agent
 * starts. The DB, not a Vercel process clock, determines run order across
 * independent instances. txid_current() works with the existing pooler. */
export async function reservePlannerGenUIRunSequence(): Promise<string> {
  const url = requireMastraPostgresUrl();
  if (!url) throw new Error("planner.genui.pg_url_missing");
  const pool = getMastraPgPool(url);
  const result = await pool.query<{ sequence: string; guard_enabled: boolean }>(
    `SELECT txid_current()::text AS sequence,
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'mastra.mastra_threads'::regclass
          AND tgname = 'preserve_thread_genui_metadata'
          AND tgenabled IN ('O', 'A')) AS guard_enabled`,
  );
  if (result.rows[0]?.guard_enabled !== true) {
    throw new Error("planner.genui.atomic_guard_unavailable");
  }
  const sequence = result.rows[0]?.sequence;
  if (!sequence || !/^[1-9]\d*$/.test(sequence)) {
    throw new Error("planner.genui.run_sequence_unavailable");
  }
  return sequence;
}

/** Persist only a server-validated, final accepted activity in the existing
 *  thread metadata. Ownership/resource are checked here, not trusted from the
 *  browser. A null activity records a deletion marker so an older message
 *  cannot resurrect a deleted card. */
/** Save one verified surface per Planner thread. A delta-only update must
 * build on an already persisted, same-scope surface: it cannot invent a new
 * card or cause a different Brand's card to appear after reload. */
export async function savePlannerGenUIActivity(
  memory: MastraMemory,
  input: { threadId: string; resourceId: string; scopeKey?: string; runSequence?: string } & (
    | { activity: PlannerGenUIActivity | null; surfaceId?: string; reason?: "rejected" | "delete" }
    | { update: { surfaceId: string; operations: A2UIOperation[] } }
  ),
  options?: { pool?: Pick<Pool, "connect"> },
): Promise<boolean> {
  // Production always takes the existing guarded Mastra pool, never a second pool.
  // Injection is exclusively for the isolated PostgreSQL integration test.
  const url = options?.pool ? undefined : requireMastraPostgresUrl();
  const pool = options?.pool ?? (url ? getMastraPgPool(url) : undefined);
  for (let attempt = 0; attempt < (pool ? 3 : 1); attempt += 1) {
    const thread = await findMastraThread(memory, input.threadId);
    if (!thread || thread.resourceId !== input.resourceId) return false;
    const existing = thread.metadata && typeof thread.metadata === "object"
      ? thread.metadata
      : {};
    const previous = normalizePlannerGenUIActivity(existing[GENUI_METADATA_KEY]);
    const scopeKey = input.scopeKey ?? "workspace";
    // Prevent an older run from overwriting a newer comparison or deletion,
    // including when the two runs use different surface IDs. The run sequence
    // is reserved by PostgreSQL *before* running the agent, never supplied by
    // the browser or inferred from wall-clock timestamps.
    const metadata = asRecord(existing[GENUI_METADATA_KEY]);
    const previousSequence = metadata?.runSequence;
    const recentRuns = Array.isArray(metadata?.appliedUpdateRuns)
      ? metadata.appliedUpdateRuns.filter((id): id is string =>
        typeof id === "string" && /^[1-9]\d*$/.test(id),
      ).slice(-20)
      : [];
    if (input.runSequence !== undefined &&
        !/^[1-9]\d*$/.test(input.runSequence)) return false;
    // Repeated delivery of an already committed run is a successful no-op,
    // including after later runs have appended their own distinct edits.
    if (input.runSequence && "update" in input &&
        previous?.scopeKey === scopeKey &&
        previous.surfaceId === input.update.surfaceId &&
        recentRuns.includes(input.runSequence)) return true;
    if (typeof previousSequence === "string" && /^[1-9]\d*$/.test(previousSequence)) {
      if (input.runSequence === undefined ||
          BigInt(input.runSequence) < BigInt(previousSequence)) return false;
    }
    let stored: PlannerGenUIActivity | {
      deleted: true;
      scopeKey: string;
      reason: "rejected" | "delete";
      surfaceId?: string;
    };
    if ("update" in input) {
      if (!previous || previous.scopeKey !== scopeKey ||
        previous.surfaceId !== input.update.surfaceId ||
        input.update.operations.length === 0) return false;
      // Production uses a DB-reserved run sequence for idempotency; payload
      // equality is NOT identity (a later run can intentionally revert to X).
      // Legacy in-memory callers without generations retain tail-only replay
      // protection rather than incorrectly suppressing nonadjacent edits.
      const duplicate = input.runSequence === undefined &&
        isDeepStrictEqual(
          previous.operations.slice(-input.update.operations.length),
          input.update.operations,
        );
      const merged = duplicate ? previous.operations :
        [...previous.operations, ...input.update.operations];
      // Bounded-storage exhaustion is NOT a user-requested deletion. Keep
      // the last good card and report a failed save instead of persisting a
      // rejection tombstone for an otherwise valid comparison.
      if (merged.length > GENUI_MAX_OPERATIONS ||
          JSON.stringify(merged).length > GENUI_MAX_SERIALIZED_BYTES) return false;
      stored = normalizePlannerGenUIActivity({
        ...previous,
        operations: merged,
      }) ?? { deleted: true, scopeKey, surfaceId: input.update.surfaceId, reason: "rejected" };
    } else if (input.activity) {
      const validated = normalizePlannerGenUIActivity({
        ...input.activity,
        scopeKey,
      });
      if (!validated) return false;
      // A stale run must never recreate a surface deliberately deleted or
      // rejected by a newer run. New comparisons must use fresh surface IDs,
      // as required by production-planner-instructions.ts.
      const marker = asRecord(existing[GENUI_METADATA_KEY]);
      if (marker?.deleted === true && marker.scopeKey === scopeKey &&
        marker.surfaceId === validated.surfaceId) return false;
      stored = validated;
    } else {
      // A delete/rejection must address the exact currently stored surface.
      // No wildcard scope-level deletes: a missing ID cannot erase a card.
      if (!input.surfaceId || !previous || previous.scopeKey !== scopeKey ||
        previous.surfaceId !== input.surfaceId) return false;
      stored = {
        deleted: true,
        scopeKey,
        surfaceId: input.surfaceId,
        reason: input.reason === "rejected" ? "rejected" : "delete",
      };
    }
    const next = input.runSequence
      ? {
        ...stored,
        runSequence: input.runSequence,
        appliedUpdateRuns: "update" in input
          ? [...recentRuns, input.runSequence].slice(-20)
          : [],
      }
      : stored;
    try {
      if (pool) {
        const written = await writePlannerGenUIKey(pool, {
          threadId: thread.id,
          resourceId: input.resourceId,
          previous: existing[GENUI_METADATA_KEY],
          next,
        });
        if (written) return true;
        // Only a same-surface delta may be revalidated and appended to the
        // newly committed version. A full snapshot or delete may be stale;
        // never replay it over a newer version without a run-order proof.
        if (!("update" in input)) {
          console.warn("planner.genui.persist_conflict");
          return false;
        }
        continue;
      }
      // In-memory tests retain Mastra's ordinary thread storage behavior.
      await memory.updateThread({
        id: thread.id,
        metadata: { [GENUI_METADATA_KEY]: next },
      });
      return true;
    } catch {
      // No model-generated or tenant-derived payloads in production logs.
      console.error("planner.genui.persist failed");
      return false;
    }
  }
  console.warn("planner.genui.persist_conflict");
  return false;
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
