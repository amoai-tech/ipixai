"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type WorkspaceStats = {
  brandCount: number;
  shootCount: number;
  /** Real first-brand name (page.tsx's own `resolveHeroContext`, the same
   *  row CommandCenter's hero uses) — undefined when there's no brand yet.
   *  Never a guessed/default brand. */
  brandName?: string;
  /** Real name/status of that brand's own most-recently-updated shoot
   *  (same resolveHeroContext call) — undefined when it has none. */
  recentShootName?: string;
  recentShootStatus?: string;
};

type WorkspaceStatsContextValue = {
  stats: WorkspaceStats | null;
  setStats: (stats: WorkspaceStats | null) => void;
};

const WorkspaceStatsContext = createContext<WorkspaceStatsContextValue | null>(null);

/**
 * Small derived-state bridge for the Intelligence rail. The `/app` dashboard
 * page already loads real, uncapped brand/shoot counts server-side
 * (command-center.ts's loadTrustedBrandIds / countOrgShoots) — this lets
 * OperatorPanel's rail read them without duplicating that query itself, and
 * without turning CommandCenter (a server component) into a client
 * component just to reach a parent layout.
 */
export function WorkspaceStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  return (
    <WorkspaceStatsContext.Provider value={{ stats, setStats }}>
      {children}
    </WorkspaceStatsContext.Provider>
  );
}

/** Falls back to null outside the provider — a missing provider degrades
 *  the rail to its generic copy, it never crashes the page. */
export function useWorkspaceStats(): WorkspaceStats | null {
  return useContext(WorkspaceStatsContext)?.stats ?? null;
}

/**
 * Renders nothing — reports real, already-loaded counts up to the
 * OperatorPanel shell's rail. Unmounting (navigating away from `/app`)
 * clears the value so the rail never shows another route's stale counts.
 */
export function ReportWorkspaceStats({
  brandCount,
  shootCount,
  brandName,
  recentShootName,
  recentShootStatus,
}: WorkspaceStats) {
  const setStats = useContext(WorkspaceStatsContext)?.setStats;
  useEffect(() => {
    setStats?.({ brandCount, shootCount, brandName, recentShootName, recentShootStatus });
    return () => setStats?.(null);
  }, [brandCount, shootCount, brandName, recentShootName, recentShootStatus, setStats]);
  return null;
}
