import { randomUUID } from "node:crypto";

import { requirePlannerResourceId } from "@/lib/auth/planner-session";
import {
  canonicalizePlannerThreadId,
  ensureMastraThread,
  getPlannerMemory,
} from "@/mastra/thread-persistence";
import { ShootPlanSchema } from "@/mastra/tools/plan-schema";

/**
 * IPI-1233 · PLAN-CARD-001 — test-only seeding for the deterministic
 * Production Plan Card Playwright spec.
 *
 * `playwright-e2e` (the required CI job) runs against the hosted QA Supabase
 * project with `MASTRA_DATABASE_URL` unset, so Mastra memory there is an
 * in-process `InMemoryStore` local to the spawned Next server — a message
 * written by importing thread-persistence directly from the Playwright test
 * process would land in a *different* process's store and never be visible
 * to the browser. This route runs inside the same Next server process the
 * browser talks to, and writes through the exact same `ensureMastraThread` /
 * `memory.saveMessages` calls production code uses — no new persistence
 * path, no model call, no fixture data presented as anything but a seeded
 * fixture. Same auth as every other planner thread route: the caller can
 * only seed a thread under their own resourceId.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const session = await requirePlannerResourceId(request);
  if (!session.ok) return session.response;

  const { threadId: rawThreadId } = await context.params;
  const threadId = canonicalizePlannerThreadId(rawThreadId);
  if (!threadId) {
    return Response.json({ error: "invalid_thread" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedPlan = ShootPlanSchema.safeParse(
    (body as { plan?: unknown } | null)?.plan,
  );
  if (!parsedPlan.success) {
    return Response.json(
      { error: "invalid_plan", issues: parsedPlan.error.issues },
      { status: 400 },
    );
  }

  const memory = await getPlannerMemory();
  if (!memory) {
    return Response.json({ error: "memory_unavailable" }, { status: 503 });
  }

  await ensureMastraThread(memory, { threadId, resourceId: session.resourceId });

  const messageId = randomUUID();
  await memory.saveMessages({
    messages: [
      {
        id: messageId,
        role: "assistant",
        createdAt: new Date(),
        threadId,
        resourceId: session.resourceId,
        content: {
          format: 2,
          parts: [
            {
              type: "tool-invocation",
              toolInvocation: {
                state: "result",
                toolCallId: randomUUID(),
                toolName: "composeShootPlan",
                args: { channels: parsedPlan.data.channels },
                result: parsedPlan.data,
              },
            },
          ],
        },
      },
    ],
  });

  return Response.json({ threadId, messageId });
}
