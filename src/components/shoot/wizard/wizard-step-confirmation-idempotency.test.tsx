// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../shoot-wizard-shell.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

const reviewStartIds: string[] = [];
vi.mock("@/components/shoot/shoot-plan-review-session", () => ({
  ShootPlanReviewSession: ({
    reviewStartId,
    onStartFailed,
  }: {
    reviewStartId?: string;
    onStartFailed?: () => void;
  }) => {
    reviewStartIds.push(reviewStartId ?? "");
    return <button type="button" onClick={onStartFailed}>Fail staging</button>;
  },
}));

import { WizardStepConfirmation } from "./wizard-step-confirmation";
import type { ShootPlan } from "@/mastra/tools/plan-schema";

const PLAN = {
  status: "complete",
  productRefs: [],
  missingInputs: [],
  warnings: [],
} as unknown as ShootPlan;

afterEach(() => {
  cleanup();
  reviewStartIds.length = 0;
});

describe("WizardStepConfirmation review-start identity", () => {
  it("reuses one stable reviewStartId after a staging failure and retry", () => {
    function Harness() {
      const [started, setStarted] = useState(false);
      return (
        <WizardStepConfirmation
          plan={PLAN}
          brandId="22222222-2222-4222-8222-222222222222"
          reviewStarted={started}
          saving={false}
          saveError={null}
          onReviewStart={() => setStarted(true)}
          onReviewStartFailed={() => setStarted(false)}
          onReviewSettled={() => {}}
          onRetrySave={() => {}}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Review exact plan" }));
    expect(reviewStartIds[0]).toMatch(/^[0-9a-f-]{36}$/i);

    fireEvent.click(screen.getByRole("button", { name: "Fail staging" }));
    fireEvent.click(screen.getByRole("button", { name: "Review exact plan" }));

    expect(reviewStartIds.at(-1)).toBe(reviewStartIds[0]);
  });
});