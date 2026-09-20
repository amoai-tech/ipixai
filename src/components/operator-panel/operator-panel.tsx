"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type Ref } from "react";
import { CopilotChat, CopilotKit, useAgent, useCopilotKit } from "@copilotkit/react-core/v2";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { navItemIsActive, OPERATOR_NAV } from "./nav";
import styles from "./operator-panel.module.css";
import { useWorkspaceStats, WorkspaceStatsProvider } from "./workspace-stats";
import type { WorkspaceStats } from "./workspace-stats";
import { PlannerContextProvider, usePlannerContext } from "./planner-context";
import { RestoreMastraHistory } from "@/components/restore-mastra-history";
import { ComposeShootPlanRenderer } from "@/components/shoot/compose-shoot-plan-renderer";
import { ShootPlanReviewHitl } from "@/components/shoot/shoot-plan-review-hitl";
import {
  plannerThreadStorageKey,
  resolvePlannerThreadId,
  type PlannerThreadRow,
} from "@/mastra/thread-types";

// Keep in sync with operator-panel.module.css @media (max-width: 767px)
const MOBILE_NAV = "(max-width: 767px)";
// Keep in sync with operator-panel.module.css's 1023px panel-compact block.
// Deliberately wider than MOBILE_NAV: a permanent 400-520px side column
// plus the 14rem nav leaves the workspace unusably narrow well before true
// mobile (a real ~900px tablet width crushes it to a couple hundred px) —
// only the Copilot panel reacts to this breakpoint, not the nav.
const COPILOT_COMPACT = "(max-width: 1023px)";

/** Single source of truth for "N brand(s) · N shoot(s)" — the pinned bar and
 *  the chat welcome each rendered their own brandNoun/shootNoun before this,
 *  so the two surfaces could silently drift on pluralization wording. */
function formatPortfolioCounts(stats: Pick<WorkspaceStats, "brandCount" | "shootCount">): string {
  const brandNoun = stats.brandCount === 1 ? "brand" : "brands";
  const shootNoun = stats.shootCount === 1 ? "shoot" : "shoots";
  return `${stats.brandCount} ${brandNoun} · ${stats.shootCount} ${shootNoun}`;
}

function useMatchMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

function useMobileNav() {
  return useMatchMedia(MOBILE_NAV);
}

/**
 * `/app`-specific derived state: real, uncapped brand/shoot counts (and the
 * real first-brand name, when there is one) for the dashboard route only
 * (see AppHomePage's ReportWorkspaceStats). Every other route — and the
 * dashboard before its stats have loaded — falls back to generic copy and
 * zero insights, never a fabricated value.
 */
type Insight = {
  id: string;
  testId: string;
  text: string;
  /** Question submitted to the same conversation thread when clicked. Null
   *  for an informational line (e.g. a failed lookup) that isn't a safe or
   *  meaningful thing to ask about. */
  question: string | null;
};

function useIntelligence(
  pathname: string,
  stats: WorkspaceStats | null,
): { contextLine: string; insights: Insight[] } {
  if (pathname !== "/app" || !stats) {
    // Distinct from portfolioWelcomeText's generic fallback (also "Ask a
    // question…") on purpose — this is a header *context* line, not the
    // conversation's own welcome banner, and the two must never collide in
    // a query for one accidentally matching the other.
    return { contextLine: "", insights: [] };
  }

  const insights: Insight[] = [];
  if (stats.brandName) {
    insights.push({
      id: "brand",
      testId: "intelligence-brand-context",
      text: `Current brand: ${stats.brandName}`,
      question: `Tell me about ${stats.brandName}'s current Brand DNA status.`,
    });
  }
  insights.push({
    id: "workspace-stats",
    testId: "intelligence-workspace-stats",
    text: `${formatPortfolioCounts(stats)} in this workspace.`,
    question: "Give me an overview of my current shoots.",
  });
  // Distinct from "brand genuinely has no shoots" (below): a failed lookup
  // says so honestly instead of silently looking identical to a confirmed-
  // empty brand. Not clickable — nothing real to ask about a failed lookup.
  if (stats.recentShootLookupFailed) {
    insights.push({
      id: "recent-shoot-unavailable",
      testId: "intelligence-recent-shoot-unavailable",
      text: "Couldn't load right now.",
      question: null,
    });
  } else if (stats.recentShootName) {
    insights.push({
      id: "recent-shoot",
      testId: "intelligence-recent-shoot",
      text: `${stats.recentShootName}${stats.recentShootStatus ? ` · ${stats.recentShootStatus}` : ""}`,
      question: `What's the status of ${stats.recentShootName}?`,
    });
  }

  const contextLine = stats.brandName
    ? `${stats.brandName} · ${formatPortfolioCounts(stats)}`
    : formatPortfolioCounts(stats);

  // Cap at 3 (Final Design: "up to 3 Insights, clickable") — current signals
  // never produce more than 3, but slice defensively if that ever changes.
  return { contextLine, insights: insights.slice(0, 3) };
}

