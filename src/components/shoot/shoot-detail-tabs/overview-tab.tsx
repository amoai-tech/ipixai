import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";

import {
  formatBudget,
  formatChannelList,
  formatDateRange,
  formatDnaScore,
} from "../shoot-detail-format";
import styles from "../shoot-detail.module.css";

/** IPI-1067 · SHOOT-001 — overview: brief + key facts. */
export function OverviewTab({ detail }: { detail: ShootDetail }) {
  const { shoot } = detail;
  return (
    <div data-testid="shoot-tab-overview">
      {shoot.brief ? (
        <div className={styles.brief}>
          <p className={styles.briefTitle}>Brief</p>
          <p className={styles.briefBody}>{shoot.brief}</p>
        </div>
      ) : null}
      <div className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Dates</span>
          <span className={styles.metaValue}>{formatDateRange(shoot.start_date, shoot.end_date)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Location</span>
          <span className={styles.metaValue}>{shoot.location ?? "Not set"}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Budget</span>
          <span className={styles.metaValue}>
            {formatBudget(shoot.estimated_budget, shoot.currency)}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>DNA score</span>
          <span className={styles.metaValue}>{formatDnaScore(shoot.dna_score)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Channels</span>
          <span className={styles.metaValue}>{formatChannelList(shoot.target_channels)}</span>
        </div>
      </div>
    </div>
  );
}