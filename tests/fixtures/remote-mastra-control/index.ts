import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { defineAuth, registerApiRoute } from "@mastra/core/server";

import { plannerRunControlRoutes } from "@/mastra/run-control-routes";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RESOURCE_A = "org:a::user:u";
const RESOURCE_B = "org:b::user:u";

const fixtureAuth = defineAuth<{ id: string; resourceId: string }>({
  protected: ["/ipix/*"],
  authenticateToken: async (token) => {
    const resourceId = token === "org-a-token" ? RESOURCE_A : token === "org-b-token" ? RESOURCE_B : undefined;
    if (!resourceId) throw new Error("unauthorized");
    return { id: token, resourceId };
  },
  mapUserToResourceId: (user) => user.resourceId,
});

/** Hang guard only (~30 s at 150 ms/tick): runs end by Stop or release, never by time. */
const MAX_TICKS = 200;

/** Set by POST /fixture/release: lets the currently streaming run finish normally. */
let released = false;

const releaseRoute = registerApiRoute("/fixture/release", {
  method: "POST",
  requiresAuth: false,
  handler: async (c) => {
    released = true;
    return c.json({ released: true });
  },
});

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
        // Stream until the run is stopped or the test releases it, so the
        // test never races cold `tsx` controller start-up against a fixed
        // stream length.
        released = false;
        for (let i = 1; i <= MAX_TICKS; i++) {
          await sleep(150);
          if (options?.abortSignal?.aborted) break;
          controller.enqueue({ type: "text-delta", id: "fixture-text", delta: `tick-${i} ` });
          if (released) break;
        }
        // Server-side proof of how the model stream ended, independent of
        // what the client prints when its stream closes.
        const reason = options?.abortSignal?.aborted ? "aborted" : released ? "released" : "cap";
        console.log(`FIXTURE_STREAM_END reason=${reason}`);
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
  server: { host: "127.0.0.1", port: 0, handleShutdownSignals: false, auth: fixtureAuth, apiRoutes: [...plannerRunControlRoutes, releaseRoute] },
});
