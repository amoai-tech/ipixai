// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const useAgentContext = vi.fn();

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgentContext: (input: unknown) => useAgentContext(input),
}));

import {
  PlannerContextProvider,
  ReportPlannerContext,
  usePlannerContext,
} from "./planner-context";
import { WORKSPACE_PLANNER_CONTEXT, type PlannerContext } from "@/lib/planner/planner-context";

afterEach(() => {
  cleanup();
  useAgentContext.mockClear();
});

function ContextDisplay() {
  const context = usePlannerContext();
  return <p>{context ? context.scopeKey : "none"}</p>;
}

const BRAND_A: PlannerContext = { scopeKey: "brand:a", brand: { id: "a", name: "Brand A" } };
const BRAND_B: PlannerContext = { scopeKey: "brand:b", brand: { id: "b", name: "Brand B" } };
const SHOOT: PlannerContext = {
  scopeKey: "shoot:s1",
  brand: { id: "a", name: "Brand A" },
  shoot: {
    id: "s1",
    name: "Shoot 104",
    status: "planning",
    brandId: "a",
    brief: "Spring lookbook, minimalist studio set, neutral palette.",
    targetChannels: ["instagram", "website"],
    estimatedBudget: 12000,
    actualCost: 4500,
    currency: "USD",
    deliverables: [{ channel: "instagram", format: "reel", quantity: 4, status: "planned" }],
  },
};

describe("PlannerContextProvider / ReportPlannerContext", () => {
  it("starts with no context reported", () => {
    render(
      <PlannerContextProvider>
        <ContextDisplay />
      </PlannerContextProvider>,
    );
    expect(screen.getByText("none")).toBeDefined();
  });

  it("degrades to null outside a provider instead of throwing", () => {
    render(<ContextDisplay />);
    expect(screen.getByText("none")).toBeDefined();
  });

  it("reports a Brand context up to any consumer inside the same provider", () => {
    render(
      <PlannerContextProvider>
        <ReportPlannerContext context={BRAND_A} />
        <ContextDisplay />
      </PlannerContextProvider>,
    );
    expect(screen.getByText("brand:a")).toBeDefined();
  });

  it("registers the Brand as model-facing context via useAgentContext", () => {
    render(
      <PlannerContextProvider>
        <ReportPlannerContext context={BRAND_A} />
      </PlannerContextProvider>,
    );
    expect(useAgentContext).toHaveBeenCalled();
    const [input] = useAgentContext.mock.calls.at(-1) as [{ description: string; value: PlannerContext }];
    expect(input.value).toEqual(BRAND_A);
    expect(input.description).toMatch(/brand/i);
  });

  it("registers a Shoot context naming both the Shoot and its Brand", () => {
    render(
      <PlannerContextProvider>
        <ReportPlannerContext context={SHOOT} />
      </PlannerContextProvider>,
    );
    const [input] = useAgentContext.mock.calls.at(-1) as [{ description: string; value: PlannerContext }];
    expect(input.value).toEqual(SHOOT);
    expect(input.description).toMatch(/shoot/i);
  });

  it("carries the Shoot's brief, budget, and deliverables to the model — not just its identity", () => {
    // IPI-1087's own acceptance journey: "reduce the budget and keep the
    // same deliverables" without the operator repeating either. This only
    // holds if the model-facing `value` actually contains those fields, not
    // just id/name/status.
    render(
      <PlannerContextProvider>
        <ReportPlannerContext context={SHOOT} />
      </PlannerContextProvider>,
    );
    const [input] = useAgentContext.mock.calls.at(-1) as [{ description: string; value: PlannerContext }];
    expect(input.value.shoot?.brief).toBe(SHOOT.shoot?.brief);
    expect(input.value.shoot?.estimatedBudget).toBe(SHOOT.shoot?.estimatedBudget);
    expect(input.value.shoot?.deliverables).toEqual(SHOOT.shoot?.deliverables);
    expect(input.description).toMatch(/budget/i);
    expect(input.description).toMatch(/deliverables/i);
  });

  it("tells the model explicitly when nothing is open, instead of going silent", () => {
    render(
      <PlannerContextProvider>
        <ReportPlannerContext context={WORKSPACE_PLANNER_CONTEXT} />
      </PlannerContextProvider>,
    );
    const [input] = useAgentContext.mock.calls.at(-1) as [{ description: string; value: PlannerContext }];
    expect(input.value).toEqual(WORKSPACE_PLANNER_CONTEXT);
    expect(input.description).toMatch(/no brand or shoot is currently open/i);
  });

  it("clears context on unmount, rather than leaving a stale value for the next route", () => {
    const { rerender } = render(
      <PlannerContextProvider>
        <ReportPlannerContext context={BRAND_A} />
        <ContextDisplay />
      </PlannerContextProvider>,
    );
    expect(screen.getByText("brand:a")).toBeDefined();

    rerender(
      <PlannerContextProvider>
        <ContextDisplay />
      </PlannerContextProvider>,
    );
    expect(screen.getByText("none")).toBeDefined();
  });

  it("scope-aware cleanup: Brand A unmounting after Brand B replaced it cannot erase Brand B", () => {
    // Simulates the exact race useAgentContext's own cleanup does not
    // protect against (verified against the installed implementation,
    // IPI-1087): Brand B's reporter mounts and reports first, THEN Brand
    // A's reporter (still present from before the route changed) unmounts.
    // A naive `setContext(null)` on every cleanup would wipe Brand B here.
    const { rerender } = render(
      <PlannerContextProvider>
        <ReportPlannerContext context={BRAND_A} />
        <ContextDisplay />
      </PlannerContextProvider>,
    );
    expect(screen.getByText("brand:a")).toBeDefined();

    // Brand B replaces Brand A (both reporters momentarily present, as
    // React would render during a route transition), then only Brand A's
    // reporter unmounts.
    rerender(
      <PlannerContextProvider>
        <ReportPlannerContext context={BRAND_A} />
        <ReportPlannerContext context={BRAND_B} />
        <ContextDisplay />
      </PlannerContextProvider>,
    );
    expect(screen.getByText("brand:b")).toBeDefined();

    rerender(
      <PlannerContextProvider>
        <ReportPlannerContext context={BRAND_B} />
        <ContextDisplay />
      </PlannerContextProvider>,
    );
    // Brand A's cleanup ran (its reporter unmounted) but the shared context
    // still belongs to Brand B — it must survive.
    expect(screen.getByText("brand:b")).toBeDefined();
  });
});
