import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import { shootStatusLabel } from "@/lib/shoot/shoot-list-filters";
import { formatDateRange } from "../shoot-detail-format";

import styles from "../shoot-detail.module.css";

/** IPI-1067 · SHOOT-001 — schedule: dates + status; calendar view is
 *  downstream work (placeholder note, no fake controls). */
export function ScheduleTab({ detail }: { detail: ShootDetail }) {
  const { shoot } = detail;
  const hasDates = shoot.start_date !== null || shoot.end_date !== null;
  if (!hasDates) {
    return (
      <EmptyState
        heading="No dates scheduled"
        body="Scheduled dates for this shoot will show up here."
        icon={<CalendarDays aria-hidden />}
      />
    );
  }
  return (
    <div data-testid="shoot-tab-schedule">
      <div className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Dates</span>
          <span className={styles.metaValue}>{formatDateRange(shoot.start_date, shoot.end_date)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Status</span>
          <span className={styles.metaValue}>{shootStatusLabel(shoot.status)}</span>
        </div>
      </div>
      <p className={styles.placeholderNote}>
        A full production calendar arrives with a later task. This tab shows the scheduled dates
        only.
      </p>
    </div>
  );
}