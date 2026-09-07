import { Activity } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";

import styles from "../shoot-detail.module.css";

/**
 * IPI-1067 · SHOOT-001 — activity tab: placeholder shell only. Agent-run
 * activity for this shoot is downstream work; this tab renders an honest
 * shell, never fabricated entries.
 */
export function ActivityTab({ detail }: { detail: ShootDetail }) {
  const count = detail.activity.length;
  return (
    <div data-testid="shoot-tab-activity">
      {count > 0 ? (
        <p className={styles.sectionTitle}>
          {count} activity {count === 1 ? "entry" : "entries"}
        </p>
      ) : null}
      <EmptyState
        heading="Activity"
        body="Agent and operator activity for this shoot will show up here."
        icon={<Activity aria-hidden />}
      />
      <p className={styles.placeholderNote}>
        The activity feed arrives with a later task. This tab is a placeholder shell.
      </p>
    </div>
  );
}