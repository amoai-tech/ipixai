/**
 * IPI-1074 · PLANS-001 — pure display vocabulary for the plans Hub,
 * workspace, and dashboard.
 *
 * Maps the planner read-contract enums (confirmed in
 * supabase/migrations/20260907000000_plans_001_read_contract.sql) to human
 * labels and StatusChip dot tokens. No Supabase, no React — callers resolve
 * display strings here so each enum → token mapping lives in exactly one
 * place. Dot tokens reuse the existing `--status-*` palette in
 * src/styles/tokens.css by lifecycle stage.
 */

export const PLAN_INSTANCE_STATUS_ORDER = [
  "draft",
  "planned",
  "active",
  "blocked",
  "completed",
  "archived",
  "cancelled",
] as const;

export type PlanInstanceStatusKey = (typeof PLAN_INSTANCE_STATUS_ORDER)[number];

export const PLAN_INSTANCE_STATUS_LABELS: Record<PlanInstanceStatusKey, string> = {
  draft: "Draft",
  planned: "Planned",
  active: "Active",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
  cancelled: "Cancelled",
};

export const PLAN_INSTANCE_STATUS_DOT_TOKENS: Record<PlanInstanceStatusKey, string> = {
  draft: "var(--status-planning-text)",
  planned: "var(--status-active-text)",
  active: "var(--color-approved)",
  blocked: "var(--color-blocked)",
  completed: "var(--color-published)",
  archived: "var(--status-archived-text)",
  cancelled: "var(--color-text-muted)",
};

export function planInstanceStatusLabel(status: string | null | undefined): string {
  if (status && Object.prototype.hasOwnProperty.call(PLAN_INSTANCE_STATUS_LABELS, status)) {
    return PLAN_INSTANCE_STATUS_LABELS[status as PlanInstanceStatusKey];
  }
  return "Unknown";
}

export function planInstanceStatusDotToken(status: string | null | undefined): string {
  if (status && Object.prototype.hasOwnProperty.call(PLAN_INSTANCE_STATUS_DOT_TOKENS, status)) {
    return PLAN_INSTANCE_STATUS_DOT_TOKENS[status as PlanInstanceStatusKey];
  }
  return "var(--color-text-muted)";
}

export const PLAN_TASK_STATUS_ORDER = [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
] as const;

export type PlanTaskStatusKey = (typeof PLAN_TASK_STATUS_ORDER)[number];

export const PLAN_TASK_STATUS_LABELS: Record<PlanTaskStatusKey, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const PLAN_TASK_STATUS_DOT_TOKENS: Record<PlanTaskStatusKey, string> = {
  todo: "var(--status-planning-text)",
  in_progress: "var(--status-active-text)",
  blocked: "var(--color-blocked)",
  done: "var(--status-complete-text)",
  cancelled: "var(--color-text-muted)",
};

export function planTaskStatusLabel(status: string | null | undefined): string {
  if (status && Object.prototype.hasOwnProperty.call(PLAN_TASK_STATUS_LABELS, status)) {
    return PLAN_TASK_STATUS_LABELS[status as PlanTaskStatusKey];
  }
  return "Unknown";
}

export function planTaskStatusDotToken(status: string | null | undefined): string {
  if (status && Object.prototype.hasOwnProperty.call(PLAN_TASK_STATUS_DOT_TOKENS, status)) {
    return PLAN_TASK_STATUS_DOT_TOKENS[status as PlanTaskStatusKey];
  }
  return "var(--color-text-muted)";
}

export const PLAN_ENTITY_TYPE_LABELS: Record<string, string> = {
  shoot: "Shoot",
  campaign: "Campaign",
  crm_deal: "CRM Deal",
};

export function planEntityTypeLabel(type: string | null | undefined): string {
  if (type && Object.prototype.hasOwnProperty.call(PLAN_ENTITY_TYPE_LABELS, type)) {
    return PLAN_ENTITY_TYPE_LABELS[type];
  }
  return "Unknown";
}

export const PLAN_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function planPriorityLabel(priority: string | null | undefined): string {
  if (priority && Object.prototype.hasOwnProperty.call(PLAN_PRIORITY_LABELS, priority)) {
    return PLAN_PRIORITY_LABELS[priority];
  }
  return "Unknown";
}

/**
 * Date-only values ("2026-09-12") are calendar dates, not instants. Lexicographic
 * comparison of the YYYY-MM-DD string is calendar-safe with no timezone shifting.
 */

/** Today's date as a UTC YYYY-MM-DD string (server-render safe). */
export function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A plan is at risk when it is still running/planned and its end has already passed. */
export function isPlanAtRisk(
  status: string | null | undefined,
  plannedEnd: string | null | undefined,
  todayIso: string = todayUtcIso(),
): boolean {
  if (!plannedEnd) return false;
  if (status !== "active" && status !== "planned") return false;
  return plannedEnd < todayIso;
}

/** Due today when the plan ends on today's date. */
export function isDueToday(
  plannedEnd: string | null | undefined,
  todayIso: string = todayUtcIso(),
): boolean {
  return plannedEnd !== null && plannedEnd !== undefined && plannedEnd === todayIso;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "Sep 12, 2026" · "Not scheduled" (null/empty). */
export function formatPlanDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const year = Number(match[1]);
  return `${MONTHS[month]} ${day}, ${year}`;
}

/** "Sep 12 – 14, 2026" · "Sep 12, 2026" · "Not scheduled" (null/empty). */
export function formatPlanDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return "Not scheduled";
  if (start && end && start === end) return formatPlanDate(start);
  if (start && end) {
    const sameYearMonth =
      start.slice(0, 7) === end.slice(0, 7) && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);
    if (sameYearMonth) {
      return `${MONTHS[Number(start.slice(5, 7)) - 1]} ${Number(start.slice(8, 10))} – ${Number(end.slice(8, 10))}, ${start.slice(0, 4)}`;
    }
    return `${formatPlanDate(start)} – ${formatPlanDate(end)}`;
  }
  return formatPlanDate(start ?? end ?? null);
}