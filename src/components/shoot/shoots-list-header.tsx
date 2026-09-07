import { shootCountLabel } from "@/lib/shoot/shoot-list-filters";

import styles from "./shoots-list.module.css";

/**
 * IPI-1067 · SHOOT-001 — browse page header. `count` is the trusted-org
 * shoot total when the count read succeeded, else null (honest: no number
 * is shown rather than a fabricated one).
 */
export function ShootsListHeader({ count }: { count: number | null }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.heading}>Shoots</h1>
      <p className={styles.subheading}>Your organization&apos;s shoots.</p>
      {count !== null && <p className={styles.count}>{shootCountLabel(count)}</p>}
    </header>
  );
}