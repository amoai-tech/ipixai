"use client";

import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useAgentContext } from "@copilotkit/react-core/v2";

import type { PlannerContext } from "@/lib/planner/planner-context";

type PlannerContextValue = {
  context: PlannerContext | null;
  setContext: Dispatch<SetStateAction<PlannerContext | null>>;
};

const PlannerReactContext = createContext<PlannerContextValue | null>(null);

/**
 * Mounted once around the Production Copilot panel + page content (same
 * span as `WorkspaceStatsProvider`), so both the visible Context line and
 * every route's `<ReportPlannerContext>` share one value.
 */
export function PlannerContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<PlannerContext | null>(null);
  return (
    <PlannerReactContext.Provider value={{ context, setContext }}>
      {children}
    </PlannerReactContext.Provider>
  );
}

/** Falls back to null outside the provider — a missing provider degrades
 *  the visible Context line to nothing, it never crashes the page. */
export function usePlannerContext(): PlannerContext | null {
  return useContext(PlannerReactContext)?.context ?? null;
}

function describeForModel(context: PlannerContext): string {
  if (context.shoot) {
    return "The Shoot (and its Brand) the operator currently has open in the workspace, including its brief, target channels, budget, and deliverables. Use it for follow-up requests (e.g. \"reduce the budget and keep the same deliverables\") instead of asking the operator to repeat the brief or IDs. This is a locator, not authorization — every write is independently re-verified server-side.";
  }
  if (context.brand) {
    return "The Brand the operator currently has open in the workspace. Use it for follow-up questions instead of asking the operator to repeat IDs. This is a locator, not authorization — every write is independently re-verified server-side.";
  }
  return "No Brand or Shoot is currently open. Do not assume an earlier turn's Brand/Shoot still applies — ask the operator which one they mean.";
}

/**
 * Renders nothing. Reports one authorized `PlannerContext` up to the shared
 * provider AND registers the same value as model-facing context via
 * CopilotKit's `useAgentContext`, so the visible Context line and the
 * Production Planner always consume the exact same authorized source.
 *
 * Every route that can be "current" reports here, including `/app` itself
 * with `WORKSPACE_PLANNER_CONTEXT` (no active Brand/Shoot) — the model is
 * told explicitly that nothing is open rather than the context merely going
 * silent, which is what actually prevents an earlier turn's Brand/Shoot
 * from being assumed to still apply.
 *
 * Scope-aware cleanup (verified 2026-09-19 against the installed
 * `useAgentContext` — it has no `scopeKey` and no cross-instance cleanup
 * ordering of its own): unmounting only clears the *shared* context if it
 * still belongs to this reporter's own `scopeKey`, so Brand A's cleanup can
 * never erase Brand B's context if Brand B already replaced it before Brand
 * A's effect cleanup ran.
 *
 * Split into two effects (bug caught in PR review, 2026-09-19): the ref
 * must only be updated from inside an effect, never during render. A
 * single combined effect keyed on `[context, ...]` would re-run its own
 * cleanup on every re-render — including one where `context` is a new
 * object but `scopeKey` is unchanged (e.g. the Shoot page revalidating
 * after an approval) — and by then the ref already held the *new*
 * scopeKey, so the stale cleanup would match and clear the shared context
 * for one tick before the new effect put it right back. The unmount-only
 * effect below is keyed on the stable `setSharedContext` alone, so its
 * cleanup fires exactly once, at real unmount, against whatever scopeKey
 * was last committed.
 */
export function ReportPlannerContext({ context }: { context: PlannerContext }) {
  const setSharedContext = useContext(PlannerReactContext)?.setContext;
  const lastReportedScopeKeyRef = useRef(context.scopeKey);

  useEffect(() => {
    setSharedContext?.(context);
    lastReportedScopeKeyRef.current = context.scopeKey;
  }, [context, setSharedContext]);

  useEffect(() => {
    return () => {
      setSharedContext?.((current) =>
        current?.scopeKey === lastReportedScopeKeyRef.current ? null : current,
      );
    };
  }, [setSharedContext]);

  useAgentContext({
    description: describeForModel(context),
    value: context,
  });

  return null;
}
