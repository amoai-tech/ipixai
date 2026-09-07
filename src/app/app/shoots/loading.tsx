import { Skeleton } from "@/components/ui/skeleton";

import styles from "@/components/shoot/shoots-list.module.css";

/** IPI-1067 · SHOOT-001 — browse page loading skeleton. */
export default function AppShootsLoading() {
  return (
    <div className="p-8">
      <div className={styles.root}>
        <header className={styles.header}>
          <Skeleton className={styles.skeletonLine} style={{ width: 120 }} />
          <Skeleton className={styles.skeletonLine} style={{ width: 200 }} />
        </header>
        <div className={styles.skeletonGrid} data-testid="shoots-list-loading">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton className={styles.skeletonThumb} />
              <Skeleton className={styles.skeletonLine} style={{ width: "70%" }} />
              <Skeleton className={styles.skeletonLine} style={{ width: "40%" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}