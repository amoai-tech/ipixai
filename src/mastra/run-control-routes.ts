import { registerApiRoute } from "@mastra/core/server";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";

import {
  abortOwnedActiveRun,
  findOwnedActiveRun,
} from "./run-control";

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

type JsonRequestContext = { req: { json(): Promise<unknown> } };

async function readRequestBody(
  c: JsonRequestContext,
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

export const plannerRunControlRoutes = [
  registerApiRoute("/ipix/run-control/active", {
    method: "POST",
    requiresAuth: true,
    handler: async (c) => {
      const rawResourceId = c.get("requestContext").get(MASTRA_RESOURCE_ID_KEY);
      if (typeof rawResourceId !== "string" || !rawResourceId) {
        return c.json({ error: "unauthorized" }, 401);
      }
      const body = await readRequestBody(c);
      const threadId = requiredString(body?.threadId);
      if (!threadId) return c.json({ error: "invalid_request" }, 400);

      const agent = c.get("mastra").getAgent("default");
      const active = findOwnedActiveRun(agent, rawResourceId, threadId);
      return c.json({ runId: active?.runId ?? null });
    },
  }),
  registerApiRoute("/ipix/run-control/abort", {
    method: "POST",
    requiresAuth: true,
    handler: async (c) => {
      const rawResourceId = c.get("requestContext").get(MASTRA_RESOURCE_ID_KEY);
      if (typeof rawResourceId !== "string" || !rawResourceId) {
        return c.json({ error: "unauthorized" }, 401);
      }
      const body = await readRequestBody(c);
      const threadId = requiredString(body?.threadId);
      const runId = requiredString(body?.runId);
      if (!threadId || !runId) {
        return c.json({ error: "invalid_request" }, 400);
      }

      const agent = c.get("mastra").getAgent("default");
      const aborted = abortOwnedActiveRun(agent, rawResourceId, threadId, runId);
      return c.json({ aborted });
    },
  }),
];
