import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY } from "rxjs";
import type { AgentRunner } from "@copilotkit/runtime/v2";

import { MastraControlRunner } from "@/lib/copilotkit/mastra-control-runner";

const delegate = {
  run: vi.fn(() => EMPTY),
  connect: vi.fn(() => EMPTY),
  isRunning: vi.fn(async () => false),
  stop: vi.fn(async () => false),
} as unknown as AgentRunner;

afterEach(() => vi.restoreAllMocks());

describe("MastraControlRunner", () => {
  it("uses shared Mastra active-run truth instead of process-local runner state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ runId: "R1" }), { status: 200 }),
    );
    const runner = new MastraControlRunner(delegate, "http://mastra", "jwt");
    await expect(runner.isRunning({ threadId: "thread-1" })).resolves.toBe(true);
  });

  it("surfaces active-run HTTP failures instead of reporting not running", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("forbidden", { status: 403 }));
    const runner = new MastraControlRunner(delegate, "http://mastra", "jwt");
    await expect(runner.isRunning({ threadId: "thread-1" })).rejects.toThrow("Active run lookup failed: 403");
  });

  it("surfaces malformed active-run responses instead of reporting not running", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>bad gateway</html>", { status: 200, headers: { "content-type": "text/html" } }));
    const runner = new MastraControlRunner(delegate, "http://mastra", "jwt");
    await expect(runner.isRunning({ threadId: "thread-1" })).rejects.toThrow("Active run lookup returned invalid JSON");
  });

  it("rejects non-http Mastra base URLs", () => {
    expect(() => new MastraControlRunner(delegate, "file:///tmp/mastra", "jwt")).toThrow("MASTRA_BASE_URL must use http or https");
  });

  it("surfaces run-abort service failures instead of reporting a no-op", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("bad gateway", { status: 502 }),
    );
    const runner = new MastraControlRunner(delegate, "http://mastra", "jwt");
    await expect(
      runner.stop({ threadId: "thread-1", runId: "R1" }),
    ).rejects.toThrow("Run abort failed: 502");
  });

  it("fails closed when Stop does not carry the original runId", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const runner = new MastraControlRunner(delegate, "http://mastra", "jwt");
    await expect(runner.stop({ threadId: "thread-1" })).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preserves a base-path prefix for run-control requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ runId: null }), { status: 200 }),
    );
    const runner = new MastraControlRunner(delegate, "https://mastra.example.com/runtime/", "jwt");
    await expect(runner.isRunning({ threadId: "thread-1" })).resolves.toBe(false);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://mastra.example.com/runtime/ipix/run-control/active",
    );
  });

  it("preserves a base-path prefix when the base URL has no trailing slash", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ runId: null }), { status: 200 }),
    );
    const runner = new MastraControlRunner(delegate, "https://mastra.example.com/runtime", "jwt");
    await expect(runner.isRunning({ threadId: "thread-1" })).resolves.toBe(false);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://mastra.example.com/runtime/ipix/run-control/active",
    );
  });

  it("applies a 10 second timeout to Mastra control requests", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ runId: null }), { status: 200 }),
    );
    const runner = new MastraControlRunner(delegate, "http://mastra", "jwt");
    await runner.isRunning({ threadId: "thread-1" });
    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(timeoutSignal);
  });

  it("stops the exact requested run through Mastra", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ aborted: true }), { status: 200 }),
    );
    const runner = new MastraControlRunner(delegate, "http://mastra", "jwt");
    await expect(runner.stop({ threadId: "thread-1", runId: "R1" })).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      threadId: "thread-1",
      runId: "R1",
    });
  });
});
