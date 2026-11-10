/**
 * IPI-1426 · GENUI-TOOL-001 — prove the tool and catalog guide that reach the
 * planner gate are produced by CopilotKit's real GenerativeUIMiddleware, not
 * hand-built context in a mock.
 */
import { firstValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";
import { GenerativeUIMiddleware } from "@copilotkit/runtime/v2";
import { GENERATIVE_UI_CONTEXT_DESCRIPTION } from "@copilotkit/shared";
import { wrapPlannerStreamWithToolGate } from "../src/mastra/planner-tool-gate";

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
  it("does not add render_ui for a malformed catalog envelope", async () => {
    const middleware = new GenerativeUIMiddleware();
    let bridgedInput: any;

    await firstValueFrom(
      middleware.run(
        {
          threadId: "thread-2",
          runId: "run-2",
          messages: [],
          tools: [],
          context: [],
          forwardedProps: {
            copilotkit: {
              ui: {
                "1.0": { supportedCatalogIds: ["ipix/test@1"] },
                metadata: { extensions: {} },
              },
            },
          },
        } as any,
        {
          run: (input: any) => {
            bridgedInput = input;
            return of({ type: "RUN_STARTED", threadId: "thread-2", runId: "run-2" } as any);
          },
          messages: [],
          state: {},
        } as any,
      ),
    );

    expect(bridgedInput.tools.map((tool: any) => tool.name)).not.toContain("render_ui");

    const calls: unknown[][] = [];
    const wrapped = wrapPlannerStreamWithToolGate(
      (messages: unknown, options?: Record<string, unknown>) => {
        calls.push([messages, options]);
        return "stream-result";
      },
    );
    wrapped([{ role: "user", content: "Plan a shoot" }], {
      clientTools: Object.fromEntries(
        bridgedInput.tools.map((tool: any) => [
          tool.name,
          { ...tool, id: tool.name },
        ]),
      ),
    });
    const activeTools = (calls[0]?.[1] as Record<string, unknown>)
      .activeTools as string[];
    expect(activeTools).not.toContain("render_ui");
  });

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
        (entry: any) =>
          entry.description === GENERATIVE_UI_CONTEXT_DESCRIPTION,
      ),
    ).toBe(true);

    const calls: unknown[][] = [];
    const wrapped = wrapPlannerStreamWithToolGate(
      (messages: unknown, options?: Record<string, unknown>) => {
        calls.push([messages, options]);
        return "stream-result";
      },
    );

    wrapped([{ role: "user", content: "Compare three summer concepts" }], {
      clientTools: Object.fromEntries(
        bridgedInput.tools.map((tool: any) => [
          tool.name,
          { ...tool, id: tool.name },
        ]),
      ),
    });

    const activeTools = (calls[0]?.[1] as Record<string, unknown>)
      .activeTools as string[];
    expect(activeTools).toContain("render_ui");
  });
});
