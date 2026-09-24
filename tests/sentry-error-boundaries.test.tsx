// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException }));

vi.mock("@/components/ui/error-state", () => ({
  ErrorState: ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div>
      <span>{message}</span>
      {onRetry ? <button onClick={onRetry}>Try again</button> : null}
    </div>
  ),
}));

import AppPlansError from "@/app/app/plans/error";
import AppPlanDetailError from "@/app/app/plans/[instanceId]/error";

afterEach(() => {
  cleanup();
  captureException.mockClear();
});

describe("Sentry App Router error boundaries", () => {
  it("reports the plans error once and preserves retry UX", () => {
    const error = new Error("plans failed");
    const reset = vi.fn();
    render(
      <StrictMode>
        <AppPlansError error={error} reset={reset} />
      </StrictMode>,
    );

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);
    expect(screen.getByText("Something went wrong loading plans. Please try again shortly.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reports the plan-detail error once and preserves retry UX", () => {
    const error = new Error("detail failed");
    const reset = vi.fn();
    render(
      <StrictMode>
        <AppPlanDetailError error={error} reset={reset} />
      </StrictMode>,
    );

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);
    expect(screen.getByText("Couldn't load this plan. Please try again shortly.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("provides a global boundary that reports the provided error", () => {
    const path = join(process.cwd(), "src/app/global-error.tsx");
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;

    const source = readFileSync(path, "utf8");
    expect(source).toContain("captureExceptionOnce(error)");
    expect(source).toContain("Something went wrong");
  });
});
