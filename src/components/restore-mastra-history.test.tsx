// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agent = {
  messages: [] as Array<{ id: string; role: string; content: string }>,
  setMessages(next: Array<{ id: string; role: string; content: string }>) {
    agent.messages = next;
  },
};

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: () => ({ agent }),
}));

vi.mock("./ui/error-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { RestoreMastraHistory } from "./restore-mastra-history";

const history = [
  { id: "m1", role: "user" as const, content: "alpha-fact" },
  { id: "m2", role: "assistant" as const, content: "remembered" },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  agent.messages = [];
});

describe("RestoreMastraHistory", () => {
  beforeEach(() => {
    agent.messages = [];
  });

  it("shows the restored conversation after a successful fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: history }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RestoreMastraHistory threadId="thread-a" />);

    await waitFor(() =>
      expect(screen.getByLabelText("Restored conversation")).toBeDefined(),
    );
    expect(screen.getByText("alpha-fact")).toBeDefined();
    expect(screen.getByText("remembered")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/planner/threads/thread-a/messages",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(screen.queryByTestId("error-state")).toBeNull();
  });

  it("does not hydrate on 403 and shows a retryable denial without body leak", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: "thread_forbidden",
            secret: "ORG-A-SECRET-SHOULD-NOT-APPEAR",
          }),
      }),
    );

    render(<RestoreMastraHistory threadId="org-a-thread" />);

    await waitFor(() => expect(screen.getByTestId("error-state")).toBeDefined());
    expect(screen.queryByLabelText("Restored conversation")).toBeNull();
    expect(screen.queryByText(/ORG-A-SECRET/)).toBeNull();
    expect(
      screen.getByText("This conversation is not available for your organization."),
    ).toBeDefined();
  });

  it("shows sign-in required on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    render(<RestoreMastraHistory threadId="thread-a" />);
    await waitFor(() =>
      expect(screen.getByText("Sign in required to load this conversation.")).toBeDefined(),
    );
    expect(screen.queryByLabelText("Restored conversation")).toBeNull();
    expect(agent.messages).toEqual([]);
  });

  it("shows a retryable error when messages is not an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: { secret: "not-an-array" } }),
      }),
    );
    render(<RestoreMastraHistory threadId="thread-a" />);
    await waitFor(() => expect(screen.getByTestId("error-state")).toBeDefined());
    expect(screen.queryByLabelText("Restored conversation")).toBeNull();
    expect(screen.queryByText("not-an-array")).toBeNull();
    expect(agent.messages).toEqual([]);
  });

  it("skips fetch for an unpersisted new conversation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<RestoreMastraHistory threadId="new-uuid" replay={false} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("error-state")).toBeNull();
  });

  // IPI-1217: /app uses onSettled to hold off letting the operator send
  // anything until a resumed thread's history has actually loaded —
  // confirmed live that sending while this fetch is still in flight can
  // race agent.setMessages(...) and silently drop the new message.
  it("calls onSettled after a successful restore", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ messages: history }) }),
    );
    const onSettled = vi.fn();
    render(<RestoreMastraHistory threadId="thread-a" onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
  });

  // A failed attempt leaves its own ErrorState + Try again visible (still
  // mounted while ungated — see ResolvedChatDock in operator-panel.tsx), so
  // this doesn't strand the operator without recourse. It does stop
  // CopilotChat from mounting into what would otherwise look like a
  // normal, empty conversation while durable history that actually exists
  // failed to load.
  it("does not call onSettled after a failed restore — the gate stays closed until Retry succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const onSettled = vi.fn();
    render(<RestoreMastraHistory threadId="thread-a" onSettled={onSettled} />);
    await waitFor(() => expect(screen.getByTestId("error-state")).toBeDefined());
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("calls onSettled once Retry succeeds after an earlier failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ messages: history }) });
    vi.stubGlobal("fetch", fetchMock);
    const onSettled = vi.fn();
    render(<RestoreMastraHistory threadId="thread-a" onSettled={onSettled} />);
    await waitFor(() => expect(screen.getByTestId("error-state")).toBeDefined());
    expect(onSettled).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
  });

  it("calls onSettled immediately for a genuinely new conversation (replay=false)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onSettled = vi.fn();
    render(<RestoreMastraHistory threadId="new-uuid" replay={false} onSettled={onSettled} />);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries after 5xx and then shows restored messages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: history }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<RestoreMastraHistory threadId="thread-a" />);

    await waitFor(() => expect(screen.getByTestId("error-state")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Restored conversation")).toBeDefined(),
    );
    expect(screen.getByText("alpha-fact")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not overwrite live messages that arrived after hydration started", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const json = vi.fn(async () => ({ messages: history }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        pending.then(() => ({
          ok: true,
          json,
        })),
      ),
    );

    render(<RestoreMastraHistory threadId="thread-a" />);
    agent.messages = [{ id: "live", role: "user", content: "newer" }];
    resolveFetch(undefined);

    await waitFor(() => expect(json).toHaveBeenCalled());
    expect(screen.queryByLabelText("Restored conversation")).toBeNull();
    expect(agent.messages).toEqual([
      { id: "live", role: "user", content: "newer" },
    ]);
  });

  it("does not replace live messages sent before Try again", async () => {
    const json = vi.fn(async () => ({ messages: history }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<RestoreMastraHistory threadId="thread-a" />);
    await waitFor(() => expect(screen.getByTestId("error-state")).toBeDefined());
    agent.messages = [{ id: "live", role: "user", content: "typed-after-error" }];
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(json).toHaveBeenCalled());
    expect(screen.queryByLabelText("Restored conversation")).toBeNull();
    expect(agent.messages).toEqual([
      { id: "live", role: "user", content: "typed-after-error" },
    ]);
  });

  it("does not replace a same-length live update with stale history", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const json = vi.fn(async () => ({ messages: history }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        pending.then(() => ({
          ok: true,
          json,
        })),
      ),
    );

    agent.messages = [{ id: "m1", role: "user", content: "hello" }];
    render(<RestoreMastraHistory threadId="thread-a" />);
    agent.messages = [{ id: "m1", role: "user", content: "hello-streamed" }];
    resolveFetch(undefined);

    await waitFor(() => expect(json).toHaveBeenCalled());
    expect(screen.queryByLabelText("Restored conversation")).toBeNull();
    expect(agent.messages).toEqual([
      { id: "m1", role: "user", content: "hello-streamed" },
    ]);
  });

  it("does not treat delimiter-colliding live edits as unchanged", async () => {
    const json = vi.fn(async () => ({ messages: history }));
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        pending.then(() => ({
          ok: true,
          json,
        })),
      ),
    );

    agent.messages = [
      { id: "m1", role: "user", content: "a\nm2:b" },
      { id: "m2", role: "assistant", content: "c" },
    ];
    render(<RestoreMastraHistory threadId="thread-a" />);
    agent.messages = [
      { id: "m1", role: "user", content: "a" },
      { id: "m2", role: "assistant", content: "b\nm2:c" },
    ];
    resolveFetch(undefined);

    await waitFor(() => expect(json).toHaveBeenCalled());
    expect(screen.queryByLabelText("Restored conversation")).toBeNull();
    expect(agent.messages).toEqual([
      { id: "m1", role: "user", content: "a" },
      { id: "m2", role: "assistant", content: "b\nm2:c" },
    ]);
  });
});