/**
 * IPI-1149 · DASH-MAIN-002 — portfolio-aware Production Planner welcome
 * copy. Reuses the same real WorkspaceStats the pinned bar above renders;
 * this only changes *display* copy, not what the agent itself knows — no
 * second agent-context path (that's IPI-1087 · PLANNER-CONTEXT-001's job).
 * Every route besides `/app`, and `/app` before its stats arrive, keeps the
 * original generic copy.
 */
function portfolioWelcomeText(pathname: string, stats: WorkspaceStats | null): string {
  if (pathname !== "/app" || !stats) {
    return "Ask a question to get started.";
  }
  if (stats.brandCount === 0) {
    return "Start by creating a brand or planning your first shoot.";
  }
  const portfolio = formatPortfolioCounts(stats);
  return stats.brandName
    ? `You're working with ${stats.brandName}. Portfolio: ${portfolio}. Ask about recent production or your next shoot.`
    : `Portfolio: ${portfolio}. Ask about recent production or your next shoot.`;
}

/**
 * IPI-1217 · COPILOT-APP-DOCK-002 — resolve the same tenant-scoped persisted
 * thread `/api/planner/threads` already exposes before mounting CopilotChat.
 * Without an explicit threadId here, CopilotChat never
 * showed a response: the network run completed but the visible chat stayed
 * empty (proven live, see IPI-1217). This is the same bootstrap contract,
 * without the thread-list UI — `/app` only needs one stable conversation
 * identity, not thread management.
 */
