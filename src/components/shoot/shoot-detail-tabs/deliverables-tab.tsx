import { PackageCheck } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import {
  channelLabel,
  deliverableStatusDotToken,
  deliverableStatusLabel,
} from "@/lib/shoot/shoot-list-filters";

import styles from "../shoot-detail.module.css";

/** IPI-1067 · SHOOT-001 — deliverables list (read-only). */
export function DeliverablesTab({ detail }: { detail: ShootDetail }) {
  const deliverables = detail.deliverables;
  if (deliverables.length === 0) {
    return (
      <EmptyState
        heading="No deliverables yet"
        body="Deliverables planned for this shoot will show up here."
        icon={<PackageCheck aria-hidden />}
      />
    );
  }
  return (
    <div data-testid="shoot-tab-deliverables">
      <ul className={styles.list}>
        {deliverables.map((deliverable) => (
          <li key={deliverable.id} className={styles.listItem}>
            <div className={styles.itemTitle}>
              {channelLabel(deliverable.channel)}
              {deliverable.status ? (
                <span style={{ marginLeft: 8 }}>
                  <StatusChip
                    dot={deliverableStatusDotToken(deliverable.status)}
                    label={deliverableStatusLabel(deliverable.status)}
                    bare
                  />
                </span>
              ) : null}
            </div>
            <p className={styles.itemMeta}>
              {deliverable.format ?? "Any format"}
              {deliverable.quantity !== null ? ` · ${deliverable.quantity}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}