import { registerApiRoute } from "@mastra/core/server";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";

import {
  abortOwnedActiveRun,
  findOwnedActiveRun,
} from "./run-control";

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const plannerRunControlRoutes = [
  registerApiRoute("/ipix/run-control/active", {
    method: "POST",
    handler: async (c) => {
      const rawResourceId = c.get("requestContext").get(MASTRA_RESOURCE_ID_KEY);
      if (typeof rawResourceId !== "string" || !rawResourceId) {
        return c.json({ error: "unauthorized" }, 401);
      }
      const resourceId = rawResourceId;
      const body = await c.req.json();
      const threadId = requiredString(body?.threadId);
      if (!threadId) return c.json({ error: "invalid_request" }, 400);

      const agent = c.get("mastra").getAgent("default");
      const active = findOwnedActiveRun(agent, resourceId, threadId);
      return c.json({ runId: active?.runId ?? null });
    },
  }),
  registerApiRoute("/ipix/run-control/abort", {
    method: "POST",
    handler: async (c) => {
      const rawResourceId = c.get("requestContext").get(MASTRA_RESOURCE_ID_KEY);
      if (typeof rawResourceId !== "string" || !rawResourceId) {
        return c.json({ error: "unauthorized" }, 401);
      }
      const resourceId = rawResourceId;
      const body = await c.req.json();
      const threadId = requiredString(body?.threadId);
      const runId = requiredString(body?.runId);
      if (!threadId || !runId) {
        return c.json({ error: "invalid_request" }, 400);
      }

      const agent = c.get("mastra").getAgent("default");
      const aborted = abortOwnedActiveRun(agent, resourceId, threadId, runId);
      return c.json({ aborted });
    },
  }),
];