function usePlannerThreadBootstrap() {
  const [threadId, setThreadId] = useState<string | null>(null);
  // True only when the resolved id came from crypto.randomUUID() — i.e. it
  // wasn't in the resource's own thread list at all, so it's guaranteed to
  // have zero prior messages. Needed because giving CopilotChat an explicit
  // threadId (the IPI-1217 fix) also turns off CopilotChat's own built-in
  // welcome screen (react-core/v2's hasExplicitThreadId gate) — so the
  // portfolio-aware welcome copy IPI-1149 shipped has to be rendered here
  // instead of relying on CopilotChat's labels.welcomeMessageText, which is
  // now unreachable for any explicitly-threaded chat.
  const [isNewThread, setIsNewThread] = useState(false);
  const [threadError, setThreadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setThreadId(null);
    setThreadError(false);

    void (async () => {
      try {
        const response = await fetch("/api/planner/threads", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`GET /api/planner/threads -> ${response.status}`);
        const body = (await response.json()) as {
          resourceId?: string;
          threads?: PlannerThreadRow[];
        };
        // response.json() is itself async — the component can have
        // unmounted (or a retry can have superseded this attempt) while it
        // was pending, so a resolved-too-late response can't still write
        // localStorage/state for a request nothing is waiting on.
        if (controller.signal.aborted) return;
        // Only the resourceId the server actually returns is trusted —
        // never a client-supplied one — so a stored thread from a previous
        // account can never be persisted/reused under someone else's key.
        const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
        if (!resourceId) throw new Error("GET /api/planner/threads -> missing resourceId");
        // Array.isArray, not just `?? []`: a malformed/non-array response
        // body would otherwise throw inside .some() below instead of
        // falling into the honest error state.
        const rows = Array.isArray(body.threads) ? body.threads : [];
        const storageKey = plannerThreadStorageKey(resourceId);
        const stored = window.localStorage.getItem(storageKey);
        const resolved = resolvePlannerThreadId(rows, stored);
        window.localStorage.setItem(storageKey, resolved);
        setIsNewThread(!rows.some((row) => row.id === resolved));
        setThreadId(resolved);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("PlannerChatDock: thread bootstrap failed", error);
        setThreadError(true);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [retryKey]);

  return {
    threadId,
    isNewThread,
    threadError,
    retry: () => {
      setRetryKey((n) => n + 1);
    },
  };
}

/**
 * Everything that depends on one specific resolved thread. Rendered with
 * `key={threadId}` by PlannerChatDock so React remounts it fresh — including
 * a fresh `restoreSettled` state — whenever the resolved thread actually
 * changes, instead of a manual reset effect. That reset effect was tried
 * first and had a real bug: it shares a dependency (threadId/isNewThread)
 * with the very transition that also mounts RestoreMastraHistory, so on the
 * same commit where RestoreMastraHistory's effect calls onSettled(true),
 * this component's own reset effect (parent effects run after child
 * effects) fired right after and clobbered it back to false — the gate
 * never actually opened. The `key` remount avoids that whole class of race.
 */
function ResolvedChatDock({
  pathname,
  threadId,
  isNewThread,
  composerContainerRef,
  onReady,
}: {
  pathname: string;
  threadId: string;
  isNewThread: boolean;
  composerContainerRef?: Ref<HTMLDivElement>;
  onReady?: (ready: boolean) => void;
}) {
  const stats = useWorkspaceStats();
  // Called unconditionally (rules of hooks). Once the operator sends the
  // first message, agent.messages.length flips to >0 and the welcome
  // banner below hides itself, matching how CopilotChat's own
  // (now-unreachable) welcome screen used to behave via messages.length.
  const { agent } = useAgent({ agentId: "default" });
  const hasMessages = (agent.messages?.length ?? 0) > 0;
  // Gate CopilotChat's interactivity until an existing thread's history
  // restore has actually settled — confirmed live (IPI-1217): sending while
  // RestoreMastraHistory's fetch is still in flight can race its
  // agent.setMessages(...) call and silently drop the new message. A
  // genuinely new thread has nothing to restore, so it starts settled.
  const [restoreSettled, setRestoreSettled] = useState(isNewThread);

  // Only enable contextual Insight commands after the exact threaded chat is
  // mounted and history restore has settled. Child effects run before this
  // parent effect, so CopilotChat has already assigned its resolved threadId
  // to the shared `default` agent by the time `ready=true` is published.
  useEffect(() => {
    onReady?.(restoreSettled);
    return () => {
      onReady?.(false);
    };
  }, [onReady, restoreSettled]);

  // An explicit threadId makes CopilotChat *connect* to the live stream
  // (the IPI-1217 fix — proven live), but connectAgent() alone doesn't
  // reliably backfill an existing thread's past messages: it depends on
  // AG-UI's own reconnect protocol, which iPix's SSE runtime
  // (TenantAbortRunner extends InMemoryAgentRunner, not a persisting one)
  // doesn't guarantee. RestoreMastraHistory pulls the authoritative
  // Mastra/Postgres messages for this thread and calls agent.setMessages(...)
  // directly — no second persistence path.
  // It's mounted here even while !restoreSettled specifically so its own
  // effect actually runs and can call onSettled; only the visible chat
  // surface below is held back until then. Only for an existing thread: a
  // genuinely new one has no history to restore.
  const restoreHistory = !isNewThread ? (
    <RestoreMastraHistory
      threadId={threadId}
      replay
      onSettled={() => {
        setRestoreSettled(true);
      }}
    />
  ) : null;

  if (!restoreSettled) {
    return (
      <div className={styles.panelChatShell}>
        {restoreHistory}
        <p role="status" className={styles.panelStatus}>
          Loading conversation…
        </p>
      </div>
    );
  }

  // CopilotChat's own welcome screen never renders once threadId is
  // explicit (see hasExplicitThreadId gate above), so the portfolio-aware
  // copy is rendered here instead, only for a thread that's both genuinely
  // new (isNewThread) and still empty (!hasMessages) — an existing or
  // already-started conversation shouldn't show a "welcome" banner above
  // its real history. labels.welcomeMessageText is kept as a harmless
  // fallback in case that gate ever changes upstream.
  return (
    <div className={styles.panelChatShell}>
      {restoreHistory}
      {isNewThread && !hasMessages && (
        <p className={styles.panelWelcome}>{portfolioWelcomeText(pathname, stats)}</p>
      )}
      <div className={styles.panelChat}>
        {/* IPI-1224: className overrides on messageView/scrollView/input are
            real CopilotKit v2 Slots (SlotValue<C> = C | string | Partial
            <ComponentProps<C>>, verified against the installed 1.68.1
            types) — narrows the message column to a readable width inside
            the ~400-520px panel instead of the old full-width dock, without
            replacing any of CopilotChat's own message/streaming/composer
            behavior (Headless UI is the fallback, not used here). */}
        <CopilotChat
          agentId="default"
          threadId={threadId}
          labels={{ welcomeMessageText: portfolioWelcomeText(pathname, stats) }}
          messageView={{ className: styles.panelMessageView }}
          scrollView={{ className: styles.panelScrollView }}
          input={{ className: styles.panelInput, containerRef: composerContainerRef }}
        />
      </div>
    </div>
  );
}

/** Reads WorkspaceStats from inside the provider (OperatorPanel's own body
 *  sits above it in the tree, so it can't call the hook directly) and hands
 *  CopilotChat portfolio-aware welcome copy instead of a static string. */
function PlannerChatDock({
  pathname,
  composerContainerRef,
  onReady,
}: {
  pathname: string;
  composerContainerRef?: Ref<HTMLDivElement>;
  onReady?: (ready: boolean) => void;
}) {
  const { threadId, isNewThread, threadError, retry } = usePlannerThreadBootstrap();

  if (threadError) {
    return (
      <div role="alert" className={styles.panelStatus}>
        <p>Could not load conversation.</p>
        <Button type="button" variant="outline" size="sm" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!threadId) {
    return (
      <p role="status" className={styles.panelStatus}>
        Loading conversation…
      </p>
    );
  }

  return (
    <ResolvedChatDock
      key={threadId}
      pathname={pathname}
      threadId={threadId}
      isNewThread={isNewThread}
      composerContainerRef={composerContainerRef}
      onReady={onReady}
    />
  );
}

/** "View all intelligence" overlay — a plain absolutely-positioned layer
 *  scoped to the conversation area's own box (styles.panelBody), never the
 *  whole panel and never the composer (see .intelligenceDrawer's fixed
 *  bottom reserve). Toggled by local state only; does not touch the thread.
 *  Real per-area sections (Missing Shots, Approval Status, ...) are owned by
 *  IPI-1140 and later per-area tickets — stubbed here, per this ticket's
 *  explicit "Intelligence data is out of this ticket's Done" scope note.
 *
 *  Known a11y gap: the conversation area behind this overlay isn't marked
 *  `inert` (so its own interactive content stays Tab-reachable while
 *  visually covered). CopilotChat renders messageView/scrollView/input as
 *  one composed subtree (see ResolvedChatDock) — isolating "conversation
 *  only, not composer" would mean pulling that composition apart into
 *  separately-wrapped Slots, a bigger, separately-scoped change. The overlay
 *  already blocks pointer interaction (z-index, opaque background) and
 *  keyboard users land on the dialog's own Back control on open. */
function IntelligenceDrawer({ contextLine, insights, onBack, onAsk, askDisabled }: {
  contextLine: string;
  insights: Insight[];
  onBack: () => void;
  onAsk: (_question: string) => void;
  askDisabled: boolean;
}) {
  const backRef = useRef<HTMLButtonElement>(null);

  // Non-modal (composer stays usable underneath, so no aria-modal and no
  // page-wide focus trap) — just a disclosure that owns initial focus and
  // Escape, like any other overlay panel.
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  return (
    <div
      className={styles.intelligenceDrawer}
      data-testid="intelligence-drawer"
      role="dialog"
      aria-label="All intelligence"
    >
      <div className={styles.drawerHeader}>
        <button type="button" ref={backRef} className={styles.drawerBack} onClick={onBack}>
          ← Back
        </button>
        <span className={styles.panelContext}>{contextLine}</span>
      </div>
      <p className={styles.drawerSectionTitle}>Insights</p>
      {insights.length === 0 ? (
        <p className={styles.railBody}>Nothing to show yet.</p>
      ) : (
        insights.map((insight) => (
          <button
            key={insight.id}
            type="button"
            className={styles.insightButton}
            data-testid={insight.testId}
            disabled={!insight.question || askDisabled}
            onClick={() => insight.question && onAsk(insight.question)}
          >
            {insight.text}
          </button>
        ))
      )}
      <p className={styles.drawerNote}>
        Deeper per-area intelligence (Missing Shots, Approval Status, Schedule Risk, and more) lands with
        IPI-1140 · INTELLIGENCE-RAIL-001.
      </p>
    </div>
  );
}

/**
 * Production Copilot right panel (IPI-1224 Final Design) — one panel, not an
 * Intelligence/Planner tab pair: Context → Insights → Conversation, with
 * "View all intelligence" as an overlay, never a competing screen. Always
 * mounted (see operator-panel.module.css .panel/.shellPanelOpen) so opening/
 * closing never remounts CopilotChat or changes threadId — only CSS width/
 * inert toggle, the same contract Phase 1 (PR #194) already proved for the
 * old dock's expand/collapse.
 */
function ProductionCopilotPanel({
  pathname,
  open,
  onClose,
}: {
  pathname: string;
  open: boolean;
  onClose: () => void;
}) {
  const stats = useWorkspaceStats();
  const plannerContext = usePlannerContext();
  const { contextLine: dashboardContextLine, insights } = useIntelligence(pathname, stats);
  // IPI-1087 · PLANNER-CONTEXT-001 — on a Brand/Shoot page, show the same
  // server-authorized PlannerContext the model itself receives (see
  // ReportPlannerContext's useAgentContext call) instead of the Dashboard's
  // WorkspaceStats-derived line, which useIntelligence already correctly
  // leaves empty off `/app`. This is display-only; it never becomes the
  // model's context source, and it never overrides the Dashboard case.
  const contextLine = plannerContext?.shoot
    ? plannerContext.brand
      ? `${plannerContext.brand.name} · ${plannerContext.shoot.name}`
      : plannerContext.shoot.name
    : plannerContext?.brand
      ? plannerContext.brand.name
      : dashboardContextLine;
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Whichever control opened the drawer (header badge or "View all
  // intelligence") gets focus back once it closes — standard disclosure
  // pattern, and the only way a keyboard user doesn't lose their place.
  const drawerOpenerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!drawerOpen) drawerOpenerRef.current?.focus();
  }, [drawerOpen]);
  // The panel itself is never unmounted on close (see the no-remount
  // contract above), so drawerOpen would otherwise survive a close/reopen
  // cycle unchanged — open the drawer, close the panel, reopen it, and the
  // drawer would reappear immediately over the conversation with no new
  // click from the user. The drawer is conceptually scoped to one open
  // session of the panel, not persistent across it closing.
  useEffect(() => {
    if (!open) setDrawerOpen(false);
  }, [open]);
  const [composerElement, setComposerElement] = useState<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const [chatReady, setChatReady] = useState(false);
  const { agent } = useAgent({ agentId: "default" });
  const { copilotkit } = useCopilotKit();
  // Synchronous, local guard — agent.isRunning is only as fresh as the last
  // render, so two clicks inside the same event-loop turn (before a real
  // run-status update lands) could both pass an isRunning-only check and
  // fire two competing runs. This closes that window regardless of when/
  // whether the real agent object's isRunning flips.
  const askInFlightRef = useRef(false);

  // The CopilotKit input auto-grows. Measure its real outer container so the
  // intelligence drawer can stop above the composer at every height instead
  // of relying on a brittle fixed reserve. Installed 1.68.1 exposes
  // input.containerRef specifically for this outer positioning container.
  useEffect(() => {
    if (!composerElement) {
      setComposerHeight(0);
      return;
    }
    const updateHeight = () => {
      setComposerHeight(composerElement.getBoundingClientRect().height);
    };
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(composerElement);
    return () => observer.disconnect();
  }, [composerElement]);

  // Local UI-state side effect only — not a thread/runtime change. Sends on
  // the same explicit threadId CopilotChat is already mounted against, via
  // the documented agent-access pattern (agent.addMessage + runAgent). Guard
  // while a run is active so a contextual Insight cannot start a competing
  // agent run or duplicate a user's in-flight request.
  const ask = (question: string) => {
    if (!chatReady || agent.isRunning || askInFlightRef.current) return;
    askInFlightRef.current = true;
    setDrawerOpen(false);
    agent.addMessage({ id: crypto.randomUUID(), role: "user", content: question });
    void copilotkit
      .runAgent({ agent })
      .catch((error) => {
        console.error("ProductionCopilotPanel: insight run failed", error);
      })
      .finally(() => {
        askInFlightRef.current = false;
      });
  };

  return (
    <aside
      className={cn(styles.panel, open && styles.panelOpenMobile)}
      data-testid="operator-chat-dock"
      data-open={open ? "true" : "false"}
      id="operator-chat-panel"
      aria-label="Production Copilot"
      inert={!open ? true : undefined}
    >
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.panelTitleText}>Production Copilot</span>
          {contextLine && (
            <span className={styles.panelContext} data-testid="production-copilot-context-line">
              {contextLine}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {insights.length > 0 && (
            <button
              type="button"
              className={styles.intelligenceBadge}
              onClick={(event) => {
                drawerOpenerRef.current = event.currentTarget;
                setDrawerOpen(true);
              }}
              aria-label={`${insights.length} insights — view all intelligence`}
            >
              {insights.length} {insights.length === 1 ? "Insight" : "Insights"}
            </button>
          )}
          <Button type="button" variant="ghost" size="sm" aria-label="Close Copilot" onClick={onClose}>
            ✕
          </Button>
        </div>
      </div>

      {/* Conditionally rendered — an unconditional empty pinnedBar (padding,
          background, border-bottom) would show as a visible blank strip on
          every route besides /app-with-loaded-stats, since insights is []
          everywhere else. */}
      {insights.length > 0 && (
        <div className={styles.pinnedBar} data-testid="intelligence-rail">
          {insights.map((insight) => (
            <button
              key={insight.id}
              type="button"
              className={styles.insightButton}
              data-testid={insight.testId}
              disabled={!insight.question || !chatReady || agent.isRunning}
              onClick={() => {
                if (insight.question) ask(insight.question);
              }}
            >
              {insight.text}
            </button>
          ))}
          <button
            type="button"
            className={styles.viewAllIntelligence}
            onClick={(event) => {
              drawerOpenerRef.current = event.currentTarget;
              setDrawerOpen(true);
            }}
          >
            View all intelligence →
          </button>
        </div>
      )}

      <div
        className={styles.panelBody}
        style={
          composerHeight > 0
            ? ({ "--copilot-composer-height": `${composerHeight}px` } as CSSProperties)
            : undefined
        }
      >
        {/* agentId="default" resolves to productionPlannerAgent
            (src/mastra/agents/index.ts, IPI-1048 · PLANNER-001). Welcome
            copy is portfolio-aware (portfolioWelcomeText, above) — display
            only, sourced from the same WorkspaceStats the pinned bar reads.
            The agent's own runtime context is untouched here; that's
            IPI-1087 · PLANNER-CONTEXT-001's job. Never conditionally
            unmounted for the drawer — the drawer overlays it instead — so
            the conversation subtree and its thread subscription stay alive
            the whole time the drawer is open. */}
        <PlannerChatDock
          pathname={pathname}
          composerContainerRef={setComposerElement}
          onReady={setChatReady}
        />
        {drawerOpen && (
          <IntelligenceDrawer
            contextLine={contextLine}
            insights={insights}
            onBack={() => setDrawerOpen(false)}
            onAsk={ask}
            askDisabled={!chatReady || Boolean(agent.isRunning)}
          />
        )}
      </div>
    </aside>
  );
}

export function OperatorPanel({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  // Starts open, not per the Final Design wireframe's illustrative default —
  // e2e/planner-journey.spec.ts (required playwright-ai-smoke journey) and
  // e2e/planner-thread-isolation.spec.ts (IPI-1217 gate 9, just certified)
  // both interact with the composer immediately after page.goto("/app")
  // with no "open the panel" step of their own; defaulting closed would
  // regress two proven, load-bearing specs for a default-state choice the
  // acceptance criteria never actually require. Open/close itself still
  // works fully — this only changes which state loads first.
  const [copilotOpen, setCopilotOpen] = useState(true);
  const isMobile = useMobileNav();
  const isCopilotCompact = useMatchMedia(COPILOT_COMPACT);
  const navInert = isMobile && !navOpen;

  // Below COPILOT_COMPACT (1023px — wider than the nav's own 767px mobile
  // breakpoint) the panel renders as a full-height sheet, not a permanent
  // grid column (operator-panel.module.css's 1023px block), so an open-by-
  // default panel there would either cover the dashboard (mobile) or leave
  // the workspace a few hundred px wide behind a permanently-reserved
  // column (tablet, before that CSS block existed) — close it the moment
  // the breakpoint is crossed. useMatchMedia() starts false and flips true
  // after its own mount-time check, so this only fires once the real
  // viewport is confirmed, not on the SSR/first-paint guess. Desktop keeps
  // the open default (see copilotOpen's own comment) since this effect
  // never fires there. Required playwright-ai-smoke/gate-9 specs run their
  // own "chromium-ai-smoke" desktop-viewport project and explicitly
  // testIgnore this file's mobile-chromium project (playwright.config.ts),
  // so they never observe this auto-close.
  useEffect(() => {
    if (isCopilotCompact) setCopilotOpen(false);
  }, [isCopilotCompact]);

  // Restore focus to the reopening control after a user-initiated close —
  // `inert` on the now-closed panel would otherwise drop focus to <body>.
  // Gated on a ref (not just "copilotOpen became false") so the automatic
  // mobile auto-close above never steals focus on page load.
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const focusOpenButtonOnCloseRef = useRef(false);
  useEffect(() => {
    if (!copilotOpen && focusOpenButtonOnCloseRef.current) {
      focusOpenButtonOnCloseRef.current = false;
      openButtonRef.current?.focus();
    }
  }, [copilotOpen]);
  const closeCopilot = () => {
    focusOpenButtonOnCloseRef.current = true;
    setCopilotOpen(false);
  };

  // useSingleEndpoint={false} matches the multi-route
  // /api/copilotkit/[[...slug]] handler — the v1-compat bridge otherwise
  // defaults to a single transport and 404s. Auth is server-side on the route itself
  // (requirePlannerResourceId re-verifies the same AUTH-002 session that
  // already gated this page), so no client handshake is needed here.
  // showDevConsole / enableInspector explicitly off: their default dev-
  // mode toast + floating inspector button sit at a high z-index and
  // intercept clicks on the real page underneath (caught by an
  // authenticated e2e smoke run — Quick Links stopped navigating with
  // the CopilotKit provider mounted and these left on their default).
  return (
    <PlannerContextProvider>
    <WorkspaceStatsProvider>
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      showDevConsole={false}
      enableInspector={false}
      publicLicenseKey={process.env.NEXT_PUBLIC_COPILOTKIT_PUBLIC_LICENSE_KEY}
    >
      {/* IPI-1084 · APPROVAL-001 — HITL plan review. Renders inside this
          existing provider (no second runtime) and only produces the review
          card when the agent requests a plan review. */}
      <ShootPlanReviewHitl />
      {/* IPI-1233 · PLAN-CARD-001 — named composeShootPlan renderer. Renders
          inside this same existing provider; every other message/tool keeps
          CopilotKit's default rendering. */}
      <ComposeShootPlanRenderer />
      <div className={cn(styles.shell, copilotOpen && styles.shellPanelOpen)} data-testid="operator-panel">
      <div className={styles.menuBar}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={navOpen}
          aria-controls="operator-nav"
          onClick={() => setNavOpen((open) => !open)}
        >
          {navOpen ? "Close menu" : "Menu"}
        </Button>
        <span className={styles.brand}>iPix</span>
      </div>

      {navOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <nav
        id="operator-nav"
        className={`${styles.nav} ${navOpen ? styles.navOpen : ""}`}
        aria-label="App navigation"
        inert={navInert ? true : undefined}
      >
        <div className={styles.navHeader}>
          <span className={styles.brand}>iPix</span>
        </div>
        <ul className={styles.list}>
          {OPERATOR_NAV.map((item) => {
            const active = navItemIsActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.item} ${active ? styles.itemActive : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setNavOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className={styles.footer}>
          <form action="/auth/sign-out" method="post">
            <Button type="submit" variant="ghost" size="sm" className={styles.signOut}>
              Sign out
            </Button>
          </form>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.mainScroll}>{children}</div>
        {/* Only control visible while the panel is closed (Final Design
            state machine) — the panel's own ✕ is the only control while
            open. */}
        {!copilotOpen && (
          <Button
            ref={openButtonRef}
            type="button"
            variant="secondary"
            size="sm"
            className={styles.openCopilotButton}
            aria-expanded={copilotOpen}
            aria-controls="operator-chat-panel"
            onClick={() => {
              setCopilotOpen(true);
            }}
          >
            ✦ Open Copilot
          </Button>
        )}
      </main>

      <ProductionCopilotPanel pathname={pathname} open={copilotOpen} onClose={closeCopilot} />
      </div>
    </CopilotKit>
    </WorkspaceStatsProvider>
    </PlannerContextProvider>
  );
}
