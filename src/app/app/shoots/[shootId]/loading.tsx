import { Skeleton } from "@/components/ui/skeleton";

import styles from "@/components/shoot/shoot-detail.module.css";

/** IPI-1067 · SHOOT-001 — detail page loading skeleton. */
export default function AppShootDetailLoading() {
  return (
    <div className="p-8">
      <div className={styles.root}>
        <Skeleton className={styles.skeletonLine} style={{ width: 80 }} />
        <div className={styles.skeletonHeader}>
          <Skeleton className={styles.skeletonTitle} />
          <Skeleton className={styles.skeletonLine} style={{ width: 200 }} />
        </div>
        <Skeleton className={styles.skeletonMeta} />
        <Skeleton className={styles.skeletonMeta} />
      </div>
    </div>
  );
}