"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CopilotChat, CopilotKit, useAgent } from "@copilotkit/react-core/v2";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { navItemIsActive, OPERATOR_NAV } from "./nav";
import styles from "./operator-panel.module.css";
import { useWorkspaceStats, WorkspaceStatsProvider } from "./workspace-stats";
import type { WorkspaceStats } from "./workspace-stats";
import {
  plannerThreadStorageKey,
  resolvePlannerThreadId,
  type PlannerThreadRow,
} from "@/mastra/thread-types";

// Keep in sync with operator-panel.module.css @media (max-width: 767px)
const MOBILE_NAV = "(max-width: 767px)";

/** Single source of truth for "N brand(s) · N shoot(s)" — the rail and the
 *  chat welcome each rendered their own brandNoun/shootNoun before this,
 *  so the two surfaces could silently drift on pluralization wording. */
function formatPortfolioCounts(stats: Pick<WorkspaceStats, "brandCount" | "shootCount">): string {
  const brandNoun = stats.brandCount === 1 ? "brand" : "brands";
  const shootNoun = stats.shootCount === 1 ? "shoot" : "shoots";
  return `${stats.brandCount} ${brandNoun} · ${stats.shootCount} ${shootNoun}`;
}

function useMobileNav() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(MOBILE_NAV);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

/**
 * `/app`-specific derived state: real, uncapped brand/shoot counts (and the
 * real first-brand name, when there is one) for the dashboard route only
 * (see AppHomePage's ReportWorkspaceStats). Every other route — and the
 * dashboard before its stats have loaded — falls back to the same generic
 * copy the rail always showed, never a fabricated or stale value.
 */
function IntelligenceRailBody({ pathname }: { pathname: string }) {
  const stats = useWorkspaceStats();
  if (pathname === "/app" && stats) {
    return (
      <>
        <p className={styles.railTitle}>Overview</p>
        {stats.brandName && (
          <p className={styles.railBody} data-testid="intelligence-brand-context">
            Current brand: {stats.brandName}
          </p>
        )}
        <p className={styles.railBody} aria-live="polite" data-testid="intelligence-workspace-stats">
          {formatPortfolioCounts(stats)} in this workspace.
        </p>
        {/* No Approvals/Activity here — IPI-1084 · APPROVAL-001 hasn't
            shipped a real approvals source, and no activity feed exists.
            Real signal only, per IPI-1149's acceptance criteria. */}
        {stats.recentShootLookupFailed ? (
          // Distinct from "brand genuinely has no shoots" (below): a failed
          // lookup says so honestly instead of silently looking identical
          // to a confirmed-empty brand.
          <>
            <p className={styles.railTitle}>Recent production</p>
            <p className={styles.railBody} data-testid="intelligence-recent-shoot-unavailable">
              Couldn&apos;t load right now.
            </p>
          </>
        ) : (
          stats.recentShootName && (
            <>
              <p className={styles.railTitle}>Recent production</p>
              <p className={styles.railBody} data-testid="intelligence-recent-shoot">
                {stats.recentShootName}
                {stats.recentShootStatus ? ` · ${stats.recentShootStatus}` : ""}
              </p>
            </>
          )
        )}
      </>
    );
  }
  return (
    <p className={styles.railBody}>
      Planner chat stays in its own screen. Open it without replacing this workspace.
    </p>
  );
}

/**
 * IPI-1149 · DASH-MAIN-002 — portfolio-aware Production Planner welcome
 * copy. Reuses the same real WorkspaceStats the rail above renders; this
 * only changes *display* copy, not what the agent itself knows — no second
 * agent-context path (that's IPI-1087 · PLANNER-CONTEXT-001's job). Every
 * route besides `/app`, and `/app` before its stats arrive, keeps the
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
 * thread `/planner` already uses (see planner-threads-drawer.tsx) before
 * mounting CopilotChat. Without an explicit threadId here, CopilotChat never
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

/** Reads WorkspaceStats from inside the provider (OperatorPanel's own body
 *  sits above it in the tree, so it can't call the hook directly) and hands
 *  CopilotChat portfolio-aware welcome copy instead of a static string. */
