import { EventType, type BaseEvent } from "@ag-ui/client";
import { describe, expect, it, vi } from "vitest";

import {
  PlannerRunControl,
  isPlannerRunControlMessage,
  type OpenPlannerRunControlBus,
  type PlannerRunControlBus,
  type PlannerRunControlMessage,
} from "../planner-run-control";

function network() {
  type TestBus = PlannerRunControlBus & { __deliver(message: PlannerRunControlMessage): void };
  const topics = new Map<string, Set<TestBus>>();
  let closed = 0;
  const openBus: OpenPlannerRunControlBus = async (threadId) => {
    const handlers = new Set<(message: PlannerRunControlMessage) => void>();
    const peers = topics.get(threadId) ?? new Set<TestBus>();
    let bus!: TestBus;
    bus = {
      async send(message) {
        for (const peer of peers) {
          if (peer === bus) continue;
          peer.__deliver(message);
        }
      },
      onMessage(handler) {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
      async close() {
        peers.delete(bus);
        handlers.clear();
        closed += 1;
      },
      __deliver(message: PlannerRunControlMessage) {
        for (const handler of handlers) handler(message);
      },
    } as TestBus;
    peers.add(bus);
    topics.set(threadId, peers);
    return bus;
  };
  return { openBus, closed: () => closed };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe("PlannerRunControl", () => {
  it("rejects unsequenced or unsafe replay messages on the Realtime boundary", () => {
    const sample = { kind: "event", runId: "R1", event: { type: EventType.TEXT_MESSAGE_START } };
    expect(isPlannerRunControlMessage(sample)).toBe(false);
    expect(isPlannerRunControlMessage({ ...sample, seq: -1 })).toBe(false);
    expect(isPlannerRunControlMessage({ ...sample, seq: Number.MAX_SAFE_INTEGER + 1 })).toBe(false);
    expect(isPlannerRunControlMessage({ ...sample, seq: 0 })).toBe(true);
  });

  it("probes a run owned by another runtime and relays new live events", async () => {
    const wire = network();
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 100 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const handle = await owner.own("thread-1", "R1", async () => true);

    expect(await controller.probe("thread-1")).toMatchObject({ runId: "R1", ownerInstanceId: "A" });
    const connection = await controller.connect("thread-1");
    expect(connection).toMatchObject({ runId: "R1", ownerInstanceId: "A" });

    const received: BaseEvent[] = [];
    connection?.onEvent((event) => received.push(event));
    await handle.publish({ type: EventType.TEXT_MESSAGE_START, messageId: "m1", role: "assistant" } as BaseEvent);
    expect(received).toHaveLength(1);

    await connection?.close();
    await handle.close();
  });

  it("replays active-run events emitted before remote connect, then continues live", async () => {
    const wire = network();
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 100 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const handle = await owner.own("thread-replay", "R1", async () => true);

    await handle.publish({
      type: EventType.TEXT_MESSAGE_START,
      messageId: "m-replay",
      role: "assistant",
    } as BaseEvent);
    await handle.publish({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: "m-replay",
      delta: "before-connect",
    } as BaseEvent);

    const connection = await controller.connect("thread-replay");
    expect(connection).toMatchObject({ runId: "R1", ownerInstanceId: "A" });
    const received: BaseEvent[] = [];
    connection?.onEvent((event) => received.push(event));

    expect(received.map((event) => event.type)).toEqual([
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
    ]);

    await handle.publish({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: "m-replay",
      delta: "after-connect",
    } as BaseEvent);
    expect(received).toHaveLength(3);

    await connection?.close();
    await handle.close();
  });

  it("targets replay only to the controller that requested it", async () => {
    const wire = network();
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 100 });
    const controllerB = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const controllerC = new PlannerRunControl(wire.openBus, { instanceId: "C", timeoutMs: 100 });
    const handle = await owner.own("thread-multi-controller", "R1", async () => true);

    await handle.publish({
      type: EventType.TEXT_MESSAGE_START,
      messageId: "m-multi",
      role: "assistant",
    } as BaseEvent);

    const connectionB = await controllerB.connect("thread-multi-controller");
    const receivedB: BaseEvent[] = [];
    connectionB?.onEvent((event) => receivedB.push(event));
    expect(receivedB).toHaveLength(1);

    const connectionC = await controllerC.connect("thread-multi-controller");
    const receivedC: BaseEvent[] = [];
    connectionC?.onEvent((event) => receivedC.push(event));

    expect(receivedB).toHaveLength(1);
    expect(receivedC).toHaveLength(1);

    await handle.publish({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: "m-multi",
      delta: "live",
    } as BaseEvent);
    expect(receivedB).toHaveLength(2);
    expect(receivedC).toHaveLength(2);

    await Promise.all([connectionB?.close(), connectionC?.close()]);
    await handle.close();
  });

  it("orders and deduplicates live events received before their replay in a second tab", async () => {
    const wire = network();
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 100 });
    const controllerB = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const handle = await owner.own("thread-before-replay", "R1", async () => true);
    await handle.publish({
      type: EventType.TEXT_MESSAGE_START, messageId: "m1", role: "assistant",
    } as BaseEvent);
    const tabB = await controllerB.connect("thread-before-replay");
    expect(tabB).not.toBeNull();

    const controllerC = new PlannerRunControl(async (threadId) => {
      const bus = await wire.openBus(threadId);
      return {
        ...bus,
        async send(message: PlannerRunControlMessage) {
          if (message.kind === "connect") {
            // The new controller has already subscribed. A live event lands
            // before the owner receives its request and replays that event.
            await handle.publish({
              type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m1", delta: "once",
            } as BaseEvent);
          }
          return bus.send(message);
        },
      };
    }, { instanceId: "C", timeoutMs: 100 });
    const tabC = await controllerC.connect("thread-before-replay");
    expect(tabC).not.toBeNull();
    const seen: BaseEvent[] = [];
    tabC?.onEvent((event) => seen.push(event));
    expect(seen.map((event) => event.type)).toEqual([
      EventType.TEXT_MESSAGE_START, EventType.TEXT_MESSAGE_CONTENT,
    ]);
    expect(seen.filter((event) => event.type === EventType.TEXT_MESSAGE_CONTENT)).toHaveLength(1);
    await Promise.all([tabB?.close(), tabC?.close()]);
    await handle.close();
  });

  it("stops only the exact remote run and fences stale Stop(R1)", async () => {
    const wire = network();
    const stopLocal = vi.fn(async (runId: string) => runId === "R2");
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 100 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const handle = await owner.own("thread-2", "R2", stopLocal);

    expect(await controller.stop("thread-2", "R1")).toBeNull();
    expect(await controller.stop("thread-2", "R2")).toMatchObject({ stopped: true, runId: "R2" });
    expect(stopLocal).toHaveBeenCalledTimes(1);
    expect(stopLocal).toHaveBeenCalledWith("R2");

    await handle.close();
  });

  it("ignores a non-owner Stop acknowledgement when two runs overlap on one thread", async () => {
    const wire = network();
    const stopR1 = vi.fn(async () => true);
    const stopR2 = vi.fn(async () => true);
    const owner1 = new PlannerRunControl(wire.openBus, { instanceId: "A1", timeoutMs: 100 });
    const owner2 = new PlannerRunControl(wire.openBus, { instanceId: "A2", timeoutMs: 100 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const handle1 = await owner1.own("thread-overlap", "R1", stopR1);
    const handle2 = await owner2.own("thread-overlap", "R2", stopR2);

    expect(await controller.stop("thread-overlap", "R1")).toMatchObject({
      stopped: true,
      runId: "R1",
      ownerInstanceId: "A1",
    });
    expect(stopR1).toHaveBeenCalledWith("R1");
    expect(stopR2).not.toHaveBeenCalled();

    await Promise.all([handle1.close(), handle2.close()]);
  });

  it("keeps the first matching owner when two overlapping runs answer one connect request", async () => {
    const wire = network();
    const owner1 = new PlannerRunControl(wire.openBus, { instanceId: "A1", timeoutMs: 100 });
    const owner2 = new PlannerRunControl(wire.openBus, { instanceId: "A2", timeoutMs: 100 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const handle1 = await owner1.own("thread-connect-overlap", "R1", async () => true);
    const handle2 = await owner2.own("thread-connect-overlap", "R2", async () => true);

    const connection = await controller.connect("thread-connect-overlap");
    expect(connection).toMatchObject({ runId: "R1", ownerInstanceId: "A1" });

    const received: BaseEvent[] = [];
    connection?.onEvent((event) => received.push(event));
    await handle1.publish({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: "m-r1",
      delta: "from-r1",
    } as BaseEvent);
    await handle2.publish({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: "m-r2",
      delta: "from-r2",
    } as BaseEvent);

    expect(received).toHaveLength(1);
    expect((received[0] as BaseEvent & { delta?: string }).delta).toBe("from-r1");

    await connection?.close();
    await Promise.all([handle1.close(), handle2.close()]);
  });

  it("retries connect when the owner subscribes after the first control broadcast", async () => {
    const wire = network();
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 350 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 350 });

    const connectionPromise = controller.connect("thread-late-connect");
    await sleep(20);
    const handle = await owner.own("thread-late-connect", "R1", async () => true);

    expect(await connectionPromise).toMatchObject({ runId: "R1", ownerInstanceId: "A" });

    await handle.close();
  });

  it("retries exact Stop when the owner subscribes after the first control broadcast", async () => {
    const wire = network();
    const stopLocal = vi.fn(async () => true);
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 350 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 350 });

    const stopPromise = controller.stop("thread-late-stop", "R1");
    await sleep(20);
    const handle = await owner.own("thread-late-stop", "R1", stopLocal);

    expect(await stopPromise).toMatchObject({ stopped: true, runId: "R1", ownerInstanceId: "A" });
    expect(stopLocal).toHaveBeenCalledTimes(1);
    expect(stopLocal).toHaveBeenCalledWith("R1");

    await handle.close();
  });

  it("deduplicates Stop for an exact run even across different controller request IDs", async () => {
    const wire = network();
    const stopLocal = vi.fn(async () => true);
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 100 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const handle = await owner.own("thread-stop-once", "R1", stopLocal);

    expect(await controller.stop("thread-stop-once", "R1")).toMatchObject({ stopped: true });
    expect(await controller.stop("thread-stop-once", "R1")).toMatchObject({ stopped: true });
    expect(stopLocal).toHaveBeenCalledTimes(1);
    await handle.close();
  });

  it("allows a later exact-run Stop retry if the first attempt returned false", async () => {
    const wire = network();
    const stopLocal = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 100 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const handle = await owner.own("thread-stop-retry", "R1", stopLocal);

    expect(await controller.stop("thread-stop-retry", "R1")).toMatchObject({ stopped: false });
    expect(await controller.stop("thread-stop-retry", "R1")).toMatchObject({ stopped: true });
    expect(stopLocal).toHaveBeenCalledTimes(2);
    await handle.close();
  });

  it("does not ACK connect after an earlier replay broadcast fails", async () => {
    const wire = network();
    const log = vi.fn();
    const owner = new PlannerRunControl(async (threadId) => {
      const bus = await wire.openBus(threadId);
      return {
        ...bus,
        async send(message: PlannerRunControlMessage) {
          if (message.kind === "event" && message.replayFor) throw new Error("replay_network_failure");
          return bus.send(message);
        },
      };
    }, { instanceId: "A", timeoutMs: 80, log });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 80 });
    const handle = await owner.own("thread-replay-failure", "R1", async () => true);
    await handle.publish({ type: EventType.TEXT_MESSAGE_START, messageId: "m1", role: "assistant" } as BaseEvent);

    expect(await controller.connect("thread-replay-failure")).toBeNull();
    expect(log).toHaveBeenCalledWith("owner_send_failed", expect.objectContaining({ kind: "event" }));
    await handle.close();
  });

  it("does not ACK a reconnect when a concurrent live broadcast fails during replay", async () => {
    const wire = network();
    let signalReplay: () => void = () => {};
    const replayStarted = new Promise<void>((resolve) => { signalReplay = resolve; });
    const owner = new PlannerRunControl(async (threadId) => {
      const bus = await wire.openBus(threadId);
      return {
        ...bus,
        async send(message: PlannerRunControlMessage) {
          if (message.kind === "event" && message.replayFor) {
            signalReplay();
            await sleep(20);
          } else if (message.kind === "event") {
            throw new Error("live_event_disconnected");
          }
          return bus.send(message);
        },
      };
    }, { instanceId: "A", timeoutMs: 100 });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 100 });
    const handle = await owner.own("thread-racing-send", "R1", async () => true);
    await handle.publish({ type: EventType.TEXT_MESSAGE_START, messageId: "m1", role: "assistant" } as BaseEvent);

    const pendingConnection = controller.connect("thread-racing-send");
    await replayStarted;
    const pendingLive = handle.publish({
      type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m1", delta: "lost",
    } as BaseEvent).catch((error: unknown) => error);
    expect(await pendingConnection).toBeNull();
    expect(await pendingLive).toBeInstanceOf(Error);
    await handle.close();
  });

  it("rejects remote replay when one event would exceed the bounded replay memory budget", async () => {
    const wire = network();
    const log = vi.fn();
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 80, log });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 80 });
    const handle = await owner.own("thread-too-much-replay", "R1", async () => true);
    await handle.publish({
      type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m1", delta: "x".repeat(2_100_000),
    } as BaseEvent);

    // Returning a partial stream would corrupt AG-UI state; explicit remote denial is safer.
    expect(await controller.connect("thread-too-much-replay")).toBeNull();
    expect(log).toHaveBeenCalledWith("owner_replay_limit_exceeded", expect.any(Object));
    await handle.close();
  });

  it("bounds replay by event count while continuing to stream to existing controllers", async () => {
    const wire = network();
    const log = vi.fn();
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 80, log });
    const controllerB = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 80 });
    const controllerC = new PlannerRunControl(wire.openBus, { instanceId: "C", timeoutMs: 80 });
    const handle = await owner.own("thread-replay-count", "R1", async () => true);
    await handle.publish({ type: EventType.TEXT_MESSAGE_START, messageId: "m1", role: "assistant" } as BaseEvent);
    const connectionB = await controllerB.connect("thread-replay-count");
    expect(connectionB).not.toBeNull();
    const eventsB: BaseEvent[] = [];
    connectionB?.onEvent((event) => eventsB.push(event));

    for (let i = 0; i < 2_050; i += 1) {
      await handle.publish({
        type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m1", delta: "x",
      } as BaseEvent);
    }
    expect(log).toHaveBeenCalledWith("owner_replay_limit_exceeded", expect.any(Object));
    expect(await controllerC.connect("thread-replay-count")).toBeNull();
    const priorCount = eventsB.length;
    await handle.publish({
      type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m1", delta: "continued",
    } as BaseEvent);
    expect(eventsB).toHaveLength(priorCount + 1);
    await connectionB?.close();
    await handle.close();
  });

  it("reports failed live broadcasts and still cleans up the owner after terminal send fails", async () => {
    const wire = network();
    const log = vi.fn();
    const owner = new PlannerRunControl(async (threadId) => {
      const bus = await wire.openBus(threadId);
      return {
        ...bus,
        async send(message: PlannerRunControlMessage) {
          if (message.kind === "event" && !message.replayFor) throw new Error("broadcast_disconnected");
          return bus.send(message);
        },
      };
    }, { instanceId: "A", timeoutMs: 80, log });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 80 });
    const handle = await owner.own("thread-send-fail", "R1", async () => true);
    const connection = await controller.connect("thread-send-fail");
    expect(connection).not.toBeNull();

    await expect(handle.publish({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m1", delta: "x" } as BaseEvent))
      .rejects.toThrow("broadcast_disconnected");
    expect(log).toHaveBeenCalledWith("owner_send_failed", expect.objectContaining({ kind: "event" }));
    await expect(handle.close()).resolves.toBeUndefined();
    expect(wire.closed()).toBeGreaterThan(0);
    await connection?.close();
  });

  it("bounds distinct reconnect requests per active run without interrupting the owner", async () => {
    const wire = network();
    const log = vi.fn();
    const owner = new PlannerRunControl(wire.openBus, { instanceId: "A", timeoutMs: 30, log });
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 30 });
    const handle = await owner.own("thread-request-count", "R1", async () => true);

    for (let i = 0; i < 32; i += 1) {
      const connection = await controller.connect("thread-request-count");
      expect(connection?.runId).toBe("R1");
      await connection?.close();
    }
    expect(await controller.connect("thread-request-count")).toBeNull();
    expect(log).toHaveBeenCalledWith("owner_connect_limit_exceeded", { runId: "R1" });
    await handle.close();
  });

  it("times out safely when no owner exists and closes the temporary bus", async () => {
    const wire = network();
    const controller = new PlannerRunControl(wire.openBus, { instanceId: "B", timeoutMs: 10 });

    expect(await controller.probe("missing")).toBeNull();
    expect(await controller.stop("missing", "R1")).toBeNull();
    expect(await controller.connect("missing")).toBeNull();
    expect(wire.closed()).toBe(3);
  });
});
