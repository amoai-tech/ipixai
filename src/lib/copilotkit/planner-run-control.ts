import { randomUUID } from "node:crypto";
import { EventType, type BaseEvent } from "@ag-ui/client";

export type PlannerRunControlMessage =
  | { kind: "probe"; requestId: string }
  | { kind: "probe_ack"; requestId: string; runId: string; ownerInstanceId: string }
  | { kind: "connect"; requestId: string }
  | { kind: "connect_ack"; requestId: string; runId: string; ownerInstanceId: string }
  | { kind: "stop"; requestId: string; runId: string; ownerId?: string }
  | { kind: "stop_ack"; requestId: string; runId: string; stopped: boolean; ownerInstanceId: string }
  | { kind: "event"; runId: string; seq: number; event: BaseEvent; replayFor?: string };

export interface PlannerRunControlBus {
  send(message: PlannerRunControlMessage): Promise<void>;
  onMessage(handler: (message: PlannerRunControlMessage) => void): () => void;
  close(): Promise<void>;
}

export type OpenPlannerRunControlBus = (threadId: string) => Promise<PlannerRunControlBus>;

function boundedString(value: unknown, max = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

export function isPlannerRunControlMessage(value: unknown): value is PlannerRunControlMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  const kind = message.kind;
  if (kind === "probe" || kind === "connect") return boundedString(message.requestId, 128);
  if (kind === "probe_ack" || kind === "connect_ack") {
    return boundedString(message.requestId, 128) && boundedString(message.runId) && boundedString(message.ownerInstanceId, 128);
  }
  if (kind === "stop") return boundedString(message.requestId, 128) && boundedString(message.runId) &&
    (message.ownerId === undefined || boundedString(message.ownerId));
  if (kind === "stop_ack") {
    return boundedString(message.requestId, 128) && boundedString(message.runId) && typeof message.stopped === "boolean" && boundedString(message.ownerInstanceId, 128);
  }
  if (kind === "event") {
    const event = message.event;
    return boundedString(message.runId) &&
      typeof message.seq === "number" &&
      Number.isSafeInteger(message.seq) && message.seq >= 0 &&
      (message.replayFor === undefined || boundedString(message.replayFor, 128)) &&
      !!event &&
      typeof event === "object" &&
      !Array.isArray(event) &&
      boundedString((event as Record<string, unknown>).type, 128);
  }
  return false;
}

export type PlannerRunControlLogger = (message: string, details?: Record<string, unknown>) => void;

const DEFAULT_TIMEOUT_MS = 1_500;
// Never retain an entire unbounded active-run AG-UI transcript in one Vercel process.
// If the replay cap is reached, deny new remote connections rather than send a
// partial transcript that could corrupt the controller's AG-UI state.
const MAX_REPLAY_EVENTS = 2_048;
const MAX_REPLAY_BYTES = 2_000_000;
const MAX_RECENT_CONNECTS = 32;
const CONNECT_RETRY_RETENTION_MS = 30_000;
const RETRY_FRACTIONS = [0.05, 0.15, 0.3, 0.3] as const;
export const plannerRuntimeInstanceId = randomUUID();
export interface PlannerRunOwnerHandle {
  publish(event: BaseEvent): Promise<void>;
  close(terminal?: BaseEvent): Promise<void>;
}

export interface PlannerRemoteRunConnection {
  readonly runId: string;
  readonly ownerInstanceId: string;
  onEvent(handler: (event: BaseEvent) => void): () => void;
  close(): Promise<void>;
}

type ProbeAck = Extract<PlannerRunControlMessage, { kind: "probe_ack" }>;
type ConnectAck = Extract<PlannerRunControlMessage, { kind: "connect_ack" }>;
type StopAck = Extract<PlannerRunControlMessage, { kind: "stop_ack" }>;

type Settler<T> = {
  promise: Promise<T>;
  settle: (value: T) => void;
  cancel: () => void;
  isSettled: () => boolean;
};

function settleAfter<T>(timeoutMs: number, fallback: T): Settler<T> {
  let settled = false;
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (resolvePromise = resolve));
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    resolvePromise(fallback);
  }, timeoutMs);
  timer.unref?.();
  return {
    promise,
    settle(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(value);
    },
    cancel() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(fallback);
    },
    isSettled: () => settled,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

