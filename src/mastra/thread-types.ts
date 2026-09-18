/** A `composeShootPlan` tool call recorded on an assistant message — the
 *  AG-UI/CopilotKit `AssistantMessage.toolCalls[]` shape, narrowed to what
 *  IPI-1233 · PLAN-CARD-001 needs to replay the structured Plan Card after
 *  reload (see `mastraMessagesToChat` in thread-persistence.ts). */
export type PlannerToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** Mirrors the 3 AG-UI `Message` roles `agent.setMessages()` actually needs to
 *  replay a conversation: plain text (user/assistant), and — only for the
 *  handful of tools IPI-1233 preserves rich history for — the paired
 *  assistant `toolCalls` + `tool` result message a structured renderer reads
 *  back. Every other historical tool call still collapses to assistant text,
 *  same as before. */
export type PlannerChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; toolCalls?: PlannerToolCall[] }
  | { id: string; role: "tool"; toolCallId: string; content: string };

export type PlannerThreadRow = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export function plannerThreadStorageKey(resourceId: string) {
  return `ipix.planner.threadId:${resourceId}`;
}

/**
 * Prefer a stored id only when this resource's own thread list actually
 * contains it — never another account's UUID. When a stored id is set but
 * absent from the list (thread deleted/archived, a stale/foreign id, or a
 * transient listing gap), never silently substitute a *different* existing
 * conversation for it: showing the operator's next message land in someone
 * else's — or just some other — old conversation is a worse failure mode
 * than starting a fresh one. `rows[0]` (resume the most recent conversation)
 * is only used when there was no stored id to begin with.
 */
export function resolvePlannerThreadId(
  rows: Array<{ id: string }>,
  stored: string | null | undefined,
): string {
  if (stored != null) {
    if (rows.some((row) => row.id === stored)) return stored;
    return crypto.randomUUID();
  }
  return rows[0]?.id ?? crypto.randomUUID();
}
