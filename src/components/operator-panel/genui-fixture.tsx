"use client";

import { useEffect } from "react";
import { useGenerativeUIRuntime } from "@copilotkit/react-core/v2/generative-ui";
import { A2UI_VERSION, GENERATIVE_UI_ROOT_ID } from "@copilotkit/shared";

import { ipixGenerativeUI } from "@/lib/copilotkit/ipix-generative-ui";

const TARGET = "planner-comparison";
const MAIN_THREAD = "genui-fixture-thread";
const BAD_THREAD = "genui-fixture-bad-thread";
const BAD_SURFACE = "genui-fixture-bad";

const OPTIONS = [
  { name: "Studio", rationale: "Controlled light and clean sets." },
  { name: "Outdoor", rationale: "Natural light and movement." },
  { name: "Editorial", rationale: "Styling-led narrative frames." },
] as const;

type FixtureApi = {
  create: (title?: string) => void;
  update: (title: string) => void;
  delete: () => void;
  malformed: () => void;
  switchThread: (threadId: string) => void;
};

function surfaceIdFor(seq: number) {
  return `genui-fixture-${seq}`;
}

function createOperations(surfaceId: string, title: string) {
  return [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId, catalogId: ipixGenerativeUI.id },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId,
        components: [
          {
            id: GENERATIVE_UI_ROOT_ID,
            component: "ConceptComparison",
            title,
            options: OPTIONS,
          },
        ],
      },
    },
  ];
}

/**
 * Test-only fixture used by `e2e/genui-surface-fixture.spec.ts`.
 *
 * The route is gated by `plannerSeedRoutesEnabled()`; it exists only in
 * development or the guarded Playwright production job. It drives the real
 * provider, manager and Surface without a model call, so the browser
 * lifecycle can be tested for free.
 */
export function GenUIFixture() {
  const runtime = useGenerativeUIRuntime();

  useEffect(() => {
    if (!runtime) return;
    const manager = runtime.manager;
    let sequence = 1;
    let currentSurfaceId = surfaceIdFor(sequence);

    const ingest = (
      threadId: string,
      surfaceId: string,
      operations: unknown[],
    ) => {
      manager.ingest(threadId, "default", {
        surfaceId,
        catalogId: ipixGenerativeUI.id,
        target: TARGET,
        status: "ready",
        rejected: [],
        operations: operations as never,
      });
    };

    const create = (title = "Fixture comparison") => {
      sequence += 1;
      currentSurfaceId = surfaceIdFor(sequence);
      manager.setActiveThread(MAIN_THREAD);
      ingest(MAIN_THREAD, currentSurfaceId, createOperations(currentSurfaceId, title));
    };

    manager.setActiveThread(MAIN_THREAD);
    if (!manager.getSurface(MAIN_THREAD, currentSurfaceId)) {
      ingest(MAIN_THREAD, currentSurfaceId, createOperations(currentSurfaceId, "Fixture comparison"));
    }

    const api: FixtureApi = {
      create,
      update: (title) => {
        manager.setActiveThread(MAIN_THREAD);
        ingest(MAIN_THREAD, currentSurfaceId, [
          {
            version: A2UI_VERSION,
            updateComponents: {
              surfaceId: currentSurfaceId,
              components: [
                {
                  id: GENERATIVE_UI_ROOT_ID,
                  component: "ConceptComparison",
                  title,
                  options: OPTIONS,
                },
              ],
            },
          },
        ]);
      },
      delete: () => {
        manager.setActiveThread(MAIN_THREAD);
        ingest(MAIN_THREAD, currentSurfaceId, [
          { version: A2UI_VERSION, deleteSurface: { surfaceId: currentSurfaceId } },
        ]);
      },
      malformed: () => {
        manager.setActiveThread(BAD_THREAD);
        ingest(BAD_THREAD, BAD_SURFACE, [
          {
            version: A2UI_VERSION,
            createSurface: { surfaceId: BAD_SURFACE, catalogId: ipixGenerativeUI.id },
          },
          {
            version: A2UI_VERSION,
            updateComponents: {
              surfaceId: BAD_SURFACE,
              components: [{ id: GENERATIVE_UI_ROOT_ID, component: "Map" }],
            },
          },
        ]);
      },
      switchThread: (threadId) => manager.setActiveThread(threadId),
    };

    (window as unknown as { __genuiFixture?: FixtureApi }).__genuiFixture = api;
    return () => {
      delete (window as unknown as { __genuiFixture?: FixtureApi }).__genuiFixture;
    };
  }, [runtime]);

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">GenUI fixture</h1>
      <p className="mt-2 max-w-prose text-sm text-[var(--muted-foreground)]">
        Deterministic browser fixture. It drives the real CopilotKit provider,
        catalog and <code>planner-comparison</code> Surface without a model call.
      </p>
    </main>
  );
}
