import { describe, expect, it, vi } from "vitest";

import { guardPlannerResponseStream } from "@/lib/auth/planner-membership-watchdog";

const encode = (message: string) => new TextEncoder().encode(message);
const decode = (chunk: Uint8Array | undefined) => new TextDecoder().decode(chunk);

function makeUpstream() {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { source = controller; },
    cancel,
  });
  return { source, cancel, response: new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  }) };
}

describe("Planner guarded response stream", () => {
  it("discards buffered events and cancels upstream when membership is revoked", async () => {
    const { source, cancel, response } = makeUpstream();
    const membership = new AbortController();
    const cleanup = vi.fn();
    const guarded = guardPlannerResponseStream(response, membership.signal, cleanup);
    const reader = guarded.body!.getReader();

    source.enqueue(encode("data: first\\n\\n"));
    expect(decode((await reader.read()).value)).toContain("first");
    source.enqueue(encode("data: protected\\n\\n"));
    membership.abort();

    await expect(reader.read()).rejects.toMatchObject({ name: "AbortError" });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("terminates a response if membership is already revoked before wrapping", async () => {
    const { cancel, response } = makeUpstream();
    const membership = new AbortController();
    membership.abort();
    const cleanup = vi.fn();
    const guarded = guardPlannerResponseStream(response, membership.signal, cleanup);
    await expect(guarded.body!.getReader().read()).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("cleans up on normal completion and retains response metadata", async () => {
    const { source, response } = makeUpstream();
    const cleanup = vi.fn();
    const guarded = guardPlannerResponseStream(response, new AbortController().signal, cleanup);
    expect(guarded.headers.get("content-type")).toBe("text/event-stream");
    const reader = guarded.body!.getReader();
    source.enqueue(encode("done"));
    source.close();
    expect(decode((await reader.read()).value)).toBe("done");
    expect((await reader.read()).done).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("cancels upstream and cleans up on downstream cancellation", async () => {
    const { cancel, response } = makeUpstream();
    const cleanup = vi.fn();
    const guarded = guardPlannerResponseStream(response, new AbortController().signal, cleanup);
    await guarded.body!.cancel("client disconnected");
    expect(cancel).toHaveBeenCalledWith("client disconnected");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("cleans up on upstream error", async () => {
    const { source, response } = makeUpstream();
    const cleanup = vi.fn();
    const guarded = guardPlannerResponseStream(response, new AbortController().signal, cleanup);
    const reader = guarded.body!.getReader();
    source.error(new Error("upstream unavailable"));
    await expect(reader.read()).rejects.toThrow("upstream unavailable");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("cleans up on a bodyless response", () => {
    const response = new Response(null, { status: 204 });
    const cleanup = vi.fn();
    expect(guardPlannerResponseStream(response, new AbortController().signal, cleanup)).toBe(response);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
