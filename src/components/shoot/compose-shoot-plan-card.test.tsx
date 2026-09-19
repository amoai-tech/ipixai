// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ComposeShootPlanCard } from "./compose-shoot-plan-card";
import { describeProductionPlanCard, type ProductionPlanCardView } from "@/lib/shoot/compose-shoot-plan-card-view";

afterEach(() => {
  cleanup();
});

const COMPLETE_PLAN = {
  status: "complete",
  channels: ["shopify", "instagram_feed"],
  objective: { status: "confirmed", value: "Launch-ready PDP + campaign imagery", source: "operator" },
  shotListResult: {
    status: "ok",
    missingInputs: [],
    assumptions: [],
    warnings: [],
    totalShots: 2,
    shots: [
      { shotNumber: 1, description: "Front PDP", angle: "front", lighting: "studio", deliverableIds: [], referenceId: "r1" },
      { shotNumber: 2, description: "Detail", angle: "macro", lighting: "studio", deliverableIds: [], referenceId: "r2" },
    ],
  },
  deliverablesResult: {
    status: "ok",
    missingInputs: [],
    assumptions: [],
    warnings: [],
    totalAssets: 12,
    deliverables: [
      { channel: "shopify", format: "1:1 JPG white-bg", formatSource: "ipix_default_v1", quantity: 6, source: "ipix_default_v1", assumed: true },
      { channel: "instagram_feed", format: "1:1 JPG", formatSource: "ipix_default_v1", quantity: 6, source: "ipix_default_v1", assumed: true },
    ],
  },
  assumptions: [
    { key: "budget", value: 1200, currency: "USD", source: "ipix_default_v1", assumed: true },
  ],
  missingInputs: [],
  warnings: [],
};

const NEEDS_INPUT_PLAN = {
  status: "needs_input",
  channels: ["shopify"],
  objective: { status: "needs_input" },
  shotListResult: null,
  deliverablesResult: {
    status: "ok",
    missingInputs: [],
    assumptions: [],
    warnings: [],
    totalAssets: 6,
    deliverables: [
      { channel: "shopify", format: "1:1 JPG white-bg", formatSource: "ipix_default_v1", quantity: 6, source: "ipix_default_v1", assumed: true },
    ],
  },
  missingInputs: ["location", "crew", "schedule"],
  warnings: ["No trusted shot references are currently available — the shot list cannot be generated yet."],
};

describe("describeProductionPlanCard", () => {
  it("projects a complete plan, using totalAssets for the deliverable count", () => {
    const view = describeProductionPlanCard(COMPLETE_PLAN);
    expect(view?.status).toBe("complete");
    expect(view?.objective).toBe("Launch-ready PDP + campaign imagery");
    expect(view?.channels).toEqual(["shopify", "instagram_feed"]);
    expect(view?.totalShots).toBe(2);
    expect(view?.shots).toHaveLength(2);
    // Required rule: displayed count is deliverablesResult.totalAssets (12),
    // never deliverables.length (2).
    expect(view?.totalAssets).toBe(12);
    expect(view?.deliverables).toHaveLength(2);
    expect(view?.missingInputs).toEqual([]);
    // Required rule: the plan's roll-up `assumptions` (across every tool) is
    // surfaced on the card, never silently dropped.
    expect(view?.assumptions).toEqual([{ key: "budget", value: "1200 USD", source: "ipix_default_v1" }]);
  });

  it("omits the objective and shot list for a needs_input plan instead of fabricating them", () => {
    const view = describeProductionPlanCard(NEEDS_INPUT_PLAN);
    expect(view?.status).toBe("needs_input");
    expect(view?.objective).toBeNull();
    expect(view?.shots).toEqual([]);
    expect(view?.totalShots).toBeNull();
    expect(view?.missingInputs).toEqual(["location", "crew", "schedule"]);
    expect(view?.assumptions).toEqual([]);
  });

  it("never renders a field's value unless its status is confirmed or assumed", () => {
    // A malformed/unexpected status (neither the schema's "confirmed"/"assumed"
    // nor its "needs_input") must not silently leak `value` onto the card.
    const view = describeProductionPlanCard({
      ...NEEDS_INPUT_PLAN,
      objective: { status: "unknown_status", value: "should never render" },
    });
    expect(view?.objective).toBeNull();
  });

  it("never fabricates a Plan ID — the view model has no such field", () => {
    const view = describeProductionPlanCard(COMPLETE_PLAN) as unknown as Record<string, unknown>;
    expect(view.planId).toBeUndefined();
    expect(view.id).toBeUndefined();
  });

  it("returns null for a malformed/unreadable result instead of throwing", () => {
    expect(describeProductionPlanCard(null)).toBeNull();
    expect(describeProductionPlanCard("not a plan")).toBeNull();
    expect(describeProductionPlanCard({ status: "in_progress" })).toBeNull();
    expect(describeProductionPlanCard(42)).toBeNull();
  });
});

