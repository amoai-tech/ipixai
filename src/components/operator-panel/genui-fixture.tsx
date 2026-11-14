"use client";

import { useEffect } from "react";
import { useGenerativeUIRuntime } from "@copilotkit/react-core/v2/generative-ui";
import {
  A2UI_VERSION,
  GENERATIVE_UI_ROOT_ID,
  type A2UIOperation,
} from "@copilotkit/shared";

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
  switchScope: (scope: string) => void;
  rejectedUpdate: () => void;
};

function surfaceIdFor(seq: number) {
  return `genui-fixture-${seq}`;
}

function createOperations(surfaceId: string, title: string): A2UIOperation[] {
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
    let sequence = 0;
    let currentSurfaceId: string | null = null;

    const ingest = (
      threadId: string,
      surfaceId: string,
      operations: A2UIOperation[],
    ) => {
      manager.ingest(threadId, "default", {
        surfaceId,
        catalogId: ipixGenerativeUI.id,
        target: TARGET,
        status: "ready",
        rejected: [],
        operations,
      });
    };

    const create = (title = "Fixture comparison") => {
      sequence += 1;
      currentSurfaceId = surfaceIdFor(sequence);
      manager.setActiveThread(MAIN_THREAD);
      ingest(MAIN_THREAD, currentSurfaceId, createOperations(currentSurfaceId, title));
    };

    // The default page seeds one surface. `?seed=0` is used by the reload test
    // to prove the in-memory Surface is cleared, not rehydrated from storage.
    const seed = new URLSearchParams(window.location.search).get("seed") !== "0";
    if (seed) create("Fixture comparison");

    const api: FixtureApi = {
      create,
      update: (title) => {
        if (!currentSurfaceId) return;
        manager.setActiveThread(MAIN_THREAD);
        if (!manager.getSurface(MAIN_THREAD, currentSurfaceId)) return;
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
      rejectedUpdate: () => {
        if (!currentSurfaceId) return;
        manager.setActiveThread(MAIN_THREAD);
        if (!manager.getSurface(MAIN_THREAD, currentSurfaceId)) return;
        // A live surface whose next update is invalid. The previous root
        // remains, so the card must not silently look fresh.
        ingest(MAIN_THREAD, currentSurfaceId, [
          {
            version: A2UI_VERSION,
            updateComponents: {
              surfaceId: currentSurfaceId,
              components: [{ id: GENERATIVE_UI_ROOT_ID, component: "Map" }],
            },
          },
        ]);
      },
      delete: () => {
        if (!currentSurfaceId) return;
        manager.setActiveThread(MAIN_THREAD);
        ingest(MAIN_THREAD, currentSurfaceId, [
          { version: A2UI_VERSION, deleteSurface: { surfaceId: currentSurfaceId } },
        ]);
        currentSurfaceId = null;
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
      switchScope: (scope) =>
        manager.setActiveThread(
          scope === "main" ? MAIN_THREAD : `genui-fixture-scope-${scope}`,
        ),
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
      <button
        type="button"
        data-testid="fixture-focus-anchor"
        className="mt-4 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
      >
        Focus anchor
      </button>
    </main>
  );
}
