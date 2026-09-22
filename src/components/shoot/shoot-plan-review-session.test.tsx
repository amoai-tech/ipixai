// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShootPlanReviewSession } from "./shoot-plan-review-session";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ShootPlanReviewSession", () => {
  it("times out a hung review-start request and exposes retry through onStartFailed", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes("/api/plans/references")) {
        return Promise.resolve({ ok: true, json: async () => ({ references: [] }) });
      }
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    const onStartFailed = vi.fn();
    render(<ShootPlanReviewSession brandId="brand-1" plan={{ status: "complete" }} onStartFailed={onStartFailed} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
      await Promise.resolve();
    });
    expect(onStartFailed).toHaveBeenCalledTimes(1);
  });
});
