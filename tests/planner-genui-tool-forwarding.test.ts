/**
 * IPI-1426 · GENUI-TOOL-001 — prove the tool and catalog guide that reach the
 * planner gate are produced by CopilotKit's real GenerativeUIMiddleware, not
 * hand-built context in a mock.
 */
import { firstValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";
import { GenerativeUIMiddleware } from "@copilotkit/runtime/v2";
import { RequestContext } from "@mastra/core/request-context";
import {
  GENUI_CONTEXT_DESCRIPTION,
  wrapPlannerStreamWithToolGate,
} from "../src/mastra/planner-tool-gate";

const ENVELOPE = {
  "1.0": {
    supportedCatalogIds: ["ipix/test@1"],
    inlineCatalogs: [
      {
        catalogId: "ipix/test@1",
        protocolVersion: "1.0",
        components: {
          Text: {
            props: { properties: { text: { type: "string" } }, required: ["text"] },
            description: "A line of text.",
          },
        },
        functions: {},
      },
    ],
  },
  metadata: {
    extensions: {
      copilotkit_format: 3,
      copilotkit_transport: "tool",
      copilotkit_targets: [{ id: "chat", kind: "chat" }],
      copilotkit_surfaces: {},
      copilotkit_contextSent: true,
    },
  },
};

describe("CopilotKit GenerativeUIMiddleware → planner gate bridge", () => {
  it("forwards render_ui and the catalog guide into activeTools", async () => {
    const middleware = new GenerativeUIMiddleware();
    let bridgedInput: any;

    await firstValueFrom(
      middleware.run(
        {
          threadId: "thread-1",
          runId: "run-1",
          messages: [],
          tools: [],
          context: [],
          forwardedProps: { copilotkit: { ui: ENVELOPE } },
        } as any,
        {
          run: (input: any) => {
            bridgedInput = input;
            return of({ type: "RUN_STARTED", threadId: "thread-1", runId: "run-1" } as any);
          },
          messages: [],
          state: {},
        } as any,
      ),
    );

    expect(bridgedInput.tools.map((tool: any) => tool.name)).toContain("render_ui");
    expect(
      bridgedInput.context.some(
        (entry: any) => entry.description === GENUI_CONTEXT_DESCRIPTION,
      ),
    ).toBe(true);

    const requestContext = new RequestContext();
    requestContext.set("ag-ui", { context: bridgedInput.context });

    const calls: unknown[][] = [];
    const wrapped = wrapPlannerStreamWithToolGate(
      (messages: unknown, options?: Record<string, unknown>) => {
        calls.push([messages, options]);
        return "stream-result";
      },
    );

    wrapped([{ role: "user", content: "Compare three summer concepts" }], {
      requestContext,
      clientTools: Object.fromEntries(
        bridgedInput.tools.map((tool: any) => [tool.name, tool]),
      ),
    });

    const activeTools = (calls[0]?.[1] as Record<string, unknown>)
      .activeTools as string[];
    expect(activeTools).toContain("render_ui");
  });
});
