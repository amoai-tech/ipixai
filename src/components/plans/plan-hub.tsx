import Link from "next/link";
import { LayoutDashboard, Search, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  PLAN_ENTITY_TYPE_LABELS,
  PLAN_INSTANCE_STATUS_LABELS,
} from "@/lib/plans/plan-display";
import type { PlanListFilters, PlanListResult } from "@/lib/plans/get-plans";
import type { PlanListRow } from "@/lib/plans/plan-types";

import { PlanCard, countAtRisk } from "./plan-card";
import styles from "./plan-hub.module.css";

export type PlanHubFilters = Pick<
  PlanListFilters,
  "search" | "entityType" | "status" | "includeArchived"
>;

const ENTITY_TYPE_OPTIONS = Object.keys(PLAN_ENTITY_TYPE_LABELS) as (keyof typeof PLAN_ENTITY_TYPE_LABELS)[];
const STATUS_OPTIONS = Object.keys(PLAN_INSTANCE_STATUS_LABELS) as (keyof typeof PLAN_INSTANCE_STATUS_LABELS)[];

/** Build the hub's own query string (GET form + pagination links) from the
 *  active filters plus any per-link overrides. Never includes `after` unless
 *  the caller supplies it — page 1 has no cursor param. */
function hubQueryString(filters: PlanHubFilters, overrides: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  const search = overrides.search ?? filters.search ?? "";
  const entityType = overrides.entityType ?? filters.entityType ?? "";
  const status = overrides.status ?? filters.status ?? "";
  const includeArchived = overrides.archived ?? (filters.includeArchived ? "1" : "");
  const after = overrides.after ?? "";
  if (search) params.set("q", search);
  if (entityType) params.set("type", entityType);
  if (status) params.set("status", status);
  if (includeArchived) params.set("archived", "1");
  if (after) params.set("after", after);
  const value = params.toString();
  return value ? `?${value}` : "";
}

function hasActiveFilters(filters: PlanHubFilters): boolean {
  return Boolean(
    filters.search?.trim() ||
      filters.entityType ||
      filters.status ||
      filters.includeArchived,
  );
}

/**
 * IPI-1074 · PLANS-001 — plans Hub composition: header + GET filter form +
 * honest at-risk band + cards + empty/no-match states + forward keyset
 * pagination. Server-rendered only; all navigation is <Link> (no client
 * fetching, no per-card fan-out).
 */
export function PlanHub({
  result,
  filters,
  todayIso,
}: {
  result: Extract<PlanListResult, { ok: true }>;
  filters: PlanHubFilters;
  todayIso: string;
}) {
  const rows: PlanListRow[] = result.rows;
  const atRiskCount = countAtRisk(rows, todayIso);
  const searching = hasActiveFilters(filters);

  return (
    <div className={styles.root} data-testid="plan-hub">
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.heading}>Plans</h1>
          <Link href="/app/plans/dashboard" className={styles.dashboardLink}>
            Dashboard
          </Link>
        </div>
        <p className={styles.subheading}>Your organization&apos;s production plans.</p>
        <p className={styles.count}>
          {rows.length} visible {rows.length === 1 ? "plan" : "plans"}
        </p>
      </header>

      <form className={styles.filters} method="get" action="/app/plans">
        <input
          type="search"
          name="q"
          className={styles.searchInput}
          placeholder="Search plans"
          aria-label="Search plans"
          defaultValue={filters.search ?? ""}
        />
        <select
          name="type"
          className={styles.select}
          aria-label="Filter by entity type"
          defaultValue={filters.entityType ?? "all"}
        >
          <option value="all">All types</option>
          {ENTITY_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {PLAN_ENTITY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <select
          name="status"
          className={styles.select}
          aria-label="Filter by status"
          defaultValue={filters.status ?? "all"}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {PLAN_INSTANCE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" name="archived" value="1" defaultChecked={Boolean(filters.includeArchived)} />
          Include archived
        </label>
        <button type="submit" className={styles.submitButton}>
          <span className="sr-only">Apply filters</span>
          <Search size={14} aria-hidden />
        </button>
      </form>

      {atRiskCount > 0 ? (
        <Alert className={styles.attentionBand} data-testid="plan-at-risk-band">
          <TriangleAlert size={16} className={styles.attentionIcon} aria-hidden />
          <AlertTitle>
            {atRiskCount} at-risk {atRiskCount === 1 ? "plan" : "plans"}
          </AlertTitle>
          <AlertDescription>
            {atRiskCount === 1 ? "It is" : "They are"} planned or active but the planned end date has
            already passed.
          </AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        searching ? (
          <EmptyState
            heading="No plans match your filters"
            body="Try clearing or widening the search, type, status, or archived filters."
            icon={<Search aria-hidden />}
          />
        ) : (
          <EmptyState
            heading="No plans yet"
            body="Plans created by your organization will show up here."
            icon={<LayoutDashboard aria-hidden />}
          />
        )
      ) : (
        <ul className={styles.grid}>
          {rows.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </ul>
      )}

      {result.hasMore && result.nextCursor ? (
        <nav className={styles.pagination} aria-label="Plan pages">
          <Link
            href={`/app/plans${hubQueryString(filters, { after: result.nextCursor })}`}
            className={styles.nextLink}
          >
            Next →
          </Link>
        </nav>
      ) : null}
    </div>
  );
}