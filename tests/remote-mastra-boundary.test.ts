import { afterEach, describe, expect, it, vi } from "vitest";

import {
  abortOwnedActiveRun,
  findOwnedActiveRun,
} from "@/mastra/run-control";
import { createMastraClientForRequest } from "@/agent";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("remote Mastra boundary", () => {
  it("forwards the verified Supabase bearer token to self-hosted Mastra", () => {
    vi.stubEnv("MASTRA_BASE_URL", "http://127.0.0.1:4111");
    const client = createMastraClientForRequest("jwt-123");
    const options = (client as unknown as { options: Record<string, unknown> }).options;

    expect(options.baseUrl).toBe("http://127.0.0.1:4111");
    expect(options.headers).toEqual({ Authorization: "Bearer jwt-123" });
  });

  it("finds only the active run owned by the authenticated resource/thread", () => {
    const agent = {
      listActiveThreadRuns: () => [
        { runId: "R1", resourceId: "org:a::user:u", threadId: "thread-1" },
        { runId: "R2", resourceId: "org:b::user:u", threadId: "thread-1" },
      ],
    };

    expect(findOwnedActiveRun(agent, "org:a::user:u", "thread-1")?.runId).toBe("R1");
    expect(findOwnedActiveRun(agent, "org:c::user:u", "thread-1")).toBeUndefined();
  });

  it("aborts exact R1 but a stale Stop(R1) cannot abort active R2", () => {
    const abortRunStream = vi.fn(() => true);
    const active = { current: "R1" };
    const agent = {
      listActiveThreadRuns: () => [
        {
          runId: active.current,
          resourceId: "org:a::user:u",
          threadId: "thread-1",
        },
      ],
      abortRunStream,
    };

    expect(
      abortOwnedActiveRun(agent, "org:a::user:u", "thread-1", "R1"),
    ).toBe(true);
    expect(abortRunStream).toHaveBeenCalledWith("R1");

    abortRunStream.mockClear();
    active.current = "R2";
    expect(
      abortOwnedActiveRun(agent, "org:a::user:u", "thread-1", "R1"),
    ).toBe(false);
    expect(abortRunStream).not.toHaveBeenCalled();
  });
});
