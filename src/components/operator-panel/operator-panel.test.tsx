// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
// CopilotKit's internals.
vi.mock("@copilotkit/react-core/v2", () => ({
  CopilotKit: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CopilotChat: ({ labels }: { labels?: { welcomeMessageText?: string } }) => (
    <div data-testid="copilot-chat-stub">{labels?.welcomeMessageText}</div>
  ),
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

afterEach(() => cleanup());

describe("OperatorPanel", () => {
  it("renders children, destinations, and the intelligence rail slot", () => {
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
    expect(screen.getByTestId("copilot-chat-stub")).toBeDefined();
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

  it("chat welcome stays generic with no real workspace stats", () => {
    render(
      <OperatorPanel>
        <p>Body</p>
      </OperatorPanel>,
    );
    expect(screen.getByTestId("copilot-chat-stub").textContent).toBe("Ask a question to get started.");
  });

  it("chat welcome and rail name the real brand and its own recent shoot when populated", () => {
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
    expect(screen.getByTestId("copilot-chat-stub").textContent).toBe(
      "You're working with Maaji. Portfolio: 3 brands · 12 shoots. Ask about recent production or your next shoot.",
    );
    const rail = screen.getByTestId("intelligence-rail");
    expect(within(rail).getByTestId("intelligence-brand-context").textContent).toBe(
      "Current brand: Maaji",
    );
    expect(within(rail).getByTestId("intelligence-recent-shoot").textContent).toBe(
      "Spring hero · in_review",
    );
  });

  it("never fabricates a recent-shoot line when the brand has none", () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={1} shootCount={0} brandName="Acme" />
      </OperatorPanel>,
    );
    expect(screen.getByTestId("copilot-chat-stub").textContent).toBe(
      "You're working with Acme. Portfolio: 1 brand · 0 shoots. Ask about recent production or your next shoot.",
    );
    expect(screen.queryByTestId("intelligence-recent-shoot")).toBeNull();
  });

  it("chat welcome and rail stay honest for a zero-brand org — no guessed brand", () => {
    render(
      <OperatorPanel>
        <ReportWorkspaceStats brandCount={0} shootCount={0} />
      </OperatorPanel>,
    );
    expect(screen.getByTestId("copilot-chat-stub").textContent).toBe(
      "Start by creating a brand or planning your first shoot.",
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

describe("navItemIsActive", () => {
  it("treats Home as exact /app only", () => {
    expect(navItemIsActive("/app", "/app")).toBe(true);
    expect(navItemIsActive("/app/brands", "/app")).toBe(false);
  });

  it("keeps nested brand routes under Brands", () => {
    expect(navItemIsActive("/app/brands/acme", "/app/brands")).toBe(true);
  });
});
