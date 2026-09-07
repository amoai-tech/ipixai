import { Skeleton } from "@/components/ui/skeleton";

import styles from "@/components/plans/plan-workspace.module.css";

/** IPI-1074 · PLANS-001 — plan workspace loading skeleton. */
export default function AppPlanDetailLoading() {
  return (
    <div className="p-8">
      <div className={styles.root} data-testid="plan-workspace-loading">
        <div className={styles.skeletonHeader}>
          <Skeleton className={styles.skeletonLine} style={{ width: 90 }} />
          <Skeleton className={styles.skeletonTitle} />
          <Skeleton className={styles.skeletonLine} style={{ width: 180 }} />
        </div>
        <div className={styles.skeletonBoard}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton className={styles.skeletonLine} style={{ width: "60%" }} />
              <Skeleton className={styles.skeletonMeta} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}