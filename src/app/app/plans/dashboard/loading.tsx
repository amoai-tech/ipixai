import { Skeleton } from "@/components/ui/skeleton";

import styles from "@/components/plans/plan-dashboard.module.css";

/** IPI-1074 · PLANS-001 — plans Dashboard loading skeleton. */
export default function AppPlansDashboardLoading() {
  return (
    <div className="p-8">
      <div className={styles.root} data-testid="plan-dashboard-loading">
        <Skeleton className={styles.metricCard} />
        <div className={styles.metricsGrid}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.metricCard}>
              <Skeleton style={{ height: 12, width: "70%", borderRadius: 6 }} />
              <Skeleton style={{ height: 22, width: "40%", borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}