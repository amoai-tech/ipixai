import { requirePlannerResourceId } from "@/lib/auth/planner-session";
import {
  authorizeThreadAccess,
  loadThreadOwner,
  threadForbiddenResponse,
} from "@/lib/auth/thread-acl";
import {
  canonicalizePlannerThreadId,
  getPlannerMemory,
  recallPlannerHistory,
} from "@/mastra/thread-persistence";

export async function GET(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const session = await requirePlannerResourceId(request);
  if (!session.ok) return session.response;

  const { threadId: rawThreadId } = await context.params;
  const threadId = canonicalizePlannerThreadId(rawThreadId);
  if (!threadId) {
    return Response.json({ error: "invalid_thread" }, { status: 400 });
  }

  let memory;
  try {
    memory = await getPlannerMemory();
  } catch {
    return Response.json({ error: "memory_unavailable" }, { status: 503 });
  }
  if (!memory) {
    return Response.json({ error: "memory_unavailable" }, { status: 503 });
  }

  const owner = await loadThreadOwner(threadId);
  if (owner.status === "lookup_failed") {
    return Response.json({ error: "memory_unavailable" }, { status: 503 });
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

  const history = await recallPlannerHistory(memory, {
    threadId,
    resourceId: session.resourceId,
  });
  return Response.json({ threadId, messages: history.messages, genui: history.genui });
}
