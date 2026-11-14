/**
 * IPI-1426 · GENUI-TOOL-001 — prove the tool and catalog guide that reach the
 * planner gate are produced by CopilotKit's real GenerativeUIMiddleware, not
 * hand-built context in a mock.
 */
import { firstValueFrom, lastValueFrom, of, toArray } from "rxjs";
import { describe, expect, it } from "vitest";
import { GenerativeUIMiddleware } from "@copilotkit/runtime/v2";
import {
  A2UI_VERSION,
  GENERATIVE_UI_ACTIVITY_TYPE,
  GENERATIVE_UI_CONTEXT_DESCRIPTION,
  GENERATIVE_UI_ROOT_ID,
} from "@copilotkit/shared";
import { wrapPlannerStreamWithToolGate } from "../src/mastra/planner-tool-gate";
import {
  GENUI_COMPARISON_CREATE_SURFACE,
  GENUI_COMPARISON_UPDATE_COMPONENTS,
} from "../src/mastra/agents/production-planner-instructions";
import { conceptComparisonSchema, ipixGenerativeUI } from "../src/lib/copilotkit/ipix-generative-ui";

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

  it("emits surface activities for a valid render_ui call", async () => {
    const envelope = {
      "1.0": {
        supportedCatalogIds: ["ipix/planner@1"],
        inlineCatalogs: [
          {
            catalogId: "ipix/planner@1",
            protocolVersion: "1.0",
            components: {
              ConceptComparison: {
                props: {
                  properties: {
                    title: { type: "string" },
                    options: {
                      type: "array",
                      minItems: 2,
                      maxItems: 3,
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          rationale: { type: "string" },
                        },
                        required: ["name", "rationale"],
                      },
                    },
                  },
                  required: ["title", "options"],
                },
                description: "A read-only concept comparison.",
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
          copilotkit_targets: [
            {
              id: "planner-comparison",
              kind: "inline",
              description: "Test comparison target.",
              components: ["ConceptComparison"],
            },
          ],
          copilotkit_surfaces: {},
          copilotkit_contextSent: true,
        },
      },
    };

    const operations = [
      GENUI_COMPARISON_CREATE_SURFACE,
      GENUI_COMPARISON_UPDATE_COMPONENTS,
    ];

    const stream = [
      { type: "RUN_STARTED", threadId: "thread-m", runId: "run-m" },
      {
        type: "TOOL_CALL_START",
        toolCallId: "call-m",
        toolCallName: "render_ui",
      },
      {
        type: "TOOL_CALL_ARGS",
        toolCallId: "call-m",
        delta: JSON.stringify({ target: "planner-comparison", operations }),
      },
      { type: "TOOL_CALL_END", toolCallId: "call-m" },
      { type: "RUN_FINISHED", threadId: "thread-m", runId: "run-m" },
    ];

    const middleware = new GenerativeUIMiddleware();
    const events = await lastValueFrom(
      middleware
        .run(
          {
            threadId: "thread-m",
            runId: "run-m",
            messages: [],
            tools: [],
            context: [],
            forwardedProps: { copilotkit: { ui: envelope } },
          } as never,
          {
            run: () => of(...stream),
            messages: [],
            state: {},
          } as never,
        )
        .pipe(toArray()),
    );

    const activities = events.filter(
      (event: any) =>
        event.type === "ACTIVITY_SNAPSHOT" || event.type === "ACTIVITY_DELTA",
    );
    expect(activities.length).toBeGreaterThan(0);
    expect(
      activities.every(
        (event: any) => event.activityType === GENERATIVE_UI_ACTIVITY_TYPE,
      ),
    ).toBe(true);

    const result = events.find(
      (event: any) => event.type === "TOOL_CALL_RESULT",
    ) as { content?: string } | undefined;
    expect(result?.content).toBeTruthy();
    const payload = JSON.parse(result!.content!);
    expect(payload.status).toBe("rendered");
    // Both the createSurface and the ConceptComparison update must apply.
    // A rejected update would otherwise leave applied at 1 and hide a card
    // that never renders.
    expect(payload.applied).toBe(operations.length);
    expect(payload.rejected).toEqual([]);
  });

  it("keeps the Planner instruction example valid for ConceptComparison", () => {
    expect(GENUI_COMPARISON_CREATE_SURFACE.createSurface.catalogId).toBe(ipixGenerativeUI.id);
    expect(GENUI_COMPARISON_UPDATE_COMPONENTS.updateComponents.surfaceId).toBe(
      GENUI_COMPARISON_CREATE_SURFACE.createSurface.surfaceId,
    );
    const component =
      GENUI_COMPARISON_UPDATE_COMPONENTS.updateComponents.components[0];
    const { id, component: name, ...props } = component;
    expect(id).toBe(GENERATIVE_UI_ROOT_ID);
    expect(name).toBe("ConceptComparison");
    expect(props.options).toHaveLength(2);
    expect(conceptComparisonSchema.safeParse(props).success).toBe(true);
  });
});
