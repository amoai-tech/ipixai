import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import type { Middleware } from "@mastra/core/server";

import { applyMastraIdentity, bearerTokenFromHeader } from "@/mastra/server-auth";
import { plannerRunControlRoutes } from "@/mastra/run-control-routes";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RESOURCE_A = "org:a::user:u";
const RESOURCE_B = "org:b::user:u";

const fixtureAuth: Middleware = async (c, next) => {
  const token = bearerTokenFromHeader(c.req.header("authorization"));
  const resourceId = token === "org-a-token" ? RESOURCE_A : token === "org-b-token" ? RESOURCE_B : undefined;
  if (!resourceId) return c.json({ error: "unauthorized" }, 401);
  applyMastraIdentity(c.get("requestContext"), { accessToken: token!, resourceId });
  return next();
};

const model = {
  specificationVersion: "v2" as const,
  provider: "ipix-fixture",
  modelId: "run-control",
  supportedUrls: Promise.resolve({}),
  doGenerate: async () => ({ content: [{ type: "text", text: "fixture" }], finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, warnings: [] }),
  doStream: async (options: any) => ({
    stream: new ReadableStream({
      async start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        controller.enqueue({ type: "text-start", id: "fixture-text" });
        for (let i = 1; i <= 12; i++) {
          await sleep(150);
          if (options?.abortSignal?.aborted) break;
          controller.enqueue({ type: "text-delta", id: "fixture-text", delta: `tick-${i} ` });
        }
        if (!options?.abortSignal?.aborted) {
          controller.enqueue({ type: "text-end", id: "fixture-text" });
          controller.enqueue({ type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 12, totalTokens: 13 } });
        }
        controller.close();
      },
    }),
  }),
};

const agent = new Agent({ id: "default", name: "default", instructions: "Return fixture ticks.", model: model as any });

export const mastra = new Mastra({
  agents: { default: agent },
  server: { host: "127.0.0.1", port: 43112, handleShutdownSignals: false, middleware: fixtureAuth, apiRoutes: plannerRunControlRoutes },
});
