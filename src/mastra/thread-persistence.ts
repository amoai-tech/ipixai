import type { MastraMemory } from "@mastra/core/memory";

import { mastra } from "@/mastra";
import type { PlannerChatMessage, PlannerThreadRow } from "@/mastra/thread-types";

export type { PlannerChatMessage, PlannerThreadRow };

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
  return mastra.getAgent("default").getMemory();
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

export function mastraMessagesToChat(
  messages: Array<{
    id?: string;
    role?: string;
    content?: {
      content?: unknown;
      parts?: Array<{ type?: string; text?: string }>;
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
    out.push({ id, role: message.role, content });
  }
  return out;
}
