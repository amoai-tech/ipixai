import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StatusChip } from "@/components/ui/status-chip";
import {
  formatPlanDateRange,
  isDueToday,
  isPlanAtRisk,
  planEntityTypeLabel,
  planInstanceStatusDotToken,
  planInstanceStatusLabel,
} from "@/lib/plans/plan-display";
import type { PlanListResult } from "@/lib/plans/get-plans";

import styles from "./plan-dashboard.module.css";

/**
 * IPI-1074 · PLANS-001 — plans Dashboard. Metrics are derived from the list
 * RPC only. At Risk and Due Today are real computations; Progress and My
 * Tasks need task/assignment data the list contract doesn't carry, so they
 * show honest "unavailable" copy instead of fabricated numbers. Approval
 * data is likewise absent (production has no gate approvals), shown as
 * "No approvals pending".
 */
export function PlanDashboard({
  result,
  todayIso,
}: {
  result: Extract<PlanListResult, { ok: true }>;
  todayIso: string;
}) {
  const rows = result.rows;
  const atRisk = rows.filter((row) => isPlanAtRisk(row.status, row.plannedEnd, todayIso)).length;
  const dueToday = rows.filter((row) => isDueToday(row.plannedEnd, todayIso)).length;
  const recent = rows.slice(0, 8);

  return (
    <div className={styles.root} data-testid="plan-dashboard">
      <Link href="/app/plans" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden />
        Plans
      </Link>

      <header className={styles.header}>
        <h1 className={styles.heading}>Plans Dashboard</h1>
        <p className={styles.subheading}>
          {rows.length} plan{rows.length === 1 ? "" : "s"} loaded (up to 100) from your organization.
        </p>
      </header>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total plans</span>
          <span className={styles.metricValue}>{rows.length}</span>
          <span className={styles.metricNote}>Loaded from the plans list.</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>At risk</span>
          <span className={styles.metricValue}>{atRisk}</span>
          <span className={styles.metricNote}>
            Planned or active with an end date already passed.
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Due today</span>
          <span className={styles.metricValue}>{dueToday}</span>
          <span className={styles.metricNote}>Planned end date is today.</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Progress</span>
          <span className={`${styles.metricValue} ${styles.metricValueMuted}`}>Unavailable</span>
          <span className={styles.metricNote}>Task counts aren&apos;t part of the plans list.</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>My tasks</span>
          <span className={`${styles.metricValue} ${styles.metricValueMuted}`}>Unavailable</span>
          <span className={styles.metricNote}>Assignments aren&apos;t part of the plans list.</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Needs approval</span>
          <span className={styles.metricValue}>0</span>
          <span className={styles.metricNote}>No gate approvals pending.</span>
        </div>
      </div>

      <section>
        <h2 className={styles.sectionTitle}>Recent plans</h2>
        {recent.length === 0 ? (
          <p className={styles.recentMeta}>No plans to show yet.</p>
        ) : (
          <ul className={styles.recentList}>
            {recent.map((plan) => (
              <li key={plan.id}>
                <Link href={`/app/plans/${plan.id}`} className={styles.recentLink}>
                  <div className={styles.recentItem}>
                    <span className={styles.recentTitle}>{plan.name}</span>
                    <span className={styles.recentMeta}>
                      {planEntityTypeLabel(plan.entityType)} · {plan.workflowName} ·{" "}
                      {formatPlanDateRange(plan.plannedStart, plan.plannedEnd)}
                    </span>
                    <span>
                      <StatusChip
                        dot={planInstanceStatusDotToken(plan.status)}
                        label={planInstanceStatusLabel(plan.status)}
                        bare
                      />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}