async function sendUntilSettled<T>(
  bus: PlannerRunControlBus,
  message: PlannerRunControlMessage,
  waiter: Settler<T>,
  timeoutMs: number,
): Promise<void> {
  await bus.send(message);
  for (const fraction of RETRY_FRACTIONS) {
    if (waiter.isSettled()) return;
    const waitMs = Math.max(10, Math.floor(timeoutMs * fraction));
    await Promise.race([waiter.promise.then(() => undefined), delay(waitMs)]);
    if (waiter.isSettled()) return;
    await bus.send(message);
  }
}

export class PlannerRunControl {
  constructor(
    private readonly openBus: OpenPlannerRunControlBus,
    private readonly options: {
      instanceId?: string;
      timeoutMs?: number;
      log?: PlannerRunControlLogger;
    } = {},
  ) {}

  private get instanceId(): string {
    return this.options.instanceId ?? plannerRuntimeInstanceId;
  }

  private get timeoutMs(): number {
    return this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private log(message: string, details?: Record<string, unknown>) {
    this.options.log?.(message, details);
  }

  async own(
    threadId: string,
    runId: string,
    stopLocal: (runId: string) => Promise<boolean>,
    ownerId?: string,
  ): Promise<PlannerRunOwnerHandle> {
    const bus = await this.openBus(threadId);
    // One stop operation per run, regardless of the controller's request ID.
    let stopResult: Promise<boolean> | undefined;
    // Keep only a bounded window of request IDs so repeated connect retries
    // share the same replay delivery, including any failed delivery result.
    const connectRequests = new Map<string, { startedAt: number; replayDelivery: Promise<void> }>();
    const replayBuffer: Array<{ seq: number; event: BaseEvent }> = [];
    let nextEventSeq = 0;
    let replayBytes = 0;
    let replayAvailable = true;
    // Sticky by design: an active client can briefly disconnect and reconnect.
    // Sending a few extra live broadcasts is safer than missing that transition.
    let remoteListener = false;
    let terminalPublished = false;
    let closed = false;
    let sendQueue = Promise.resolve();
    const enqueue = (message: PlannerRunControlMessage): Promise<void> => {
      const send = sendQueue.then(() => {
        if (closed) return;
        return bus.send(message);
      });
      // Keep the queue usable after a failed send, but log it and return the
      // ORIGINAL rejected promise to the awaiting caller. Never turn a failed
      // replay send into a successful connect acknowledgement.
      sendQueue = send.catch((error) => {
        if (message.kind === "event") {
          // A missed live event can corrupt a later reconnect too. Never ACK
          // a partial AG-UI transcript after any owner event send fails.
          replayAvailable = false;
          replayBuffer.length = 0;
          replayBytes = 0;
        }
        this.log("owner_send_failed", {
          kind: message.kind,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return send;
    };
    const off = bus.onMessage((message) => {
      const respond = async () => {
        if (closed) return;
        if (message.kind === "probe") {
          await enqueue({ kind: "probe_ack", requestId: message.requestId, runId, ownerInstanceId: this.instanceId });
          return;
        }
        if (message.kind === "connect") {
          if (!replayAvailable) {
            this.log("owner_connect_replay_unavailable", { runId });
            return; // fail closed: controller times out; no partial AG-UI stream
          }
          // Mark interest before replay starts so simultaneous live events are
          // not lost while a new controller is catching up.
          remoteListener = true;
          const now = Date.now();
          for (const [id, entry] of connectRequests) {
            if (now - entry.startedAt > CONNECT_RETRY_RETENTION_MS) connectRequests.delete(id);
          }
          let entry = connectRequests.get(message.requestId);
          if (!entry) {
            if (connectRequests.size >= MAX_RECENT_CONNECTS) {
              this.log("owner_connect_limit_exceeded", { runId });
              return;
            }
            // Queue in FIFO order. Promise.all observes failures from EVERY
            // replay send. Retry of the same request cannot ACK skipped replay.
            const replayDelivery = Promise.all(
              replayBuffer.map(({ seq, event }) =>
                enqueue({ kind: "event", runId, seq, event, replayFor: message.requestId }),
              ),
            ).then(() => undefined);
            entry = { startedAt: now, replayDelivery };
            connectRequests.set(message.requestId, entry);
          }
          await entry.replayDelivery;
          // A live event can be queued while replay sends are in flight.
          // Wait for everything already queued before accepting the controller:
          // otherwise a failed live event could be followed by a valid ACK.
          await sendQueue;
          if (!replayAvailable) {
            this.log("owner_connect_replay_unavailable", { runId });
            return;
          }
          await enqueue({ kind: "connect_ack", requestId: message.requestId, runId, ownerInstanceId: this.instanceId });
          return;
        }
        if (message.kind === "stop") {
          if (message.runId !== runId) return;
          // The bus topic is tenant-scoped, but an exact runId alone must not
          // grant Stop to a different owner on another runtime instance.
          // Absent ownerId is the server owner, never a wildcard.
          if (message.ownerId !== ownerId) {
            await enqueue({
              kind: "stop_ack",
              requestId: message.requestId,
              runId,
              stopped: false,
              ownerInstanceId: this.instanceId,
            });
            return;
          }
          if (!stopResult) {
            stopResult = stopLocal(runId).then(
              (stopped) => {
                // A false result is not a completed stop: a run may still be
                // starting, so a subsequent exact-run request can try again.
                if (!stopped) stopResult = undefined;
                return stopped;
              },
              (error) => {
                stopResult = undefined;
                throw error;
              },
            );
          }
          const stopped = await stopResult;
          const ack: StopAck = {
            kind: "stop_ack",
            requestId: message.requestId,
            runId,
            stopped,
            ownerInstanceId: this.instanceId,
          };
          if (!closed) await enqueue(ack);
        }
      };
      void respond().catch((error) => {
        this.log("owner_control_message_failed", {
          kind: message.kind,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    const publishEvent = async (event: BaseEvent) => {
      if (closed) return;
      const seq = nextEventSeq++;
      if (!Number.isSafeInteger(seq)) throw new Error("planner_run_sequence_overflow");
      if (event.type === EventType.RUN_FINISHED || event.type === EventType.RUN_ERROR) {
        terminalPublished = true;
      }
      if (replayAvailable) {
        let bytes = MAX_REPLAY_BYTES + 1;
        try {
          bytes = Buffer.byteLength(JSON.stringify(event), "utf8");
        } catch {
          // A non-serializable event cannot be safely replayed by Broadcast.
        }
        if (replayBuffer.length >= MAX_REPLAY_EVENTS || replayBytes + bytes > MAX_REPLAY_BYTES) {
          replayAvailable = false;
          replayBuffer.length = 0;
          replayBytes = 0;
          this.log("owner_replay_limit_exceeded", { runId });
        } else {
          replayBuffer.push({ seq, event });
          replayBytes += bytes;
        }
      }
      if (remoteListener) await enqueue({ kind: "event", runId, seq, event });
    };

    let closePromise: Promise<void> | undefined;
    return {
      publish: publishEvent,
      close: (terminal) => {
        if (closed) return Promise.resolve();
        if (closePromise) return closePromise;
        closePromise = (async () => {
          try {
            if (terminal) {
              await publishEvent(terminal);
            } else if (remoteListener && !terminalPublished) {
              await publishEvent({
                type: EventType.RUN_ERROR,
                message: "planner_run_owner_closed",
              } as BaseEvent);
            }
          } catch (error) {
            // Transport failure must not prevent releasing the subscription
            // or retaining the in-memory replay indefinitely.
            this.log("owner_terminal_send_failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          } finally {
            closed = true;
            connectRequests.clear();
            replayBuffer.length = 0;
            replayBytes = 0;
            off();
            await sendQueue;
            await bus.close();
          }
        })();
        return closePromise;
      },
    };
  }

  private async request<T extends ProbeAck | StopAck>(
    threadId: string,
    message: Extract<PlannerRunControlMessage, { kind: "probe" | "stop" }>,
    matches: (message: PlannerRunControlMessage) => message is T,
  ): Promise<T | null> {
    const bus = await this.openBus(threadId);
    const waiter = settleAfter<T | null>(this.timeoutMs, null);
    const off = bus.onMessage((incoming) => {
      if (matches(incoming)) waiter.settle(incoming);
    });
    try {
      await sendUntilSettled(bus, message, waiter, this.timeoutMs);
      return await waiter.promise;
    } finally {
      waiter.cancel();
      off();
      await bus.close();
    }
  }

  async probe(threadId: string): Promise<ProbeAck | null> {
    const requestId = randomUUID();
    return this.request(threadId, { kind: "probe", requestId }, (message): message is ProbeAck =>
      message.kind === "probe_ack" && message.requestId === requestId,
    );
  }

  async isRunning(threadId: string): Promise<boolean> {
    return (await this.probe(threadId)) !== null;
  }

  async stop(threadId: string, runId: string, ownerId?: string): Promise<StopAck | null> {
    const requestId = randomUUID();
    return this.request(threadId, { kind: "stop", requestId, runId, ...(ownerId !== undefined ? { ownerId } : {}) }, (message): message is StopAck =>
      message.kind === "stop_ack" && message.requestId === requestId && message.runId === runId,
    );
  }

  async connect(threadId: string): Promise<PlannerRemoteRunConnection | null> {
    const bus = await this.openBus(threadId);
    const requestId = randomUUID();
    const waiter = settleAfter<ConnectAck | null>(this.timeoutMs, null);
    const buffered: Array<{ runId: string; seq: number; event: BaseEvent }> = [];
    const listeners = new Set<(event: BaseEvent) => void>();
    const lastDeliveredSeq = { value: -1 };
    let activeRunId: string | undefined;
    let closed = false;
    const off = bus.onMessage((message) => {
      if (message.kind === "connect_ack" && message.requestId === requestId) {
        // A thread can briefly have overlapping owners during run turnover.
        // The first matching ACK defines this connection; later ACKs for the
        // same request must not silently retarget its live-event filter.
        if (waiter.isSettled() || activeRunId !== undefined) return;
        activeRunId = message.runId;
        waiter.settle(message);
        return;
      }
      if (message.kind !== "event") return;
      if (message.replayFor !== undefined && message.replayFor !== requestId) return;
      if (activeRunId && message.runId !== activeRunId) return;
      if (message.seq <= lastDeliveredSeq.value) return;
      if (listeners.size === 0) {
        buffered.push({ runId: message.runId, seq: message.seq, event: message.event });
        return;
      }
      if (message.runId === activeRunId) {
        lastDeliveredSeq.value = message.seq;
        for (const listener of listeners) listener(message.event);
      }
    });

    try {
      await sendUntilSettled(bus, { kind: "connect", requestId }, waiter, this.timeoutMs);
      const ack = await waiter.promise;
      if (!ack) {
        off();
        await bus.close();
        return null;
      }
      activeRunId = ack.runId;
      return this.remoteConnection(bus, off, ack, buffered, listeners,
        lastDeliveredSeq,
        () => closed, (value) => { closed = value; },
      );
    } catch (error) {
      waiter.cancel();
      off();
      await bus.close();
      throw error;
    }
  }

  private remoteConnection(
    bus: PlannerRunControlBus,
    off: () => void,
    ack: ConnectAck,
    buffered: Array<{ runId: string; seq: number; event: BaseEvent }>,
    listeners: Set<(event: BaseEvent) => void>,
    lastDeliveredSeq: { value: number },
    isClosed: () => boolean,
    setClosed: (value: boolean) => void,
  ): PlannerRemoteRunConnection {
    return {
      runId: ack.runId,
      ownerInstanceId: ack.ownerInstanceId,
      onEvent(handler) {
        if (isClosed()) return () => {};
        listeners.add(handler);
        // Live events can reach a newly joined tab before its own replay.
        // Sort the initial snapshot and discard replay/live duplicates.
        const pending = buffered.splice(0, buffered.length)
          .filter((item) => item.runId === ack.runId)
          .sort((a, b) => a.seq - b.seq);
        for (const item of pending) {
          if (item.seq <= lastDeliveredSeq.value) continue;
          lastDeliveredSeq.value = item.seq;
          handler(item.event);
        }
        return () => listeners.delete(handler);
      },
      async close() {
        if (isClosed()) return;
        setClosed(true);
        listeners.clear();
        buffered.length = 0;
        off();
        await bus.close();
      },
    };
  }
}
