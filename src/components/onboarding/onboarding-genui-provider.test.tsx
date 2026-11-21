// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { A2UI_VERSION, GENERATIVE_UI_ROOT_ID } from "@copilotkit/shared";
import {
  GenerativeUISurface,
  useGenerativeUIFunction,
  useGenerativeUIRuntime,
} from "@copilotkit/react-core/v2/generative-ui";

import { ONBOARDING_COMPONENTS, ipixOnboardingUI } from "@/lib/copilotkit/ipix-onboarding-ui";
import { OnboardingGenUIProvider } from "./onboarding-genui-provider";

// IPI-1461 · Spike S0 — a fixed CopilotKit form renders, accepts input, exposes
// the typed values to the host and submits to a host function without any
// agent run, while /api/copilotkit refuses the zero-org user.

type Runtime = NonNullable<ReturnType<typeof useGenerativeUIRuntime>>;
const TARGET = "onboarding-step";
const THREAD = "onboarding";
const SURFACE = "onboarding-step-1";
let runtime: Runtime | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

const p = (path: string) => ({ "@path": path });

function step1Ops(draft: { brandName: string; buildType: string | null }) {
  return [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: SURFACE, catalogId: ipixOnboardingUI.id, dataModel: { draft } },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: SURFACE,
        components: [
          {
            id: GENERATIVE_UI_ROOT_ID,
            component: "Form",
            label: "Brand discovery",
            children: ["name", "category", "continue"],
            onSubmit: {
              functionCall: {
                "@call": "onboardingContinue",
                args: { brandName: p("/draft/brandName"), buildType: p("/draft/buildType") },
              },
            },
          },
          { id: "name", component: "TextField", label: "Brand name", value: p("/draft/brandName") },
          {
            id: "category",
            component: "RadioGroup",
            label: "Brand type",
            value: p("/draft/buildType"),
            options: [
              { value: "fashion", label: "Fashion brand" },
              { value: "access", label: "Accessories" },
            ],
          },
          { id: "continue", component: "Button", label: "Continue", submit: true, variant: "primary" },
        ],
      },
    },
  ];
}

function Host({ onContinue }: { onContinue: (args: unknown) => void }) {
  const current = useGenerativeUIRuntime();
  const [ready, setReady] = useState(false);
  useGenerativeUIFunction(ipixOnboardingUI, "onboardingContinue", (args) => onContinue(args));
  useEffect(() => {
    runtime = current;
    if (current) setReady(true);
  }, [current]);
  return (
    <GenerativeUISurface
      id={TARGET}
      ui={ipixOnboardingUI}
      components={[...ONBOARDING_COMPONENTS]}
      fallback={<span>{ready ? "Waiting for form" : "Loading"}</span>}
      autoScroll={false}
    />
  );
}

function ingest(draft: { brandName: string; buildType: string | null }) {
  act(() => {
    runtime!.manager.setActiveThread(THREAD);
    runtime!.manager.ingest(THREAD, undefined, {
      surfaceId: SURFACE,
      catalogId: ipixOnboardingUI.id,
      target: TARGET,
      status: "ready",
      rejected: [],
      operations: step1Ops(draft) as never,
    });
  });
}

