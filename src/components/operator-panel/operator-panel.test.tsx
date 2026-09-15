// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";

import { plannerThreadStorageKey } from "@/mastra/thread-types";

type MqListener = (event: MediaQueryListEvent) => void;

function mockMobileNav(matches: boolean) {
  let listener: MqListener | null = null;
  const mq = {
    matches,
    media: "(max-width: 767px)",
    addEventListener: (_event: string, cb: MqListener) => {
      listener = cb;
    },
    removeEventListener: (_event: string, cb: MqListener) => {
      if (listener === cb) listener = null;
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    emit(next: boolean) {
      this.matches = next;
      listener?.({ matches: next } as MediaQueryListEvent);
    },
    hasListener() {
      return listener !== null;
    },
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      if (!query.includes("767")) {
        return {
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        };
      }
      return mq;
    },
  });

  return mq;
}

vi.mock("./operator-panel.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

// @copilotkit/react-core/v2's package entry pulls in its own bundled CSS,
// which this repo's plain-node Vitest config (no CSS transform) can't load.
// Stubbed here rather than adding a project-wide CSS plugin for one test —
// these tests assert OperatorPanel's own shell/nav/rail behavior, not
// CopilotKit's internals. threadId and the welcome label are surfaced via
// data attributes, not visible children: the real CopilotChat never
// displays labels.welcomeMessageText once threadId is explicit (IPI-1217 —
// see operator-panel.tsx's isNewThread comment), and PlannerChatDock now
// renders that copy itself in a real, visible paragraph — a stub that also
// echoed the label as text would double-render it and mask that gate.
// Resettable (vi.hoisted) rather than a plain arrow function so individual
// tests can simulate an in-progress conversation via mockReturnValueOnce —
// operator-panel.tsx's isNewThread welcome banner is also gated on this.
const useAgentMock = vi.hoisted(() =>
  vi.fn(() => ({ agent: { messages: [] as unknown[] } })),
);

vi.mock("@copilotkit/react-core/v2", () => ({
  CopilotKit: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAgent: useAgentMock,
  CopilotChat: ({
    labels,
    threadId,
  }: {
    labels?: { welcomeMessageText?: string };
    threadId?: string;
  }) => (
    <div
      data-testid="copilot-chat-stub"
      data-thread-id={threadId}
      data-welcome-message={labels?.welcomeMessageText}
    />
  ),
}));

// Real component makes its own fetch to /api/planner/threads/:id/messages
// and calls agent.setMessages(...) — none of that is what these tests are
// proving. What matters here is *whether PlannerChatDock renders it at
// all* for an existing vs. a genuinely new thread (see operator-panel.tsx's
// isNewThread comment on the ~50% CI reload flake this fixes), so the stub
// only needs to surface its own props. autoSettle/capturedOnSettled let the
// gate test below simulate a still-in-flight restore, then complete it on
// demand, without needing real async fetch machinery.
const restoreAutoSettle = vi.hoisted(() => ({ current: true }));
const capturedOnSettled = vi.hoisted(() => ({ current: null as (() => void) | null }));

vi.mock("@/components/restore-mastra-history", () => ({
  RestoreMastraHistory: ({
    threadId,
    replay,
    onSettled,
  }: {
    threadId: string;
    replay?: boolean;
    onSettled?: () => void;
  }) => {
    capturedOnSettled.current = onSettled ?? null;
    useEffect(() => {
      if (restoreAutoSettle.current) onSettled?.();
    }, [onSettled]);
    return (
      <div data-testid="restore-mastra-history-stub" data-thread-id={threadId} data-replay={String(replay)} />
    );
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { OperatorPanel } from "./operator-panel";
import { navItemIsActive, OPERATOR_NAV } from "./nav";
import { ReportWorkspaceStats } from "./workspace-stats";

const DEFAULT_RESOURCE_ID = "org-1";

/** IPI-1217: PlannerChatDock now bootstraps a thread via
 *  GET /api/planner/threads before mounting CopilotChat — every test needs
 *  this mocked or the dock sticks on "Loading conversation…" forever. */
function mockThreadsFetch(
  impl: (
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ) => Response | Promise<Response> = () =>
    new Response(JSON.stringify({ resourceId: DEFAULT_RESOURCE_ID, threads: [] }), { status: 200 }),
) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

beforeEach(() => {
  mockThreadsFetch();
  window.localStorage.clear();
  useAgentMock.mockReturnValue({ agent: { messages: [] } });
  restoreAutoSettle.current = true;
  capturedOnSettled.current = null;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OperatorPanel", () => {
  it("renders children, destinations, and the intelligence rail slot", async () => {
    render(
      <OperatorPanel>
        <p>Workspace body</p>
      </OperatorPanel>,
    );
    expect(screen.getByTestId("operator-panel")).toBeDefined();
    expect(screen.getByText("Workspace body")).toBeDefined();
    expect(screen.getByTestId("intelligence-rail")).toBeDefined();
    // Persistent CopilotKit chat dock — center workspace, not the rail.
    expect(screen.getByTestId("operator-chat-dock")).toBeDefined();
    await waitFor(() => expect(screen.getByTestId("copilot-chat-stub")).toBeDefined());
    const plannerLinks = screen.getAllByRole("link", { name: "Open Planner" });
    expect(plannerLinks.length).toBeGreaterThan(0);
    expect(plannerLinks.every((link) => link.getAttribute("href") === "/planner")).toBe(true);
    expect(plannerLinks.every((link) => link.getAttribute("target") === "_blank")).toBe(true);
    for (const item of OPERATOR_NAV) {
      expect(screen.getByRole("link", { name: item.label })).toBeDefined();
    }
  });

  it("rail shows the generic copy when no real workspace stats have been reported", () => {
    render(
      <OperatorPanel>
        <p>Workspace body</p>
      </OperatorPanel>,
    );
    expect(
      within(screen.getByTestId("intelligence-rail")).getByText(
        "Planner chat stays in its own screen. Open it without replacing this workspace.",
      ),
    ).toBeDefined();
    expect(screen.queryByTestId("intelligence-workspace-stats")).toBeNull();
  });

  it("rail shows real derived brand/shoot counts once the dashboard page reports them", () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={3} shootCount={5} />
      </OperatorPanel>,
    );
    expect(
      within(screen.getByTestId("intelligence-rail")).getByText("3 brands · 5 shoots in this workspace."),
    ).toBeDefined();
  });

  it("uses singular nouns for exactly one brand and one shoot", () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={1} shootCount={1} />
      </OperatorPanel>,
    );
    expect(
      within(screen.getByTestId("intelligence-rail")).getByText("1 brand · 1 shoot in this workspace."),
    ).toBeDefined();
  });

  it("pluralizes each noun independently, not just when both counts match", () => {
    // Proves brandCount and shootCount pick their own noun rather than
    // sharing one — a bug that "1/1" (above) and "3/5" alone can't catch.
    const { unmount } = render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={1} shootCount={2} />
      </OperatorPanel>,
    );
    expect(
      within(screen.getByTestId("intelligence-rail")).getByText("1 brand · 2 shoots in this workspace."),
    ).toBeDefined();
    unmount();

    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={2} shootCount={1} />
      </OperatorPanel>,
    );
    expect(
      within(screen.getByTestId("intelligence-rail")).getByText("2 brands · 1 shoot in this workspace."),
    ).toBeDefined();
  });

  it("chat welcome stays generic with no real workspace stats", async () => {
    render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("copilot-chat-stub").getAttribute("data-welcome-message")).toBe(
        "Ask a question to get started.",
      ),
    );
  });

  it("chat welcome and rail name the real brand and its own recent shoot when populated", async () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats
          brandCount={3}
          shootCount={12}
          brandName="Maaji"
          recentShootName="Spring hero"
          recentShootStatus="in_review"
        />
      </OperatorPanel>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("copilot-chat-stub").getAttribute("data-welcome-message")).toBe(
        "You're working with Maaji. Portfolio: 3 brands · 12 shoots. Ask about recent production or your next shoot.",
      ),
    );
    const rail = screen.getByTestId("intelligence-rail");
    expect(within(rail).getByTestId("intelligence-brand-context").textContent).toBe(
      "Current brand: Maaji",
    );
    expect(within(rail).getByTestId("intelligence-recent-shoot").textContent).toBe(
      "Spring hero · in_review",
    );
  });

  it("never fabricates a recent-shoot line when the brand has none", async () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={1} shootCount={0} brandName="Acme" />
      </OperatorPanel>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("copilot-chat-stub").getAttribute("data-welcome-message")).toBe(
        "You're working with Acme. Portfolio: 1 brand · 0 shoots. Ask about recent production or your next shoot.",
      ),
    );
    expect(screen.queryByTestId("intelligence-recent-shoot")).toBeNull();
  });

  it("tells the rail a lookup failed instead of silently looking like a confirmed-empty brand", () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={1} shootCount={3} brandName="Acme" recentShootLookupFailed />
      </OperatorPanel>,
    );
    const rail = screen.getByTestId("intelligence-rail");
    expect(within(rail).getByTestId("intelligence-recent-shoot-unavailable").textContent).toBe(
      "Couldn't load right now.",
    );
    // Never both at once — a failed lookup and a real shoot name are
    // mutually exclusive outcomes.
    expect(within(rail).queryByTestId("intelligence-recent-shoot")).toBeNull();
  });

  it("chat welcome and rail stay honest for a zero-brand org — no guessed brand", async () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={0} shootCount={0} />
      </OperatorPanel>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("copilot-chat-stub").getAttribute("data-welcome-message")).toBe(
        "Start by creating a brand or planning your first shoot.",
      ),
    );
    const rail = screen.getByTestId("intelligence-rail");
    expect(within(rail).queryByTestId("intelligence-brand-context")).toBeNull();
    expect(within(rail).queryByTestId("intelligence-recent-shoot")).toBeNull();
    // No fabricated Approvals/Activity anywhere in the rail — real signal
    // only, per IPI-1149's acceptance criteria.
    expect(within(rail).queryByText(/approval/i)).toBeNull();
    expect(within(rail).queryByText(/activity/i)).toBeNull();
  });

  it("toggles mobile navigation open and closed", () => {
    render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );
    const menu = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menu);
    expect(screen.getByRole("button", { name: "Close menu" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.getByRole("button", { name: "Menu" })).toBeDefined();
  });

  it("makes closed mobile navigation inert and restores it when open", async () => {
    mockMobileNav(true);
    render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );
    const nav = document.getElementById("operator-nav");
    expect(nav).toBeTruthy();
    await waitFor(() => expect(nav?.hasAttribute("inert")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() => expect(nav?.hasAttribute("inert")).toBe(false));
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeDefined();
  });

  it("updates inert when the breakpoint changes and removes the listener on unmount", async () => {
    const mq = mockMobileNav(true);
    const { unmount } = render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );
    const nav = document.getElementById("operator-nav");
    await waitFor(() => expect(nav?.hasAttribute("inert")).toBe(true));
    expect(mq.hasListener()).toBe(true);

    mq.emit(false);
    await waitFor(() => expect(nav?.hasAttribute("inert")).toBe(false));

    unmount();
    expect(mq.hasListener()).toBe(false);
  });
});

