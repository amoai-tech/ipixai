// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./shoot-plan-review", () => ({
  ShootPlanReview: ({ identity, onSettled, onRevised }: {
    identity: { approvalId: string; brandId: string; revision: number; planHash: string };
    onSettled?: (outcome: { decision: string; resumeState: string; message: string }) => void;
    onRevised?: (identity: { approvalId: string; brandId: string; revision: number; planHash: string }) => void;
  }) => (
    <div data-testid="mock-plan-review">
      <span>{identity.approvalId}</span>
      <button type="button" onClick={() => onRevised?.({ approvalId: "approval-2", brandId: "brand-1", revision: 2, planHash: "hash-2" })}>Revise</button>
      <button type="button" onClick={() => onSettled?.({ decision: "approved", resumeState: "approved", message: "Approved" })}>Approve</button>
    </div>
  ),
}));

import { ShootPlanReviewSession } from "./shoot-plan-review-session";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShootPlanReviewSession latest approval identity", () => {
  it("settles with the latest revised approval identity", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/plans/references")) {
        return Promise.resolve({ ok: true, json: async () => ({ references: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ approvalId: "approval-1", brandId: "brand-1", revision: 1, planHash: "hash-1" }),
      });
    });
    const onSettled = vi.fn();

    render(<ShootPlanReviewSession brandId="brand-1" plan={{ status: "complete" }} onSettled={onSettled} />);
    await screen.findByTestId("mock-plan-review");

    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    await waitFor(() => expect(screen.getByTestId("mock-plan-review").textContent).toContain("approval-2"));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(onSettled).toHaveBeenCalledWith(
      { decision: "approved", resumeState: "approved", message: "Approved" },
      { approvalId: "approval-2", brandId: "brand-1", revision: 2, planHash: "hash-2" },
    );
  });
});
