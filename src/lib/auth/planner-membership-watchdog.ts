/**
 * Abort an in-flight Planner request when the operator loses membership in the
 * organization the run was authorized for.
 *
 * Authorization is evaluated once when the request starts. A long model stream
 * would otherwise keep delivering output after the operator is removed from the
 * organization. This watchdog re-checks the existing membership row on a bounded
 * interval and calls onRevoked once when it disappears. A lookup that hangs or
 * fails repeatedly is treated as unverifiable and fails closed; a single
 * transient error is retried.
 */
export type PlannerMembershipState = "member" | "missing" | "error";

export type PlannerMembershipWatchdog = {
  stop: () => void;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("membership check timed out")), timeoutMs);
    if (typeof timer === "object") timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function startPlannerMembershipWatchdog(options: {
  check: () => Promise<PlannerMembershipState>;
  onRevoked: () => void;
  intervalMs?: number;
  checkTimeoutMs?: number;
  maxConsecutiveErrors?: number;
  maxMs?: number;
}): PlannerMembershipWatchdog {
  const intervalMs = options.intervalMs ?? 5_000;
  const checkTimeoutMs = options.checkTimeoutMs ?? 4_000;
  const maxConsecutiveErrors = options.maxConsecutiveErrors ?? 3;
  const maxMs = options.maxMs ?? 300_000;
  let stopped = false;
  let checking = false;
  let consecutiveErrors = 0;
  let interval: ReturnType<typeof setInterval> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (interval) clearInterval(interval);
    if (maxTimer) clearTimeout(maxTimer);
  };

  const revoke = () => {
    stop();
    try {
      options.onRevoked();
    } catch {
      // The request signal is already the safety boundary; a throwing callback
      // must not leave the interval running.
    }
  };

  const tick = async () => {
    if (stopped || checking) return;
    checking = true;
    try {
      const state = await withTimeout(options.check(), checkTimeoutMs);
      if (stopped) return;
      if (state === "missing") {
        revoke();
        return;
      }
      if (state === "error") {
        consecutiveErrors += 1;
      } else {
        consecutiveErrors = 0;
      }
    } catch (error) {
      consecutiveErrors += 1;
      console.warn("[planner] membership check failed", {
        consecutiveErrors,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      checking = false;
    }

    if (!stopped && consecutiveErrors >= maxConsecutiveErrors) {
      console.warn("[planner] membership cannot be verified; aborting Planner stream", {
        consecutiveErrors,
      });
      revoke();
    }
  };

  interval = setInterval(() => {
    void tick();
  }, intervalMs);
  maxTimer = setTimeout(revoke, maxMs);
  if (typeof interval === "object") interval.unref?.();
  if (typeof maxTimer === "object") maxTimer.unref?.();

  return { stop };
}
