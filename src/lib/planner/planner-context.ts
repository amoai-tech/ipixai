/**
 * IPI-1087 · PLANNER-CONTEXT-001 — the minimal typed Brand/Shoot context the
 * Production Planner (and the visible Context line) both consume.
 *
 * There is deliberately no resolver function in this file. Every page that
 * can report a `PlannerContext` (`/app`, `/app/brands/[brandId]`,
 * `/app/shoots/[shootId]`) already loads this exact data through its own
 * authorized DAL (`loadBrandDetail`, `loadShootDetailForOrg`) before it would
 * render at all — a foreign/missing id already 404s upstream of any
 * `<ReportPlannerContext>` call. Building a second resolver here would be a
 * second, independently-driftable authorization path for the same fact the
 * page has already proven; reusing the page's own already-authorized load is
 * both the smallest change and the only way to guarantee the visible Context
 * line and the model always agree (they'd read the same object).
 */

export type PlannerContextScope = "workspace" | `brand:${string}` | `shoot:${string}`;

export type PlannerContextDeliverable = {
  channel: string | null;
  format: string | null;
  quantity: number | null;
  status: string | null;
};

export type PlannerContext = {
  /** Controls replacement/cleanup — see `ReportPlannerContext`'s scope-aware
   *  cleanup. Two reporters with different `scopeKey`s can never clobber
   *  each other's context on unmount. */
  scopeKey: PlannerContextScope;
  brand?: { id: string; name: string };
  /**
   * Field selection matches IPI-1087's own acceptance journey — "reduce the
   * budget and keep the same deliverables" without repeating either — not a
   * dump of the full Shoot row. Deliberately excludes `budget_breakdown`
   * (unbounded JSON), `mood_board_urls`/`cover_url` (media, not planning
   * text), and dates/location (no acceptance scenario calls for them yet):
   * IPI-1087's own "Do not build" list rules out "full Brand Brain/private
   * blobs in client/model context". Widen only when a real journey needs it.
   */
  shoot?: {
    id: string;
    name: string;
    status: string | null;
    brandId: string;
    brief: string | null;
    targetChannels: string[] | null;
    estimatedBudget: number | null;
    actualCost: number | null;
    currency: string | null;
    deliverables: PlannerContextDeliverable[];
  };
};

/** The explicit "no active job" context — reported by `/app` itself so that
 *  leaving a Brand/Shoot workspace deterministically clears stale context
 *  instead of relying on unmount-timing luck. */
export const WORKSPACE_PLANNER_CONTEXT: PlannerContext = { scopeKey: "workspace" };
