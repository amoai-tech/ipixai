import Link from "next/link";
import { Camera } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import type { ShootListResult } from "@/lib/shoot/get-shoot-detail";

import { ShootCard } from "./ShootCard";
import styles from "./shoots-list.module.css";

/**
 * IPI-1067 · SHOOT-001 — the three list states: error, empty, and the
 * shoot grid. A failed read degrades only this section (same contract as
 * command-center.tsx); the header and pagination stay usable.
 */
export function ShootsListStates({ result }: { result: ShootListResult }) {
  if (!result.ok) {
    return <ErrorState message="Couldn't load your shoots. Please try again shortly." />;
  }

  if (result.shoots.length === 0) {
    return (
      <EmptyState
        heading="No shoots yet"
        body="Shoots your organization creates will show up here."
        icon={<Camera aria-hidden />}
        action={
          <Link href="/app/shoots" className={styles.nextLink}>
            Refresh
          </Link>
        }
      />
    );
  }

  return (
    <ul className={styles.grid} data-testid="shoots-list">
      {result.shoots.map((shoot) => (
        <ShootCard key={shoot.id} shoot={shoot} />
      ))}
    </ul>
  );
}