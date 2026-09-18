// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";

import { plannerThreadStorageKey } from "@/mastra/thread-types";

type MqListener = (event: MediaQueryListEvent) => void;

const MOBILE_NAV_QUERY = "(max-width: 767px)";
const COPILOT_COMPACT_QUERY = "(max-width: 1023px)";

function parseMaxWidth(query: string): number | null {
  const match = /max-width:\s*(\d+)px/.exec(query);
  return match ? Number(match[1]) : null;
}

/** Simulates window.matchMedia against one numeric viewport width, so the
 *  nav's own MOBILE_NAV_QUERY (767px) and the panel's COPILOT_COMPACT_QUERY
 *  (1023px) — a real ~900px tablet width matches the second but not the
 *  first — resolve consistently for one simulated width, instead of a
 *  single hardcoded "767" string match. */
function mockViewportWidth(px: number) {
  const registry = new Map<string, { matches: boolean; listeners: Set<MqListener> }>();

  function entryFor(query: string) {
    let entry = registry.get(query);
    if (!entry) {
      const maxWidth = parseMaxWidth(query);
      entry = { matches: maxWidth !== null && px <= maxWidth, listeners: new Set() };
      registry.set(query, entry);
    }
    return entry;
  }

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const entry = entryFor(query);
      return {
        get matches() {
          return entry.matches;
        },
        media: query,
        addEventListener: (_event: string, cb: MqListener) => {
          entry.listeners.add(cb);
        },
        removeEventListener: (_event: string, cb: MqListener) => {
          entry.listeners.delete(cb);
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });

  return {
    // Mirrors a real window resize: every registered query re-evaluates
    // against the new width, same as the browser would.
    setWidth(next: number) {
      px = next;
      for (const [query, entry] of registry) {
        const maxWidth = parseMaxWidth(query);
        const changed = (maxWidth !== null && px <= maxWidth) !== entry.matches;
        entry.matches = maxWidth !== null && px <= maxWidth;
        if (changed) {
          for (const cb of entry.listeners) cb({ matches: entry.matches } as MediaQueryListEvent);
        }
      }
    },
    hasListener(query: string) {
      return (registry.get(query)?.listeners.size ?? 0) > 0;
    },
  };
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
const addMessageMock = vi.hoisted(() => vi.fn());
const useAgentMock = vi.hoisted(() =>
  vi.fn(() => ({
    agent: { messages: [] as unknown[], addMessage: addMessageMock, isRunning: false },
  })),
);

const runAgentMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@copilotkit/react-core/v2", () => ({
  CopilotKit: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAgent: useAgentMock,
  // IPI-1224: insight buttons send via agent.addMessage + copilotkit.runAgent
  // (the documented agent-access pattern) — stubbed the same shape here.
  useCopilotKit: () => ({ copilotkit: { runAgent: runAgentMock } }),
  // IPI-1084 registers the ShootPlan review HITL renderer inside the provider.
  // These tests assert the shell/nav/rail, so the registration is a no-op here.
  useHumanInTheLoop: () => {},
  // IPI-1233 registers the composeShootPlan named renderer inside the same
  // provider — same no-op treatment as useHumanInTheLoop above.
  useRenderTool: () => {},
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

type ThreadsFetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Response | Promise<Response>;

/** IPI-1217: PlannerChatDock now bootstraps a thread via
 *  GET /api/planner/threads before mounting CopilotChat — every test needs
 *  this mocked or the dock sticks on "Loading conversation…" forever. */
function mockThreadsFetch(
  impl: ThreadsFetchImpl = () =>
    new Response(JSON.stringify({ resourceId: DEFAULT_RESOURCE_ID, threads: [] }), { status: 200 }),
) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

beforeEach(() => {
  mockThreadsFetch();
  window.localStorage.clear();
  addMessageMock.mockReset();
  runAgentMock.mockReset();
  runAgentMock.mockResolvedValue(undefined);
  useAgentMock.mockReturnValue({
    agent: { messages: [], addMessage: addMessageMock, isRunning: false },
  });
  restoreAutoSettle.current = true;
  capturedOnSettled.current = null;
  // mockViewportWidth overrides window.matchMedia via Object.defineProperty,
  // not vi.stubGlobal — vi.unstubAllGlobals() in afterEach below doesn't
  // touch it, so a mobile/tablet-simulating test would otherwise leak that
  // override into whichever test runs next. Reset to a safe "always
  // desktop, never matches" default before every test; a test that needs
  // a narrower viewport calls mockViewportWidth(px) itself.
  mockViewportWidth(Number.POSITIVE_INFINITY);
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
    // No real WorkspaceStats reported here — the pinned rail is omitted
    // entirely rather than rendering an empty styled bar (see the
    // dedicated "omits the pinned rail entirely..." test below).
    expect(screen.queryByTestId("intelligence-rail")).toBeNull();
    // Persistent CopilotKit chat dock — center workspace, not the rail.
    expect(screen.getByTestId("operator-chat-dock")).toBeDefined();
    await waitFor(() => expect(screen.getByTestId("copilot-chat-stub")).toBeDefined());
    // IPI-1225 · PLANNER-ROUTE-RETIRE-001 — /app is the single production
    // Planner surface now; no separate "Open Planner" escape hatch.
    expect(screen.queryByRole("link", { name: "Open Planner" })).toBeNull();
    for (const item of OPERATOR_NAV) {
      expect(screen.getByRole("link", { name: item.label })).toBeDefined();
    }
  });

  it("opens and closes the Production Copilot panel without remounting the chat", async () => {
    render(
      <OperatorPanel>
        <p>Workspace body</p>
      </OperatorPanel>,
    );

    const panel = screen.getByTestId("operator-chat-dock");
    const chat = await screen.findByTestId("copilot-chat-stub");

    // Open by default — see operator-panel.tsx's copilotOpen comment: the
    // required playwright-ai-smoke/gate-9 e2e specs interact with the
    // composer immediately after navigation with no "open" step of their
    // own, and the acceptance criteria never mandate a closed default.
    expect(panel.getAttribute("data-open")).toBe("true");
    const closeButton = screen.getByRole("button", { name: "Close Copilot" });
    // "Open Copilot" is the only control visible while closed; the panel's
    // own ✕ is the only control visible while open (Final Design state
    // machine) — so the open button doesn't exist while already open.
    expect(screen.queryByRole("button", { name: "✦ Open Copilot" })).toBeNull();

    fireEvent.click(closeButton);

    expect(panel.getAttribute("data-open")).toBe("false");
    // Chat stays mounted even while closed — only CSS/inert toggles, so a
    // real conversation is never torn down just by closing the panel.
    expect(screen.getByTestId("copilot-chat-stub")).toBe(chat);

    const openButton = screen.getByRole("button", { name: "✦ Open Copilot" });
    expect(openButton.getAttribute("aria-expanded")).toBe("false");
    expect(openButton.getAttribute("aria-controls")).toBe("operator-chat-panel");

    fireEvent.click(openButton);

    expect(panel.getAttribute("data-open")).toBe("true");
    expect(screen.getByTestId("copilot-chat-stub")).toBe(chat);
  });

  it("restores focus to Open Copilot after a user closes the panel", async () => {
    render(
      <OperatorPanel>
        <p>Workspace body</p>
      </OperatorPanel>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close Copilot" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "✦ Open Copilot" })),
    );
  });

  it("closes the Copilot panel automatically on mobile instead of covering the dashboard on load", async () => {
    mockViewportWidth(390);
    render(
      <OperatorPanel>
        <p>Workspace body</p>
      </OperatorPanel>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("operator-chat-dock").getAttribute("data-open")).toBe("false"),
    );
    expect(screen.getByRole("button", { name: "✦ Open Copilot" })).toBeDefined();
    // Mobile auto-close is a background effect, not a user-initiated close —
    // it must never steal focus on page load.
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "✦ Open Copilot" }));
  });

  it("omits the pinned rail entirely when there are no insights, instead of an empty styled bar", () => {
    render(
      <OperatorPanel>
        <p>Workspace body</p>
      </OperatorPanel>,
    );
    // Not just empty — absent. An unconditionally-rendered pinnedBar would
    // show a blank padded strip on every route without real stats yet.
    expect(screen.queryByTestId("intelligence-rail")).toBeNull();
    expect(screen.queryByTestId("intelligence-workspace-stats")).toBeNull();
    expect(screen.queryByTestId("intelligence-brand-context")).toBeNull();
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

  it("submits a clickable insight to the same agent and blocks competing runs", async () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={2} shootCount={1} />
      </OperatorPanel>,
    );

    const insight = screen.getByTestId("intelligence-workspace-stats") as HTMLButtonElement;
    await waitFor(() => expect(insight.disabled).toBe(false));
    fireEvent.click(insight);
    expect(addMessageMock).toHaveBeenCalledTimes(1);
    expect(addMessageMock.mock.calls[0]?.[0]).toMatchObject({
      role: "user",
      content: "Give me an overview of my current shoots.",
    });
    expect(runAgentMock).toHaveBeenCalledTimes(1);
  });

  it("ask()'s own guard blocks a run even when the disabled attribute hasn't caught up yet", async () => {
    // The real useAgent() here isn't subscribed to OnRunStatusChanged, so
    // agent.isRunning flipping true doesn't necessarily trigger a re-render
    // — the disabled attribute (computed at last render) can stay stale
    // while the live agent object already says isRunning. Mutating the
    // *same* mocked agent object in place (not swapping mockReturnValue,
    // which would force a fresh disabled=true render and only prove the
    // native disabled-button behavior) reproduces exactly that gap, so this
    // proves ask()'s own internal guard — not the disabled attribute — is
    // what actually stops the click.
    const agent = { messages: [] as unknown[], addMessage: addMessageMock, isRunning: false };
    useAgentMock.mockReturnValue({ agent });

    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={2} shootCount={1} />
      </OperatorPanel>,
    );

    const insight = screen.getByTestId("intelligence-workspace-stats") as HTMLButtonElement;
    await waitFor(() => expect(insight.disabled).toBe(false));

    agent.isRunning = true;
    // Still enabled from React's perspective — no re-render has happened.
    expect(insight.disabled).toBe(false);

    fireEvent.click(insight);
    expect(addMessageMock).not.toHaveBeenCalled();
    expect(runAgentMock).not.toHaveBeenCalled();
  });

  it("intelligence drawer moves focus to Back on open, and Escape returns it to the opener", async () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={2} shootCount={1} />
      </OperatorPanel>,
    );

    const opener = await screen.findByRole("button", { name: "View all intelligence →" });
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "All intelligence" });
    const backButton = within(dialog).getByRole("button", { name: "← Back" });
    await waitFor(() => expect(document.activeElement).toBe(backButton));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("intelligence-drawer")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("closes the intelligence drawer when the panel itself closes, so it doesn't reappear on reopen", async () => {
    // The panel is never unmounted on close, so drawerOpen would otherwise
    // survive a close/reopen cycle unchanged and reappear over the
    // conversation with no new click from the user.
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={2} shootCount={1} />
      </OperatorPanel>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "View all intelligence →" }));
    expect(screen.getByTestId("intelligence-drawer")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Close Copilot" }));
    await waitFor(() => expect(screen.queryByTestId("intelligence-drawer")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "✦ Open Copilot" }));
    expect(screen.queryByTestId("intelligence-drawer")).toBeNull();
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
    mockViewportWidth(390);
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
    const mq = mockViewportWidth(390);
    const { unmount } = render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );
    const nav = document.getElementById("operator-nav");
    await waitFor(() => expect(nav?.hasAttribute("inert")).toBe(true));
    expect(mq.hasListener(MOBILE_NAV_QUERY)).toBe(true);

    mq.setWidth(1280);
    await waitFor(() => expect(nav?.hasAttribute("inert")).toBe(false));

    unmount();
    expect(mq.hasListener(MOBILE_NAV_QUERY)).toBe(false);
  });

  it("closes the Copilot panel on a tablet-width viewport (nav stays a normal grid column)", async () => {
    // The panel-compact breakpoint (1023px) is deliberately wider than the
    // nav's own mobile breakpoint (767px) — a real ~900px tablet crosses
    // the first without crossing the second, and the two behaviors must
    // stay independent: only the Copilot panel reacts here.
    const mq = mockViewportWidth(900);
    render(
      <OperatorPanel>
        <p>Workspace body</p>
      </OperatorPanel>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("operator-chat-dock").getAttribute("data-open")).toBe("false"),
    );
    expect(screen.getByRole("button", { name: "✦ Open Copilot" })).toBeDefined();
    expect(mq.hasListener(COPILOT_COMPACT_QUERY)).toBe(true);
    // Nav is untouched at this width — no off-canvas/inert behavior.
    const nav = document.getElementById("operator-nav");
    expect(nav?.hasAttribute("inert")).toBe(false);
    expect(mq.hasListener(MOBILE_NAV_QUERY)).toBe(true);
  });
});

type ResolveFetch = (response: Response) => void;

describe("PlannerChatDock thread bootstrap (IPI-1217)", () => {
  it("shows the loading state before the bootstrap resolves, then mounts chat", async () => {
    let resolveFetch!: ResolveFetch;
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
      agent: {
        messages: [{ id: "m1", role: "user", content: "hi" }],
        addMessage: addMessageMock,
        isRunning: false,
      },
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
    // (thread-types.ts). IPI-1217: falling back to the resource's own most
    // recent OTHER thread used to be the behavior here, but that's still a
    // different conversation than the operator asked for — confirmed live
    // that this can silently land the operator's next message in someone
    // else's (or just some other) conversation. A fresh thread is required
    // instead of blindly trusting localStorage OR blindly substituting
    // another real one.
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
      expect(screen.getByTestId("copilot-chat-stub")).toBeDefined(),
    );
    const resolvedThreadId = screen
      .getByTestId("copilot-chat-stub")
      .getAttribute("data-thread-id");
    expect(resolvedThreadId).not.toBe("someone-elses-thread");
    expect(resolvedThreadId).not.toBe("thread-a");
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
    type ResolveJson = (body: unknown) => void;
    let resolveJson!: ResolveJson;
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
