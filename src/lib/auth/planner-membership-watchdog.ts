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

function withTimeout<T>(
  check: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  controller: AbortController,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("membership check timed out"));
    }, timeoutMs);
    if (typeof timer === "object") timer.unref?.();
    // Run asynchronously so stop() can cancel before a check begins.
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) throw new Error("membership check canceled");
        return check(controller.signal);
      })
      .then(
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
  check: (signal: AbortSignal) => Promise<PlannerMembershipState>;
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
  let activeCheck: AbortController | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    activeCheck?.abort();
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
    const checkController = new AbortController();
    activeCheck = checkController;
    try {
      const state = await withTimeout(options.check, checkTimeoutMs, checkController);
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
      if (activeCheck === checkController) activeCheck = undefined;
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

/**
 * Keep the actual response body behind the same abort boundary as the Planner.
 * A controller error discards queued protected data; close() alone would still
 * allow previously queued chunks to reach a revoked user.
 */
export function guardPlannerResponseStream(
  response: Response,
  signal: AbortSignal,
  cleanup: () => void,
): Response {
  if (!response.body) {
    cleanup();
    return response;
  }

  const reader = response.body.getReader();
  let ended = false;
  let abortListener: (() => void) | undefined;
  const finish = () => {
    if (ended) return false;
    ended = true;
    if (abortListener) signal.removeEventListener("abort", abortListener);
    cleanup();
    return true;
  };

  const guardedBody = new ReadableStream<Uint8Array>({
    start(controller) {
      abortListener = () => {
        if (!finish()) return;
        // Abort discards any queued SSE events, including a pending read.
        controller.error(new DOMException("Planner request aborted", "AbortError"));
        void reader.cancel().catch(() => undefined);
      };
      if (signal.aborted) abortListener();
      else signal.addEventListener("abort", abortListener, { once: true });
    },
    async pull(controller) {
      if (ended) return;
      try {
        const { done, value } = await reader.read();
        // Membership can be revoked while the upstream read is pending.
        if (ended) return;
        if (done) {
          finish();
          controller.close();
        } else if (value) {
          controller.enqueue(value);
        }
      } catch (error) {
        if (!finish()) return;
        controller.error(error);
      }
    },
    cancel(reason) {
      if (!finish()) return;
      return reader.cancel(reason);
    },
  });

  return new Response(guardedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
