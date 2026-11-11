// @vitest-environment jsdom
import { useEffect } from "react";
import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { A2UI_VERSION, GENERATIVE_UI_ROOT_ID } from "@copilotkit/shared";
import {
  GenerativeUISurface,
  useGenerativeUIRuntime,
} from "@copilotkit/react-core/v2/generative-ui";
import { ipixGenerativeUI } from "../src/lib/copilotkit/ipix-generative-ui";

type Runtime = NonNullable<ReturnType<typeof useGenerativeUIRuntime>>;
let capturedRuntime: Runtime | null = null;

function Probe() {
  const runtime = useGenerativeUIRuntime();
  useEffect(() => {
    capturedRuntime = runtime;
  }, [runtime]);
  return null;
}

afterEach(() => {
  cleanup();
  capturedRuntime = null;
});

describe("native GenUI provider and surface integration", () => {
  it("registers the real named Surface with its component allowlist and renders the fallback", async () => {
    render(
      <CopilotKit
        runtimeUrl="/api/copilotkit"
        useSingleEndpoint={false}
        showDevConsole={false}
        enableInspector={false}
        generativeUI={{ ui: ipixGenerativeUI }}
      >
        <GenerativeUISurface
          id="planner-comparison"
          description="Read-only qualitative concept comparisons"
          ui={ipixGenerativeUI}
          components={["ConceptComparison"]}
          fallback={<span data-testid="empty-comparison">No generated comparison yet.</span>}
          autoScroll={false}
        />
        <Probe />
      </CopilotKit>,
    );

    expect(screen.getByTestId("empty-comparison")).toBeTruthy();
    await waitFor(() => {
      expect(capturedRuntime?.ui).toBe(ipixGenerativeUI);
      expect(capturedRuntime?.manager.getMountedTargets()).toContainEqual({
        id: "planner-comparison",
        description: "Read-only qualitative concept comparisons",
        components: ["ConceptComparison"],
      });
    });

    const manager = capturedRuntime!.manager;
    const surfaceId = "comparison-1";
    const create = {
      version: A2UI_VERSION as "1.0",
      createSurface: { surfaceId, catalogId: ipixGenerativeUI.id },
    };
    const addRoot = {
      version: A2UI_VERSION as "1.0",
      updateComponents: {
        surfaceId,
        components: [{
          id: GENERATIVE_UI_ROOT_ID,
          component: "ConceptComparison",
          title: "Three shoot concepts",
          options: [
            { name: "Studio", rationale: "Controlled lighting." },
            { name: "Outdoor", rationale: "Natural backgrounds." },
          ],
        }],
      },
    };
    act(() => {
      manager.setActiveThread("test-thread");
      manager.ingest("test-thread", "default", {
        surfaceId,
        catalogId: ipixGenerativeUI.id,
        target: "planner-comparison",
        status: "ready",
        rejected: [],
        operations: [create, addRoot],
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Three shoot concepts")).toBeTruthy();
      expect(screen.getByText("Studio")).toBeTruthy();
      expect(screen.queryByTestId("empty-comparison")).toBeNull();
    });
    expect(manager.debugSurfaces()[0]?.rejected).toEqual([]);

    // Surface content follows the active thread, never the previous conversation.
    act(() => manager.setActiveThread("different-thread"));
    expect(screen.queryByText("Three shoot concepts")).toBeNull();
    expect(screen.getByTestId("empty-comparison")).toBeTruthy();

    // Even an otherwise valid component cannot sneak in measured business facts.
    const badId = "bad-comparison";
    act(() => {
      manager.ingest("different-thread", "default", {
        surfaceId: badId,
        catalogId: ipixGenerativeUI.id,
        target: "planner-comparison",
        status: "ready",
        rejected: [],
        operations: [
          {
            version: A2UI_VERSION,
            createSurface: { surfaceId: badId, catalogId: ipixGenerativeUI.id },
          },
          {
            version: A2UI_VERSION,
            updateComponents: {
              surfaceId: badId,
              components: [{
                id: GENERATIVE_UI_ROOT_ID,
                component: "ConceptComparison",
                title: "Invented budget",
                options: [
                  { name: "A", rationale: "Option A" },
                  { name: "B", rationale: "Option B" },
                ],
                budget: 12000,
              }],
            },
          },
        ],
      });
    });
    expect(screen.queryByText("Invented budget")).toBeNull();
    expect(manager.debugSurfaces().find((surface) => surface.surfaceId === badId)?.rejected.length).toBeGreaterThan(0);
  });
});
