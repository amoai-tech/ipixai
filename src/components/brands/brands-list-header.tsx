import styles from "./brands-list.module.css";

/**
 * IPI-1068 · BRAND-001 — browse page header. `count` is the trusted-org
 * brand total when the count read succeeded, else null (honest: no number
 * shown rather than a fabricated one) — mirrors ShootsListHeader.
 */
export function BrandsListHeader({ count }: { count: number | null }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.heading}>Brands</h1>
      <p className={styles.subheading}>Your organization&apos;s brands.</p>
      {count !== null && (
        <p className={styles.count}>
          {count} brand{count === 1 ? "" : "s"}
        </p>
      )}
    </header>
  );
}
