import { Skeleton } from "@/components/ui/skeleton";

import styles from "@/components/plans/plan-hub.module.css";

/** IPI-1074 · PLANS-001 — plans Hub loading skeleton. */
export default function AppPlansLoading() {
  return (
    <div className="p-8">
      <div className={styles.root} data-testid="plan-hub-loading">
        <header className={styles.header}>
          <Skeleton className={styles.skeletonLine} style={{ width: 120 }} />
          <Skeleton className={styles.skeletonLine} style={{ width: 220 }} />
        </header>
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton className={styles.skeletonLine} style={{ width: "70%" }} />
              <Skeleton className={styles.skeletonLine} style={{ width: "40%" }} />
              <Skeleton className={styles.skeletonLine} style={{ width: "55%" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}