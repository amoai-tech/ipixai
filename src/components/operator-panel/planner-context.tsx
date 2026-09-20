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
    return "The Shoot (and its Brand) the operator currently has open in the workspace. Use it for follow-up questions instead of asking the operator to repeat IDs or the brief. This is a locator, not authorization — every write is independently re-verified server-side.";
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
 */
export function ReportPlannerContext({ context }: { context: PlannerContext }) {
  const setSharedContext = useContext(PlannerReactContext)?.setContext;
  const scopeKeyRef = useRef(context.scopeKey);
  scopeKeyRef.current = context.scopeKey;

  useEffect(() => {
    setSharedContext?.(context);
    return () => {
      setSharedContext?.((current) => (current?.scopeKey === scopeKeyRef.current ? null : current));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, setSharedContext]);

  useAgentContext({
    description: describeForModel(context),
    value: context,
  });

  return null;
}
