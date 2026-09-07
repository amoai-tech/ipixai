import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import { shotStatusDotToken, shotStatusLabel } from "@/lib/shoot/shoot-list-filters";

import styles from "../shoot-detail.module.css";

/** IPI-1067 · SHOOT-001 — shot list (read-only). */
export function ShotsTab({ detail }: { detail: ShootDetail }) {
  const shots = detail.shots;
  if (shots.length === 0) {
    return (
      <EmptyState
        heading="No shot list yet"
        body="Shot lists generated for this shoot will show up here."
        icon={<ClipboardList aria-hidden />}
      />
    );
  }
  return (
    <div data-testid="shoot-tab-shots">
      <ul className={styles.list}>
        {shots.map((shot) => (
          <li key={shot.id} className={styles.listItem}>
            <div className={styles.itemTitle}>
              {shot.shot_number !== null ? `Shot ${shot.shot_number}` : "Shot"}
              {shot.status ? (
                <span style={{ marginLeft: 8 }}>
                  <StatusChip
                    dot={shotStatusDotToken(shot.status)}
                    label={shotStatusLabel(shot.status)}
                    bare
                  />
                </span>
              ) : null}
            </div>
            {shot.description ? <p className={styles.itemBody}>{shot.description}</p> : null}
            {shot.style_notes ? (
              <p className={styles.itemMeta}>Style: {shot.style_notes}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}