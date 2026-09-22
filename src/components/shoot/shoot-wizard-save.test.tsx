// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./shoot-wizard-shell.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

const mocks = vi.hoisted(() => ({
  compose: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/app/app/shoots/new/actions", () => ({
  composeShootPlanForWizard: mocks.compose,
}));

vi.mock("@/components/shoot/shoot-plan-review-session", () => ({
  ShootPlanReviewSession: ({ onSettled }: {
    onSettled?: (
      outcome: { decision: string; resumeState: string; message: string },
      identity: { approvalId: string; brandId: string; revision: number; planHash: string },
    ) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSettled?.(
        { decision: "approved", resumeState: "approved", message: "Approved" },
        { approvalId: "approval-1", brandId: "brand-1", revision: 1, planHash: "hash-1" },
      )}
    >
      Approve staged plan
    </button>
  ),
}));

import { ShootWizardShell } from "./shoot-wizard-shell";

const fetchMock = vi.fn();
const BRANDS = [{ id: "brand-1", name: "Everlane" }];
const PLAN = {
  status: "complete",
  productRefs: [],
  missingInputs: [],
  warnings: [],
  deliverablesResult: { status: "ok", deliverables: [], assumptions: [], warnings: [], missingInputs: [], totalAssets: 0 },
  shotListResult: null,
  budgetResult: { status: "ok", total: 100, currency: "USD", assumptions: [], warnings: [], missingInputs: [] },
};

function fillWizardToConfirmation() {
  fireEvent.change(screen.getByLabelText("Shoot name"), { target: { value: "SS26 Campaign" } });
  fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "photo" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Studio 1" } });
  fireEvent.click(screen.getByLabelText("IG Feed"));
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fill("Objective", "Launch");
  fill("Brief", "Clean premium campaign");
  fill("Lighting", "Soft daylight");
  fill("Set / background", "Warm neutral cyc");
  fill("Talent", "One model");
  fill("Crew description", "Lean ecommerce crew");
  fill("Crew size", "4");
  fill("Studio", "Studio 1");
  fill("Studio type", "rental");
  fill("Equipment", "Camera, lenses, lighting");
  fill("Schedule start", "2026-10-01");
  fill("Schedule end", "2026-10-01");
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
}

async function advanceToReview() {
  await screen.findByTestId("wizard-deliverables");
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(screen.getByRole("button", { name: "Review exact plan" }));
  await screen.findByRole("button", { name: "Approve staged plan" });
}

beforeEach(() => {
  mocks.compose.mockReset();
  mocks.push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mocks.compose.mockResolvedValue({ ok: true, plan: PLAN });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShootWizardShell approved-plan save handoff", () => {
  it("sends only approvalId to the canonical save route and navigates to the returned shoot", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, shootId: "shoot-1", replayed: false }),
    });

    render(<ShootWizardShell brands={BRANDS} />);
    fillWizardToConfirmation();
    await advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: "Approve staged plan" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/shoots/save",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvalId: "approval-1" }),
      }),
    ));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/app/shoots/shoot-1"));
  });

  it("retries the same approved locator after a save failure without asking for another review", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, error: "SAVE_FAILED" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, shootId: "shoot-1", replayed: true }) });

    render(<ShootWizardShell brands={BRANDS} />);
    fillWizardToConfirmation();
    await advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: "Approve staged plan" }));

    const retry = await screen.findByRole("button", { name: "Retry save" });
    fireEvent.click(retry);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    for (const [, init] of fetchMock.mock.calls) {
      expect(JSON.parse(String((init as RequestInit).body))).toEqual({ approvalId: "approval-1" });
    }
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/app/shoots/shoot-1"));
  });

  it("surfaces a superseded approval as an actionable reload-and-review error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "error", reason: "superseded_revision" }),
    });

    render(<ShootWizardShell brands={BRANDS} />);
    fillWizardToConfirmation();
    await advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: "Approve staged plan" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("A newer plan revision exists");
    expect(alert.textContent).toContain("review the latest revision");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});