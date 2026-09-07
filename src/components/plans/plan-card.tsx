import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { StatusChip } from "@/components/ui/status-chip";
import {
  formatPlanDateRange,
  isPlanAtRisk,
  planEntityTypeLabel,
  planInstanceStatusDotToken,
  planInstanceStatusLabel,
} from "@/lib/plans/plan-display";
import type { PlanListRow } from "@/lib/plans/plan-types";

import styles from "./plan-hub.module.css";

/**
 * IPI-1074 · PLANS-001 — one read-only plan card. Links to the workspace.
 * Only real payload fields are rendered; no thumbnails or entity lookups
 * exist in the list contract.
 */
export function PlanCard({ plan }: { plan: PlanListRow }) {
  return (
    <li>
      <Link href={`/app/plans/${plan.id}`} className={styles.cardLink} data-testid="plan-card">
        <div className={styles.card}>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardTitle}>{plan.name}</span>
            <StatusChip
              dot={planInstanceStatusDotToken(plan.status)}
              label={planInstanceStatusLabel(plan.status)}
              bare
            />
          </div>
          <div className={styles.cardMeta}>
            <span>{planEntityTypeLabel(plan.entityType)}</span>
            <span>{formatPlanDateRange(plan.plannedStart, plan.plannedEnd)}</span>
            <span>{plan.workflowName}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

/** Count of rows in this page that are honestly at risk. */
export function countAtRisk(rows: PlanListRow[], todayIso: string): number {
  return rows.filter((row) => isPlanAtRisk(row.status, row.plannedEnd, todayIso)).length;
}