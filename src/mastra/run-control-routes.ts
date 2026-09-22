import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import {
  registerApiRoute,
  type ContextWithMastra,
} from "@mastra/core/server";

import {
  abortOwnedActiveRun,
  findOwnedActiveRun,
} from "./run-control";

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function trustedResourceId(c: ContextWithMastra): string | undefined {
  const resourceId = c.get("requestContext").get(MASTRA_RESOURCE_ID_KEY);
  return typeof resourceId === "string" && resourceId ? resourceId : undefined;
}

async function readRequestBody(
  c: ContextWithMastra,
): Promise<Record<string, unknown> | undefined> {
  try {
    const body = await c.req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

async function handleActiveRun(c: ContextWithMastra) {
  const resourceId = trustedResourceId(c);
  if (!resourceId) return c.json({ error: "unauthorized" }, 401);

  const body = await readRequestBody(c);
  const threadId = requiredString(body?.threadId);
  if (!threadId) return c.json({ error: "invalid_request" }, 400);

  const agent = c.get("mastra").getAgent("default");
  const active = findOwnedActiveRun(agent, resourceId, threadId);
  return c.json({ runId: active?.runId ?? null });
}

async function handleAbortRun(c: ContextWithMastra) {
  const resourceId = trustedResourceId(c);
  if (!resourceId) return c.json({ error: "unauthorized" }, 401);

  const body = await readRequestBody(c);
  const threadId = requiredString(body?.threadId);
  const runId = requiredString(body?.runId);
  if (!threadId || !runId) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const agent = c.get("mastra").getAgent("default");
  const aborted = abortOwnedActiveRun(agent, resourceId, threadId, runId);
  return c.json({ aborted });
}

export const plannerRunControlRoutes = [
  registerApiRoute("/ipix/run-control/active", {
    method: "POST",
    requiresAuth: true,
    handler: handleActiveRun,
  }),
  registerApiRoute("/ipix/run-control/abort", {
    method: "POST",
    requiresAuth: true,
    handler: handleAbortRun,
  }),
];
