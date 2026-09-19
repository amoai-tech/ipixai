import type { MastraMemory } from "@mastra/core/memory";

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

export async function recallPlannerChatMessages(
  memory: MastraMemory,
  input: { threadId: string; resourceId: string },
): Promise<PlannerChatMessage[]> {
  const thread = await findMastraThread(memory, input.threadId);
  if (!thread || thread.resourceId !== input.resourceId) {
    return [];
  }
  const recalled = await memory.recall({
    threadId: thread.id,
    resourceId: input.resourceId,
    perPage: false,
  });
  return mastraMessagesToChat(recalled.messages ?? []);
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
  messages: Array<{
    id?: string;
    role?: string;
    content?: {
      content?: unknown;
      parts?: Array<{ type?: string; text?: string } & ToolInvocationPart>;
    };
  }>,
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
        content: safeJsonStringify(call.result),
      });
    }
  }
  return out;
}
