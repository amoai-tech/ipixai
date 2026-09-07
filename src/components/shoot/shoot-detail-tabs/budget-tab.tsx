import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import { formatBudget } from "../shoot-detail-format";

import styles from "../shoot-detail.module.css";

/** IPI-1067 · SHOOT-001 — budget: estimated vs actual; breakdown is a
 *  placeholder shell (no fake controls). */
export function BudgetTab({ detail }: { detail: ShootDetail }) {
  const { shoot } = detail;
  const hasBudget = shoot.estimated_budget !== null || shoot.actual_cost !== null;
  if (!hasBudget) {
    return (
      <EmptyState
        heading="No budget set"
        body="Budget figures for this shoot will show up here."
        icon={<Wallet aria-hidden />}
      />
    );
  }
  return (
    <div data-testid="shoot-tab-budget">
      <div className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Estimated</span>
          <span className={styles.metaValue}>
            {formatBudget(shoot.estimated_budget, shoot.currency)}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Actual</span>
          <span className={styles.metaValue}>{formatBudget(shoot.actual_cost, shoot.currency)}</span>
        </div>
      </div>
      {shoot.budget_breakdown !== null && shoot.budget_breakdown !== undefined ? (
        <p className={styles.placeholderNote}>
          A line-item breakdown view arrives with a later task.
        </p>
      ) : null}
    </div>
  );
}