import { randomUUID } from "node:crypto";

import { requirePlannerResourceId } from "@/lib/auth/planner-session";
import { authorizeThreadAccess, loadThreadOwner, threadForbiddenResponse } from "@/lib/auth/thread-acl";
import {
  canonicalizePlannerThreadId,
  ensureMastraThread,
  getPlannerMemory,
  RICH_RESULT_DECODE_CAP,
} from "@/mastra/thread-persistence";
import { ShootPlanSchema, type ShootPlan } from "@/mastra/tools/plan-schema";
import { plannerSeedRoutesEnabled } from "@/lib/planner/seed-routes";

/**
 * IPI-1339 · PLANNER-PAYLOAD-001 — optionally store the result in the exact
 * shape the old restore/replay loop produced: JSON text containing JSON text,
 * one layer per cycle, which no single `JSON.parse` could reach. Only ever
 * wraps the plan that `ShootPlanSchema` already accepted — this adds an
 * encoding, never valid content, and never bypasses validation or auth.
 */
function encodeLegacyLayers(result: ShootPlan, layers: number): unknown {
  let current: unknown = result;
  for (let layer = 0; layer < layers; layer += 1) current = JSON.stringify(current);
  return current;
}

/** The one seeded message: a completed `composeShootPlan` tool-invocation,
 *  in the exact shape `mastraMessagesToChat` reads back (see
 *  `richToolInvocations` in thread-persistence.ts). */
function buildSeedMessage(input: {
  threadId: string;
  resourceId: string;
  plan: ShootPlan;
  legacyLayers?: number;
}) {
  return {
    id: randomUUID(),
    role: "assistant" as const,
    createdAt: new Date(),
    threadId: input.threadId,
    resourceId: input.resourceId,
    content: {
      format: 2 as const,
      parts: [
        {
          type: "tool-invocation" as const,
          toolInvocation: {
            state: "result" as const,
            toolCallId: randomUUID(),
            toolName: "composeShootPlan",
            args: { channels: input.plan.channels },
            result: input.legacyLayers
              ? encodeLegacyLayers(input.plan, input.legacyLayers)
              : input.plan,
          },
        },
      ],
    },
  };
}

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
  if (!plannerSeedRoutesEnabled()) {
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

  // Optional legacy encoding depth; bounded by the same cap the read path uses
  // so a spec can never ask for a value the recovery path would not unwrap.
  const rawLegacyLayers = (body as { legacyLayers?: unknown } | null)?.legacyLayers;
  if (
    rawLegacyLayers !== undefined &&
    (typeof rawLegacyLayers !== "number" ||
      !Number.isInteger(rawLegacyLayers) ||
      rawLegacyLayers < 1 ||
      rawLegacyLayers > RICH_RESULT_DECODE_CAP)
  ) {
    return Response.json({ error: "invalid_legacy_layers" }, { status: 400 });
  }
  const legacyLayers = typeof rawLegacyLayers === "number" ? rawLegacyLayers : undefined;

  const memory = await getPlannerMemory();
  if (!memory) {
    return Response.json({ error: "memory_unavailable" }, { status: 503 });
  }

  await ensureMastraThread(memory, { threadId, resourceId: session.resourceId });

  const message = buildSeedMessage({
    threadId,
    resourceId: session.resourceId,
    plan: parsedPlan.data,
    ...(legacyLayers === undefined ? {} : { legacyLayers }),
  });
  await memory.saveMessages({ messages: [message] });

  return Response.json({ threadId, messageId: message.id });
}

/**
 * Cleanup counterpart to `POST`, above. The hosted QA account this test-only
 * route runs against is shared by every test in the same CI job — an
 * un-cleaned seeded thread would sit in that resourceId's thread list and
 * get resumed (as `rows[0]`) by any later, unrelated test that opens `/app`
 * with no threadId of its own yet, corrupting that test's "genuinely new,
 * empty thread" assumption. Same auth/gating as `POST`: only the owning
 * resourceId may delete its own seeded thread.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  if (!plannerSeedRoutesEnabled()) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const session = await requirePlannerResourceId(request);
  if (!session.ok) return session.response;

  const { threadId: rawThreadId } = await context.params;
  const threadId = canonicalizePlannerThreadId(rawThreadId);
  if (!threadId) {
    return Response.json({ error: "invalid_thread" }, { status: 400 });
  }

  const owner = await loadThreadOwner(threadId);
  if (owner.status === "not_found") {
    return Response.json({ ok: true });
  }
  const decision = authorizeThreadAccess({
    threadId,
    callerResourceId: session.resourceId,
    owner,
    allowMissing: false,
  });
  if (!decision.ok) {
    return threadForbiddenResponse();
  }

  const memory = await getPlannerMemory();
  if (!memory) {
    return Response.json({ error: "memory_unavailable" }, { status: 503 });
  }
  await memory.deleteThread(threadId);

  return Response.json({ ok: true });
}
