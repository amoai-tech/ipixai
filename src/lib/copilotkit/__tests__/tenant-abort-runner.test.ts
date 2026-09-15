// IPI-1217 · COPILOT-APP-DOCK-002 — TenantAbortRunner.connect() must fall
// back to durable Mastra history when the in-memory store has nothing for
// a thread (the common case in a fresh/serverless process after reload).
// See the connect() doc comment in ../tenant-abort-runner.ts for the full
// root-cause citation, and
// ../../../components/operator-panel/copilotkit-reconnect-history.test.tsx
// for the composed proof against real (unmocked) @copilotkit/core.
import { firstValueFrom, toArray } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventType } from "@ag-ui/client";
import type { BaseEvent } from "@ag-ui/client";

import * as threadPersistence from "@/mastra/thread-persistence";
import type { PlannerChatMessage } from "@/mastra/thread-persistence";
import { TenantAbortRunner } from "../tenant-abort-runner";

const ORG_A_RESOURCE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B_RESOURCE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THREAD_ID = "11111111-1111-4111-8111-111111111111";

const history: PlannerChatMessage[] = [
  { id: "m1", role: "user", content: "alpha-fact" },
  { id: "m2", role: "assistant", content: "remembered" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TenantAbortRunner.connect()", () => {
  it("replays durable Mastra history when the in-memory store has nothing for this thread (cold process)", async () => {
    vi.spyOn(threadPersistence, "getPlannerMemory").mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof threadPersistence.getPlannerMemory>>,
    );
    const recall = vi
      .spyOn(threadPersistence, "recallPlannerChatMessages")
      .mockResolvedValue(history);

    const runner = new TenantAbortRunner(ORG_A_RESOURCE, new AbortController().signal);
    const events = await firstValueFrom(
      runner.connect({ threadId: THREAD_ID }).pipe(toArray()),
    );

    expect(events.map((e) => (e as BaseEvent).type)).toEqual([
      EventType.RUN_STARTED,
      EventType.MESSAGES_SNAPSHOT,
      EventType.RUN_FINISHED,
    ]);
    expect((events[1] as unknown as { messages: PlannerChatMessage[] }).messages).toEqual(
      history,
    );

    // Server-derived resourceId only — never a client-supplied value.
    expect(recall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resourceId: ORG_A_RESOURCE }),
    );
  });

  it("emits nothing when there is no durable history either (genuinely new/empty thread)", async () => {
    vi.spyOn(threadPersistence, "getPlannerMemory").mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof threadPersistence.getPlannerMemory>>,
    );
    vi.spyOn(threadPersistence, "recallPlannerChatMessages").mockResolvedValue([]);

    const runner = new TenantAbortRunner(ORG_A_RESOURCE, new AbortController().signal);
    const events = await firstValueFrom(
      runner.connect({ threadId: THREAD_ID }).pipe(toArray()),
    );

    expect(events).toEqual([]);
  });

  it("fails closed (no replay) when Mastra memory is unavailable, instead of throwing", async () => {
    vi.spyOn(threadPersistence, "getPlannerMemory").mockResolvedValue(undefined);
    const recall = vi.spyOn(threadPersistence, "recallPlannerChatMessages");

    const runner = new TenantAbortRunner(ORG_A_RESOURCE, new AbortController().signal);
    const events = await firstValueFrom(
      runner.connect({ threadId: THREAD_ID }).pipe(toArray()),
    );

    expect(events).toEqual([]);
    expect(recall).not.toHaveBeenCalled();
  });

  it("never lets one org's runner replay another org's thread history — resourceId is fixed at construction, not client-supplied", async () => {
    // recallPlannerChatMessages itself fails closed on a resourceId
    // mismatch (see thread-persistence.ts); this test proves the CALLER
    // side never gives it a chance to leak by using anything other than
    // the runner's own constructor-bound resourceId, regardless of which
    // threadId string is requested.
    vi.spyOn(threadPersistence, "getPlannerMemory").mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof threadPersistence.getPlannerMemory>>,
    );
    const recall = vi
      .spyOn(threadPersistence, "recallPlannerChatMessages")
      .mockResolvedValue([]);

    const orgBRunner = new TenantAbortRunner(ORG_B_RESOURCE, new AbortController().signal);
    await firstValueFrom(orgBRunner.connect({ threadId: THREAD_ID }).pipe(toArray()));

    expect(recall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resourceId: ORG_B_RESOURCE }),
    );
    expect(recall).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resourceId: ORG_A_RESOURCE }),
    );
  });
});
