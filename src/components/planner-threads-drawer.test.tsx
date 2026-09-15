// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const agent = { messages: [] as unknown[] };

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: () => ({ agent }),
}));

vi.mock("./ui/error-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

vi.mock("../app/page.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { PlannerThreadsDrawer } from "./planner-threads-drawer";
import { plannerThreadStorageKey } from "@/mastra/thread-types";

const rowA = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "SS26",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const replayTrue = { threadId: rowA.id, replay: true };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  agent.messages = [];
});

describe("PlannerThreadsDrawer", () => {
  it("never activates a foreign pointer, or silently substitutes another real thread for it", async () => {
    // IPI-1217: a stored id that isn't in the authenticated resource's own
    // list used to fall back to that resource's first/most-recent OTHER
    // thread — confirmed live that this can silently land the operator's
    // next message in a conversation they didn't choose. It must start a
    // fresh thread instead, never resolvePlannerThreadId(rows, stored)'s
    // rows[0].
    window.localStorage.setItem(
      plannerThreadStorageKey("org:a::user:a"),
      "99999999-9999-4999-8999-999999999999",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resourceId: "org:a::user:a",
          threads: [rowA],
        }),
      }),
    );
    const onThreadId = vi.fn();
    render(
      <PlannerThreadsDrawer threadId={null} onThreadId={onThreadId} />,
    );
    await waitFor(() => expect(onThreadId).toHaveBeenCalledTimes(1));
    const [resolvedId, options] = onThreadId.mock.calls[0] as [
      string,
      { threadId: string; replay: boolean },
    ];
    expect(resolvedId).not.toBe("99999999-9999-4999-8999-999999999999");
    expect(resolvedId).not.toBe(rowA.id);
    expect(options).toEqual({ threadId: resolvedId, replay: false });
  });

  it("does not mint a UUID when the thread list fails; retry stays on the same surface", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resourceId: "org:a::user:a",
          threads: [rowA],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const onThreadId = vi.fn();
    render(
      <PlannerThreadsDrawer threadId={null} onThreadId={onThreadId} />,
    );

    await waitFor(() => expect(screen.getByTestId("error-state")).toBeDefined());
    expect(onThreadId).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(onThreadId).toHaveBeenCalledWith(rowA.id, replayTrue),
    );
    expect(onThreadId.mock.calls.every(([id]) => id === rowA.id)).toBe(true);
  });

  it("keeps New across a list retry", async () => {
    const listJson = vi.fn(async () => ({
      resourceId: "org:a::user:a",
      threads: [rowA],
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: listJson,
      });
    vi.stubGlobal("fetch", fetchMock);
    const onThreadId = vi.fn();
    render(
      <PlannerThreadsDrawer threadId={null} onThreadId={onThreadId} />,
    );
    await waitFor(() => expect(screen.getByTestId("error-state")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const created = onThreadId.mock.calls.at(-1)?.[0] as string;
    expect(onThreadId.mock.calls.at(-1)?.[1]).toEqual({
      threadId: created,
      replay: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(listJson).toHaveBeenCalled());
    expect(onThreadId.mock.calls.at(-1)?.[0]).toBe(created);
    expect(onThreadId).not.toHaveBeenCalledWith(rowA.id, replayTrue);
  });

  it("keeps New while the initial thread list request is still pending", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));
    const onThreadId = vi.fn();
    const listJson = vi.fn(async () => ({
      resourceId: "org:a::user:a",
      threads: [rowA],
    }));
    render(
      <PlannerThreadsDrawer threadId={null} onThreadId={onThreadId} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const created = onThreadId.mock.calls.at(-1)?.[0] as string;
    expect(onThreadId.mock.calls.at(-1)?.[1]).toEqual({
      threadId: created,
      replay: false,
    });
    resolveFirst({
      ok: true,
      json: listJson,
    });
    await waitFor(() => expect(listJson).toHaveBeenCalled());
    expect(onThreadId.mock.calls.at(-1)?.[0]).toBe(created);
    expect(onThreadId).not.toHaveBeenCalledWith(rowA.id, replayTrue);
  });

  it("only New creates a client UUID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resourceId: "org:a::user:a",
          threads: [rowA],
        }),
      }),
    );
    const onThreadId = vi.fn();
    render(
      <PlannerThreadsDrawer threadId={rowA.id} onThreadId={onThreadId} />,
    );
    await waitFor(() =>
      expect(onThreadId).toHaveBeenCalledWith(rowA.id, replayTrue),
    );
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const created = onThreadId.mock.calls.at(-1)?.[0] as string;
    expect(created).not.toBe(rowA.id);
    expect(onThreadId.mock.calls.at(-1)?.[1]).toEqual({
      threadId: created,
      replay: false,
    });
    expect(created).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("keeps listed threads visible while a later message refresh is in flight", async () => {
    let resolveSecond: (value: unknown) => void = () => {};
    const second = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resourceId: "org:a::user:a",
          threads: [rowA],
        }),
      })
      .mockReturnValueOnce(second);
    vi.stubGlobal("fetch", fetchMock);
    const onThreadId = vi.fn();
    const { rerender } = render(
      <PlannerThreadsDrawer threadId={null} onThreadId={onThreadId} />,
    );
    await waitFor(() => expect(screen.getByText("SS26")).toBeDefined());
    agent.messages = [{ id: "m1" }];
    rerender(
      <PlannerThreadsDrawer threadId={rowA.id} onThreadId={onThreadId} />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText("SS26")).toBeDefined();
    expect(screen.queryByText("Loading threads…")).toBeNull();
    resolveSecond({
      ok: true,
      json: async () => ({
        resourceId: "org:a::user:a",
        threads: [rowA],
      }),
    });
  });
});
