"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CopilotChat, CopilotKit } from "@copilotkit/react-core/v2";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { navItemIsActive, OPERATOR_NAV } from "./nav";
import styles from "./operator-panel.module.css";
import { useWorkspaceStats, WorkspaceStatsProvider } from "./workspace-stats";
import type { WorkspaceStats } from "./workspace-stats";

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
        {stats.recentShootName && (
          <>
            <p className={styles.railTitle}>Recent production</p>
            <p className={styles.railBody} data-testid="intelligence-recent-shoot">
              {stats.recentShootName}
              {stats.recentShootStatus ? ` · ${stats.recentShootStatus}` : ""}
            </p>
          </>
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

/** Reads WorkspaceStats from inside the provider (OperatorPanel's own body
 *  sits above it in the tree, so it can't call the hook directly) and hands
 *  CopilotChat portfolio-aware welcome copy instead of a static string. */
function PlannerChatDock({ pathname }: { pathname: string }) {
  const stats = useWorkspaceStats();
  return (
    <CopilotChat agentId="default" labels={{ welcomeMessageText: portfolioWelcomeText(pathname, stats) }} />
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