function PlannerChatDock({ pathname }: { pathname: string }) {
  const stats = useWorkspaceStats();
  const { threadId, isNewThread, threadError, retry } = usePlannerThreadBootstrap();
  // Called unconditionally (rules of hooks) even before threadId resolves —
  // same pattern planner-threads-drawer.tsx already uses. Once the operator
  // sends the first message, agent.messages.length flips to >0 and the
  // welcome banner below hides itself, matching how CopilotChat's own
  // (now-unreachable) welcome screen used to behave via messages.length.
  const { agent } = useAgent({ agentId: "default" });
  const hasMessages = (agent.messages?.length ?? 0) > 0;

  if (threadError) {
    return (
      <div role="alert" className={styles.chatDockStatus}>
        <p>Could not load conversation.</p>
        <Button type="button" variant="outline" size="sm" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!threadId) {
    return (
      <p role="status" className={styles.chatDockStatus}>
        Loading conversation…
      </p>
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
    <div className={styles.chatDockBody}>
      {isNewThread && !hasMessages && (
        <p className={styles.chatDockWelcome}>{portfolioWelcomeText(pathname, stats)}</p>
      )}
      <div className={styles.chatDockChat}>
        <CopilotChat
          agentId="default"
          threadId={threadId}
          labels={{ welcomeMessageText: portfolioWelcomeText(pathname, stats) }}
        />
      </div>
    </div>
  );
}

function OpenPlannerLink({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/planner"
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={onClick}
    >
      Open Planner
    </Link>
  );
}

export function OperatorPanel({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const isMobile = useMobileNav();
  const navInert = isMobile && !navOpen;

  // useSingleEndpoint={false} matches the multi-route
  // /api/copilotkit/[[...slug]] handler (see planner-app.tsx's own
  // provider) — the v1-compat bridge otherwise defaults to a single
  // transport and 404s. Auth is server-side on the route itself
  // (requirePlannerResourceId re-verifies the same AUTH-002 session that
  // already gated this page), so no client handshake is needed here.
  // showDevConsole / enableInspector explicitly off: their default dev-
  // mode toast + floating inspector button sit at a high z-index and
  // intercept clicks on the real page underneath (caught by an
  // authenticated e2e smoke run — Quick Links stopped navigating with
  // the CopilotKit provider mounted and these left on their default).
  return (
    <WorkspaceStatsProvider>
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      showDevConsole={false}
      enableInspector={false}
      publicLicenseKey={process.env.NEXT_PUBLIC_COPILOTKIT_PUBLIC_LICENSE_KEY}
    >
      <div className={styles.shell} data-testid="operator-panel">
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
          <OpenPlannerLink
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), styles.signOut)}
            onClick={() => setNavOpen(false)}
          />
          <form action="/auth/sign-out" method="post">
            <Button type="submit" variant="ghost" size="sm" className={styles.signOut}>
              Sign out
            </Button>
          </form>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.mainScroll}>{children}</div>
        <div className={styles.chatDock} data-testid="operator-chat-dock">
          {/* agentId="default" resolves to productionPlannerAgent
              (src/mastra/agents/index.ts, IPI-1048 · PLANNER-001). Welcome
              copy is portfolio-aware (portfolioWelcomeText, above) — display
              only, sourced from the same WorkspaceStats the rail reads. The
              agent's own runtime context is untouched here; that's
              IPI-1087 · PLANNER-CONTEXT-001's job. */}
          <PlannerChatDock pathname={pathname} />
        </div>
      </main>

      <aside className={styles.rail} data-testid="intelligence-rail" aria-label="Intelligence rail">
        <p className={styles.railTitle}>Intelligence</p>
        <IntelligenceRailBody pathname={pathname} />
        <OpenPlannerLink className={cn(buttonVariants({ variant: "secondary", size: "sm" }))} />
      </aside>
      </div>
    </CopilotKit>
    </WorkspaceStatsProvider>
  );
}