describe("ComposeShootPlanCard", () => {
  it("renders a complete plan with real values only", () => {
    const view = describeProductionPlanCard(COMPLETE_PLAN) as ProductionPlanCardView;
    render(<ComposeShootPlanCard plan={view} />);

    expect(screen.getByTestId("compose-shoot-plan-status").textContent).toBe("Complete");
    expect(screen.getByTestId("compose-shoot-plan-objective").textContent).toBe(
      "Launch-ready PDP + campaign imagery",
    );
    expect(screen.getByText("Deliverables (12 assets)")).toBeTruthy();
    expect(screen.getByTestId("compose-shoot-plan-deliverables").textContent).toContain("shopify");
    expect(screen.queryByTestId("compose-shoot-plan-missing-inputs")).toBeNull();
    const assumptions = screen.getByTestId("compose-shoot-plan-assumptions");
    expect(assumptions.textContent).toContain("budget");
    expect(assumptions.textContent).toContain("1200 USD");
  });

  it("renders the missing-input state honestly and omits absent sections", () => {
    const view = describeProductionPlanCard(NEEDS_INPUT_PLAN) as ProductionPlanCardView;
    render(<ComposeShootPlanCard plan={view} />);

    expect(screen.getByTestId("compose-shoot-plan-status").textContent).toBe("Needs input");
    expect(screen.queryByTestId("compose-shoot-plan-objective")).toBeNull();
    expect(screen.queryByTestId("compose-shoot-plan-shots")).toBeNull();
    const missing = screen.getByTestId("compose-shoot-plan-missing-inputs");
    expect(missing.textContent).toContain("location");
    expect(missing.textContent).toContain("crew");
    expect(missing.textContent).toContain("schedule");
    expect(screen.queryByTestId("compose-shoot-plan-assumptions")).toBeNull();
  });
});

describe("ComposeShootPlanCard — IPI-1242 cosmetic polish + Review Shoot Plan", () => {
  it("shows a combined shot/deliverable count line when both totals are known", () => {
    const view = describeProductionPlanCard(COMPLETE_PLAN) as ProductionPlanCardView;
    render(<ComposeShootPlanCard plan={view} />);

    expect(screen.getByTestId("compose-shoot-plan-counts").textContent).toBe(
      "2 shots · 12 deliverables",
    );
  });

  it("shows only the known total when the other is absent, never a fabricated one", () => {
    // NEEDS_INPUT_PLAN has no shotListResult (totalShots null) but does have
    // a deliverablesResult (totalAssets 6) — the line must show only what's real.
    const view = describeProductionPlanCard(NEEDS_INPUT_PLAN) as ProductionPlanCardView;
    render(<ComposeShootPlanCard plan={view} />);

    expect(screen.getByTestId("compose-shoot-plan-counts").textContent).toBe("6 deliverables");
  });

  it("omits the Review Shoot Plan button when no handler is provided", () => {
    const view = describeProductionPlanCard(COMPLETE_PLAN) as ProductionPlanCardView;
    render(<ComposeShootPlanCard plan={view} />);

    expect(screen.queryByTestId("compose-shoot-plan-review-button")).toBeNull();
  });

  it("renders the Review Shoot Plan button for a complete plan and calls the handler on click", () => {
    const view = describeProductionPlanCard(COMPLETE_PLAN) as ProductionPlanCardView;
    const onReviewShootPlan = vi.fn();
    render(<ComposeShootPlanCard plan={view} onReviewShootPlan={onReviewShootPlan} />);

    const button = screen.getByTestId("compose-shoot-plan-review-button");
    fireEvent.click(button);
    expect(onReviewShootPlan).toHaveBeenCalledTimes(1);
  });

  it("never shows Review Shoot Plan for a needs_input plan, even with a handler provided", () => {
    const view = describeProductionPlanCard(NEEDS_INPUT_PLAN) as ProductionPlanCardView;
    render(<ComposeShootPlanCard plan={view} onReviewShootPlan={vi.fn()} />);

    expect(screen.queryByTestId("compose-shoot-plan-review-button")).toBeNull();
  });
});
