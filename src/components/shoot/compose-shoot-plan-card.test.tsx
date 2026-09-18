// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
  });

  it("omits the objective and shot list for a needs_input plan instead of fabricating them", () => {
    const view = describeProductionPlanCard(NEEDS_INPUT_PLAN);
    expect(view?.status).toBe("needs_input");
    expect(view?.objective).toBeNull();
    expect(view?.shots).toEqual([]);
    expect(view?.totalShots).toBeNull();
    expect(view?.missingInputs).toEqual(["location", "crew", "schedule"]);
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
  });
});
