import { requirePlannerResourceId } from "@/lib/auth/planner-session";
import { authorizePlannerGenUIScope, plannerScopeForOrg } from "@/lib/copilotkit/genui-activity-persist";
import { createClientFromRequest } from "@/lib/supabase/server";
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

  const requestedScope = new URL(request.url).searchParams.get("scope") ?? "workspace";
  const scopeKey = plannerScopeForOrg(requestedScope, session.orgId);
  if (!scopeKey) return Response.json({ error: "invalid_scope" }, { status: 400 });
  const client = createClientFromRequest(request);
  if (!client) return Response.json({ error: "auth_unavailable" }, { status: 503 });
  if (!await authorizePlannerGenUIScope(client, scopeKey, session.orgId)) {
    return Response.json({ error: "forbidden_scope" }, { status: 403 });
  }
  const history = await recallPlannerHistory(memory, {
    threadId,
    resourceId: session.resourceId,
    scopeKey,
  });
  return Response.json({
    threadId,
    messages: history.messages,
    genui: history.genui,
    genuiRecovery: history.genuiRecovery === true,
  });
}
