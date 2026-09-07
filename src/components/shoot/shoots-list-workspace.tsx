import Link from "next/link";

import {
  encodeShootListCursor,
  type ShootListCursor,
  type ShootListResult,
} from "@/lib/shoot/get-shoot-detail";

import { ShootsListHeader } from "./shoots-list-header";
import { ShootsListStates } from "./shoots-list-states";
import styles from "./shoots-list.module.css";

/**
 * IPI-1067 · SHOOT-001 — browse page composition: header + states +
 * forward keyset pagination. The next-page link carries the opaque
 * `?after=` cursor; page 1 has no cursor param. Back navigation is the
 * browser's own (no backward cursor contract in SHOOT-001).
 */
export function ShootsListWorkspace({
  result,
  count,
  nextCursor,
}: {
  result: ShootListResult;
  count: number | null;
  nextCursor: ShootListCursor | null;
}) {
  return (
    <div className={styles.root} data-testid="shoots-list-workspace">
      <ShootsListHeader count={count} />
      <ShootsListStates result={result} />
      {result.ok && nextCursor && (
        <nav className={styles.pagination} aria-label="Shoot pages">
          <Link
            href={`/app/shoots?after=${encodeURIComponent(encodeShootListCursor(nextCursor))}`}
            className={styles.nextLink}
          >
            Next page
          </Link>
        </nav>
      )}
    </div>
  );
}