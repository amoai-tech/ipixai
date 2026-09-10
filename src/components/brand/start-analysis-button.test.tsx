// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * IPI-1093 · BRAND-INTEL-001 (task-verifier finding) — startBrandAnalysis's
 * workflow.startAsync() is fire-and-forget, so an immediate router.refresh()
 * can render before the backend's first step commits. Proves the lightweight
 * fix: a local "started" status shows during the brief settle pause, and
 * refresh only fires after it.
 */

const mocks = vi.hoisted(() => ({
  startBrandAnalysisAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/app/brands/[brandId]/actions", () => ({
  startBrandAnalysisAction: mocks.startBrandAnalysisAction,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { StartAnalysisButton } from "./start-analysis-button";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("StartAnalysisButton", () => {
  it("shows a local 'started' status before refreshing, then refreshes", async () => {
    mocks.startBrandAnalysisAction.mockResolvedValue({ ok: true, message: "Brand analysis started." });

    render(<StartAnalysisButton brandId="b1" label="Start analysis" />);
    fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));

    await screen.findByText(/analysis started/i);
    expect(mocks.refresh).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("on failure, shows the error and never refreshes", async () => {
    mocks.startBrandAnalysisAction.mockResolvedValue({ ok: false, message: "Could not start the analysis." });

    render(<StartAnalysisButton brandId="b1" label="Start analysis" />);
    fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not start the analysis.");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
