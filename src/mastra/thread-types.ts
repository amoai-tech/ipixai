export type PlannerChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

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
  stored: string | null,
): string {
  if (stored) {
    if (rows.some((row) => row.id === stored)) return stored;
    return crypto.randomUUID();
  }
  return rows[0]?.id ?? crypto.randomUUID();
}
