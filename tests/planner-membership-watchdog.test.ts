import { afterEach, describe, expect, it, vi } from "vitest";

import {
  startPlannerMembershipWatchdog,
  type PlannerMembershipState,
} from "@/lib/auth/planner-membership-watchdog";

describe("Planner membership watchdog", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts once when the membership disappears and ignores transient errors", async () => {
    vi.useFakeTimers();
    let state: PlannerMembershipState = "member";
    const onRevoked = vi.fn();

    const watchdog = startPlannerMembershipWatchdog({
      check: async () => state,
      onRevoked,
      intervalMs: 1_000,
      maxMs: 60_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).not.toHaveBeenCalled();

    state = "error";
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).not.toHaveBeenCalled();

    state = "missing";
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(onRevoked).toHaveBeenCalledTimes(1);
    watchdog.stop();
  });

  it("treats check exceptions as transient errors", async () => {
    vi.useFakeTimers();
    let shouldThrow = false;
    const onRevoked = vi.fn();
    const watchdog = startPlannerMembershipWatchdog({
      check: async () => {
        if (shouldThrow) throw new Error("db down");
        return "member";
      },
      onRevoked,
      intervalMs: 1_000,
      maxMs: 60_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).not.toHaveBeenCalled();

    shouldThrow = true;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).not.toHaveBeenCalled();

    shouldThrow = false;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).not.toHaveBeenCalled();
    watchdog.stop();
  });

  it("can be stopped before a later check runs", async () => {
    vi.useFakeTimers();
    let state: PlannerMembershipState = "member";
    const onRevoked = vi.fn();
    const watchdog = startPlannerMembershipWatchdog({
      check: async () => state,
      onRevoked,
      intervalMs: 1_000,
      maxMs: 60_000,
    });

    watchdog.stop();
    state = "missing";
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onRevoked).not.toHaveBeenCalled();
  });

  it("fails closed at the maximum lifetime and stops checking", async () => {
    vi.useFakeTimers();
    const check = vi.fn(async () => "member" as PlannerMembershipState);
    const onRevoked = vi.fn();
    startPlannerMembershipWatchdog({
      check,
      onRevoked,
      intervalMs: 1_000,
      maxMs: 2_500,
    });

    await vi.advanceTimersByTimeAsync(2_000);
    expect(check.mock.calls.length).toBeGreaterThan(0);
    expect(onRevoked).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(onRevoked).toHaveBeenCalledTimes(1);
    const callsAtStop = check.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(check.mock.calls.length).toBe(callsAtStop);
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });

  it("fails closed after persistent membership errors", async () => {
    vi.useFakeTimers();
    const onRevoked = vi.fn();
    startPlannerMembershipWatchdog({
      check: async () => "error",
      onRevoked,
      intervalMs: 1_000,
      maxConsecutiveErrors: 2,
      maxMs: 60_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });

  it("times out a hung membership check and fails closed", async () => {
    vi.useFakeTimers();
    const onRevoked = vi.fn();
    let querySignal: AbortSignal | undefined;
    startPlannerMembershipWatchdog({
      check: (signal) => {
        querySignal = signal;
        return new Promise<PlannerMembershipState>(() => {});
      },
      onRevoked,
      intervalMs: 1_000,
      checkTimeoutMs: 500,
      maxConsecutiveErrors: 1,
      maxMs: 60_000,
    });

    await vi.advanceTimersByTimeAsync(1_500);
    expect(querySignal?.aborted).toBe(true);
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });
  it("does not overlap a pending check and detects missing membership on the next tick", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: PlannerMembershipState) => void;
    let checks = 0;
    const onRevoked = vi.fn();
    startPlannerMembershipWatchdog({
      check: async () => {
        checks += 1;
        if (checks === 1) return new Promise<PlannerMembershipState>((resolve) => { resolveFirst = resolve; });
        return "missing";
      },
      onRevoked,
      intervalMs: 1_000,
      checkTimeoutMs: 4_000,
      maxMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(checks).toBe(1);
    resolveFirst("member");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });

  it("stops permanently even when onRevoked throws", async () => {
    vi.useFakeTimers();
    const check = vi.fn(async () => "missing" as PlannerMembershipState);
    const onRevoked = vi.fn(() => { throw new Error("caller failed"); });
    startPlannerMembershipWatchdog({ check, onRevoked, intervalMs: 1_000, maxMs: 60_000 });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(check).toHaveBeenCalledTimes(1);
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });

  it("resets the failure count after successful membership verification", async () => {
    vi.useFakeTimers();
    const states: PlannerMembershipState[] = ["error", "member", "error", "error"];
    const onRevoked = vi.fn();
    startPlannerMembershipWatchdog({
      check: async () => states.shift() ?? "member",
      onRevoked,
      intervalMs: 1_000,
      maxConsecutiveErrors: 2,
      maxMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(onRevoked).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });

  it("aborts an active membership lookup when the watchdog stops", async () => {
    vi.useFakeTimers();
    let activeSignal: AbortSignal | undefined;
    const onRevoked = vi.fn();
    const watchdog = startPlannerMembershipWatchdog({
      check: async (signal) => {
        activeSignal = signal;
        return new Promise<PlannerMembershipState>(() => {});
      },
      onRevoked,
      intervalMs: 1_000,
      checkTimeoutMs: 4_000,
      maxMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(activeSignal?.aborted).toBe(false);
    watchdog.stop();
    expect(activeSignal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onRevoked).not.toHaveBeenCalled();
  });

});