beforeEach(() => {
  // The zero-org user is refused by the unchanged Planner endpoint.
  fetchMock = vi.fn(async () => new Response("Forbidden", { status: 403 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  runtime = null;
  vi.unstubAllGlobals();
});

describe("IPI-1461 S0 — host-only CopilotKit onboarding form", () => {
  it("renders, accepts input, exposes values for autosave and submits to the host with no agent run", async () => {
    const onContinue = vi.fn();
    render(
      <OnboardingGenUIProvider>
        <Host onContinue={onContinue} />
      </OnboardingGenUIProvider>,
    );
    await waitFor(() => expect(runtime).not.toBeNull());

    // The catalog is not advertised to any agent.
    expect(runtime!.config.agentIds).toEqual([]);

    // 1. First form renders from the saved draft.
    ingest({ brandName: "Maison", buildType: null });
    const name = (await screen.findByLabelText("Brand name")) as HTMLInputElement;
    expect(name.value).toBe("Maison");
    const surface = runtime!.manager.getSurface(THREAD, SURFACE)!;
    expect([...surface.serverRejected, ...surface.clientRejected]).toEqual([]);

    // 3. Typed values reach the surface data model, which the host can read
    //    and subscribe to for debounced autosave.
    const seen: unknown[] = [];
    surface.model.dataModel.subscribe("/draft/brandName", (value) => seen.push(value));
    fireEvent.change(name, { target: { value: "Maison Atelier" } });
    fireEvent.click(screen.getByLabelText("Accessories"));
    await waitFor(() => {
      expect(surface.model.dataModel.get("/draft/brandName")).toBe("Maison Atelier");
      expect(surface.model.dataModel.get("/draft/buildType")).toBe("access");
    });
    expect(seen).toContain("Maison Atelier");

    // 2. Continue calls the host function with the typed, schema-parsed values.
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(onContinue).toHaveBeenCalledWith({ brandName: "Maison Atelier", buildType: "access" }),
    );

    // The provider probed the runtime (refused with 403) and made no other
    // request, so no agent run was attempted.
    const urls = fetchMock.mock.calls.map(([input]) => String(input instanceof Request ? input.url : input));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => url.endsWith("/api/copilotkit/info"))).toBe(true);
  });

  it("rejects out-of-enum arguments before the host handler runs", async () => {
    const onContinue = vi.fn();
    render(
      <OnboardingGenUIProvider>
        <Host onContinue={onContinue} />
      </OnboardingGenUIProvider>,
    );
    await waitFor(() => expect(runtime).not.toBeNull());
    const ops = step1Ops({ brandName: "Maison", buildType: null });
    const root = (ops[1] as { updateComponents: { components: Array<Record<string, unknown>> } })
      .updateComponents.components[0];
    root.onSubmit = { functionCall: { "@call": "onboardingContinue", args: { brandName: "Maison", buildType: "bogus" } } };
    act(() => {
      runtime!.manager.setActiveThread(THREAD);
      runtime!.manager.ingest(THREAD, undefined, {
        surfaceId: SURFACE,
        catalogId: ipixOnboardingUI.id,
        target: TARGET,
        status: "ready",
        rejected: [],
        operations: ops as never,
      });
    });
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    // Give a rejected call the same chance to land as an accepted one would.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("does not overwrite what the user typed when the same surface is ingested again", async () => {
    render(
      <OnboardingGenUIProvider>
        <Host onContinue={() => {}} />
      </OnboardingGenUIProvider>,
    );
    await waitFor(() => expect(runtime).not.toBeNull());
    ingest({ brandName: "", buildType: null });
    const name = (await screen.findByLabelText("Brand name")) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Typed by founder" } });

    // 4. A re-render of the same step (same operations) keeps the user's input.
    ingest({ brandName: "", buildType: null });
    await waitFor(() => expect((screen.getByLabelText("Brand name") as HTMLInputElement).value).toBe("Typed by founder"));
  });

  it("rejects components outside the onboarding allowlist", async () => {
    render(
      <OnboardingGenUIProvider>
        <Host onContinue={() => {}} />
      </OnboardingGenUIProvider>,
    );
    await waitFor(() => expect(runtime).not.toBeNull());
    act(() => {
      runtime!.manager.setActiveThread(THREAD);
      runtime!.manager.ingest(THREAD, undefined, {
        surfaceId: "bad",
        catalogId: ipixOnboardingUI.id,
        target: TARGET,
        status: "ready",
        rejected: [],
        operations: [
          { version: A2UI_VERSION, createSurface: { surfaceId: "bad", catalogId: ipixOnboardingUI.id } },
          {
            version: A2UI_VERSION,
            updateComponents: {
              surfaceId: "bad",
              components: [{ id: GENERATIVE_UI_ROOT_ID, component: "HtmlView", html: "<b>x</b>" }],
            },
          },
        ] as never,
      });
    });
    const bad = runtime!.manager.getSurface(THREAD, "bad");
    expect(bad?.clientRejected.length ?? 0).toBeGreaterThan(0);
    expect(screen.queryByText("x")).toBeNull();
  });
});
