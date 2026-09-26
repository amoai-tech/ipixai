// @vitest-environment jsdom
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
import GlobalError from "@/app/global-error";

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

  it("reports a client global error once and preserves retry UX", () => {
    const error = new Error("global client failure");
    const reset = vi.fn();

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <StrictMode>
        <GlobalError error={error} reset={reset} />
      </StrictMode>,
    );
    expect(
      consoleError.mock.calls.every(call => String(call[0]).includes("cannot be a child of")),
    ).toBe(true);
    consoleError.mockRestore();

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does not recapture a digest-bearing server render error in the browser", () => {
    const error = Object.assign(new Error("sanitized server failure"), { digest: "server-digest" });
    const reset = vi.fn();

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalError error={error} reset={reset} />);
    expect(
      consoleError.mock.calls.every(call => String(call[0]).includes("cannot be a child of")),
    ).toBe(true);
    consoleError.mockRestore();

    expect(captureException).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
