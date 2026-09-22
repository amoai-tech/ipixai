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