describe("PlannerChatDock thread bootstrap (IPI-1217)", () => {
  it("shows the loading state before the bootstrap resolves, then mounts chat", async () => {
    let resolveFetch!: (_response: Response) => void;
    mockThreadsFetch(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );

    expect(screen.getByText("Loading conversation…")).toBeDefined();
    expect(screen.queryByTestId("copilot-chat-stub")).toBeNull();

    resolveFetch(
      new Response(JSON.stringify({ resourceId: DEFAULT_RESOURCE_ID, threads: [] }), { status: 200 }),
    );

    await waitFor(() => expect(screen.getByTestId("copilot-chat-stub")).toBeDefined());
  });

  it("reuses a stored thread the authenticated resource actually owns", async () => {
    window.localStorage.setItem(plannerThreadStorageKey(DEFAULT_RESOURCE_ID), "thread-owned");
    mockThreadsFetch(
      () =>
        new Response(
          JSON.stringify({
            resourceId: DEFAULT_RESOURCE_ID,
            threads: [{ id: "thread-owned", title: "t", createdAt: "x", updatedAt: "x" }],
          }),
          { status: 200 },
        ),
    );

    render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("copilot-chat-stub").getAttribute("data-thread-id")).toBe("thread-owned"),
    );
    // Resuming a real existing conversation must never show a "welcome"
    // banner above it — see the isNewThread test below for the contrast.
    expect(screen.queryByText("Ask a question to get started.")).toBeNull();
    // The actual reload-restore fix: an existing thread must activate
    // history hydration, not just render CopilotChat with the right id —
    // connectAgent() alone doesn't reliably backfill past messages (the
    // ~50% CI reload flake this addresses).
    const restore = screen.getByTestId("restore-mastra-history-stub");
    expect(restore.getAttribute("data-thread-id")).toBe("thread-owned");
    expect(restore.getAttribute("data-replay")).toBe("true");
  });

  it("does not mount CopilotChat until an existing thread's history restore settles", async () => {
    // Confirmed live (IPI-1217): sending while RestoreMastraHistory's fetch
    // is still in flight can race its agent.setMessages(...) call and
    // silently drop the new message. Holding CopilotChat back until
    // onSettled fires removes that window entirely, regardless of the
    // exact internal timing that caused it.
    restoreAutoSettle.current = false;
    window.localStorage.setItem(plannerThreadStorageKey(DEFAULT_RESOURCE_ID), "thread-owned");
    mockThreadsFetch(
      () =>
        new Response(
          JSON.stringify({
            resourceId: DEFAULT_RESOURCE_ID,
            threads: [{ id: "thread-owned", title: "t", createdAt: "x", updatedAt: "x" }],
          }),
          { status: 200 },
        ),
    );

    render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );

    // RestoreMastraHistory must still mount (so its own fetch can actually
    // run and eventually call onSettled) even while the chat stays gated.
    await waitFor(() => expect(screen.getByTestId("restore-mastra-history-stub")).toBeDefined());
    expect(screen.queryByTestId("copilot-chat-stub")).toBeNull();
    expect(screen.getByText("Loading conversation…")).toBeDefined();

    capturedOnSettled.current?.();

    await waitFor(() =>
      expect(screen.getByTestId("copilot-chat-stub").getAttribute("data-thread-id")).toBe("thread-owned"),
    );
  });

  it("shows the portfolio welcome copy above the chat only for a genuinely new thread", async () => {
    // IPI-1217 regression: giving CopilotChat an explicit threadId also
    // disables its own built-in welcome screen (react-core/v2's
    // hasExplicitThreadId gate — confirmed live, see IPI-1217), which would
    // otherwise silently drop IPI-1149's portfolio-aware welcome copy for
    // every /app conversation, not just resumed ones. mockThreadsFetch's
    // default `threads: []` guarantees resolvePlannerThreadId falls through
    // to crypto.randomUUID() — a thread that cannot have prior messages.
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={0} shootCount={0} />
      </OperatorPanel>,
    );

    await waitFor(() =>
      expect(screen.getByText("Start by creating a brand or planning your first shoot.")).toBeDefined(),
    );
    // Exactly one copy of the welcome text — our own banner, not a second
    // one duplicated from CopilotChat's (harmless, unreachable) labels prop.
    expect(
      screen.getAllByText("Start by creating a brand or planning your first shoot."),
    ).toHaveLength(1);
    // A genuinely new thread has no history to restore — history hydration
    // must not activate here (nothing wrong with it being a no-op, but it
    // would be an extra request and re-render for nothing).
    expect(screen.queryByTestId("restore-mastra-history-stub")).toBeNull();
  });

  it("hides the welcome banner once the conversation has real messages, even on a new thread", async () => {
    // Low-risk finding from PR review: isNewThread alone reflects only the
    // bootstrap-time snapshot, so without this it would stay true (and the
    // banner would stay visible) for the rest of the mount even after the
    // operator sends the first message. agent.messages.length is the live
    // signal CopilotChat's own (now-unreachable) welcome screen used to key
    // off, so PlannerChatDock mirrors it here.
    useAgentMock.mockReturnValue({
      agent: { messages: [{ id: "m1", role: "user", content: "hi" }] },
    });

    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={0} shootCount={0} />
      </OperatorPanel>,
    );

    await waitFor(() => expect(screen.getByTestId("copilot-chat-stub")).toBeDefined());
    expect(
      screen.queryByText("Start by creating a brand or planning your first shoot."),
    ).toBeNull();
  });

  it("never reuses a stored thread id the authenticated resource does not own", async () => {
    // Simulates a stored id from another account/browser profile — the
    // exact case resolvePlannerThreadId's membership check exists to catch
    // (thread-types.ts). Falling back to the resource's own first thread
    // instead of blindly trusting localStorage is the required behavior.
    window.localStorage.setItem(plannerThreadStorageKey(DEFAULT_RESOURCE_ID), "someone-elses-thread");
    mockThreadsFetch(
      () =>
        new Response(
          JSON.stringify({
            resourceId: DEFAULT_RESOURCE_ID,
            threads: [{ id: "thread-a", title: "t", createdAt: "x", updatedAt: "x" }],
          }),
          { status: 200 },
        ),
    );

    render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("copilot-chat-stub").getAttribute("data-thread-id")).toBe("thread-a"),
    );
  });

  it("renders an honest error state on bootstrap failure, and Retry actually recovers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("server error", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resourceId: DEFAULT_RESOURCE_ID, threads: [] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText("Could not load conversation.")).toBeDefined();
    expect(screen.queryByTestId("copilot-chat-stub")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByTestId("copilot-chat-stub")).toBeDefined());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight bootstrap request on unmount", () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal?.aborted).toBe(false);

    unmount();

    expect(init?.signal?.aborted).toBe(true);
  });

  it("does not write localStorage if unmounted while response.json() was still pending", async () => {
    // response.json() is itself async — the request can have already
    // arrived (fetch() resolved) when unmount happens, with only the body
    // parse still in flight. Without the aborted-check placed after that
    // await, this write would still land on an unmounted component.
    let resolveJson!: (body: unknown) => void;
    const pendingJson = new Promise((resolve) => {
      resolveJson = resolve;
    });
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => pendingJson } as unknown as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();

    resolveJson({ resourceId: DEFAULT_RESOURCE_ID, threads: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.localStorage.getItem(plannerThreadStorageKey(DEFAULT_RESOURCE_ID))).toBeNull();
  });
});

describe("navItemIsActive", () => {
  it("treats Home as exact /app only", () => {
    expect(navItemIsActive("/app", "/app")).toBe(true);
    expect(navItemIsActive("/app/brands", "/app")).toBe(false);
  });

  it("keeps nested brand routes under Brands", () => {
    expect(navItemIsActive("/app/brands/acme", "/app/brands")).toBe(true);
  });
});
