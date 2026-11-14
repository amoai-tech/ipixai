// @vitest-environment jsdom
import { useEffect } from "react";
import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { A2UI_VERSION, GENERATIVE_UI_ROOT_ID } from "@copilotkit/shared";
import { useGenerativeUIRuntime } from "@copilotkit/react-core/v2/generative-ui";
import { ipixGenerativeUI } from "../src/lib/copilotkit/ipix-generative-ui";
import { IpixGenerativeComparisonSurface } from "../src/components/operator-panel/ipix-generative-surface";

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
      <CopilotKitProvider
        runtimeUrl="/api/copilotkit"
        agentId="default"
        useSingleEndpoint={false}
        enableInspector={false}
        generativeUI={{ ui: ipixGenerativeUI }}
      >
        <IpixGenerativeComparisonSurface />
        <Probe />
      </CopilotKitProvider>,
    );

    expect(screen.getByText("No generated comparison yet.")).toBeTruthy();
    await waitFor(() => {
      expect(capturedRuntime?.ui).toBe(ipixGenerativeUI);
      expect(capturedRuntime?.manager.getMountedTargets()).toContainEqual({
        id: "planner-comparison",
        description: "Read-only qualitative comparison of shoot concepts. Use one ConceptComparison only for proposed ideas. Do not assert measured or approved business facts.",
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
      expect(screen.queryByText("No generated comparison yet.")).toBeNull();
    });
    expect(manager.debugSurfaces()[0]?.rejected).toEqual([]);

    // Surface content follows the active thread, never the previous conversation.
    act(() => manager.setActiveThread("different-thread"));
    expect(screen.queryByText("Three shoot concepts")).toBeNull();
    expect(screen.getByText("No generated comparison yet.")).toBeTruthy();

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
    // A rejected root must leave an accessible recovery message, not silence.
    expect(screen.getByTestId("genui-comparison-recovery").textContent).toContain("comparison");
    expect(screen.queryByText("Invented budget")).toBeNull();
    expect(manager.debugSurfaces().find((surface) => surface.surfaceId === badId)?.rejected.length).toBeGreaterThan(0);

    // A subsequent valid update restores the card and clears the error.
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
                title: "Recovered concepts",
                options: [
                  { name: "Editorial", rationale: "Natural styling." },
                  { name: "Studio", rationale: "Controlled lighting." },
                ],
              }],
            },
          },
        ],
      });
    });
    expect(screen.getByText("Recovered concepts")).toBeTruthy();
    expect(screen.queryByTestId("genui-comparison-recovery")).toBeNull();

    // A ready surface that omits its root entirely is also a recoverable failure.
    act(() => {
      manager.setActiveThread("rootless-thread");
      manager.ingest("rootless-thread", "default", {
        surfaceId: "no-root",
        catalogId: ipixGenerativeUI.id,
        target: "planner-comparison",
        status: "ready",
        rejected: [],
        operations: [{
          version: A2UI_VERSION,
          createSurface: { surfaceId: "no-root", catalogId: ipixGenerativeUI.id },
        }],
      });
    });
    expect(screen.getByTestId("genui-comparison-recovery").textContent).toContain("comparison");
    expect(screen.queryByText("Recovered concepts")).toBeNull();
    expect(manager.getMountedTargets().some((target) => target.id === "planner-comparison")).toBe(true);

  });

  it("shows no error while a surface streams before its root arrives", async () => {
    render(
      <CopilotKitProvider
        runtimeUrl="/api/copilotkit"
        agentId="default"
        useSingleEndpoint={false}
        enableInspector={false}
        generativeUI={{ ui: ipixGenerativeUI }}
      >
        <IpixGenerativeComparisonSurface />
        <Probe />
      </CopilotKitProvider>,
    );
    await waitFor(() => expect(capturedRuntime).not.toBeNull());

    act(() => {
      capturedRuntime!.manager.setActiveThread("streaming-thread");
      capturedRuntime!.manager.ingest("streaming-thread", "default", {
        surfaceId: "streaming-1",
        catalogId: ipixGenerativeUI.id,
        target: "planner-comparison",
        status: "streaming",
        rejected: [],
        operations: [{
          version: A2UI_VERSION,
          createSurface: { surfaceId: "streaming-1", catalogId: ipixGenerativeUI.id },
        }],
      });
    });

    // A loading surface is not a failure: keep the existing chat usable and
    // stay silent until the run either finishes or rejects the root.
    expect(screen.queryByTestId("genui-comparison-recovery")).toBeNull();
    expect(screen.queryByTestId("genui-concept-comparison")).toBeNull();
  });

  it("rejects a component outside the catalog allowlist with an accessible message", async () => {
    render(
      <CopilotKitProvider
        runtimeUrl="/api/copilotkit"
        agentId="default"
        useSingleEndpoint={false}
        enableInspector={false}
        generativeUI={{ ui: ipixGenerativeUI }}
      >
        <IpixGenerativeComparisonSurface />
        <Probe />
      </CopilotKitProvider>,
    );
    await waitFor(() => expect(capturedRuntime).not.toBeNull());

    act(() => {
      capturedRuntime!.manager.setActiveThread("unknown-component-thread");
      capturedRuntime!.manager.ingest("unknown-component-thread", "default", {
        surfaceId: "map-surface",
        catalogId: ipixGenerativeUI.id,
        target: "planner-comparison",
        status: "ready",
        rejected: [],
        operations: [
          {
            version: A2UI_VERSION,
            createSurface: { surfaceId: "map-surface", catalogId: ipixGenerativeUI.id },
          },
          {
            version: A2UI_VERSION,
            updateComponents: {
              surfaceId: "map-surface",
              components: [{ id: GENERATIVE_UI_ROOT_ID, component: "Map" }],
            },
          },
        ],
      });
    });

    const surface = capturedRuntime!.manager
      .debugSurfaces()
      .find((candidate) => candidate.surfaceId === "map-surface");
    expect(surface?.rejected.map((rejected) => rejected.reason).join(" ")).toContain(
      'unknown component "Map"',
    );
    expect(screen.getByTestId("genui-comparison-recovery").textContent).toContain("comparison");
    expect(screen.queryByTestId("genui-concept-comparison")).toBeNull();
  });
});
