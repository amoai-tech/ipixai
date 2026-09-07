import { BadgeCheck } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";

import styles from "../shoot-detail.module.css";

/**
 * IPI-1067 · SHOOT-001 — approvals tab: placeholder shell only. The
 * approval workflow (review/edit/approve/reject) is downstream work; this
 * tab renders an honest shell, never fake controls.
 */
export function ApprovalsTab({ detail }: { detail: ShootDetail }) {
  const count = detail.approvals.length;
  return (
    <div data-testid="shoot-tab-approvals">
      {count > 0 ? (
        <p className={styles.sectionTitle}>
          {count} approval{count === 1 ? "" : "s"}
        </p>
      ) : null}
      <EmptyState
        heading="Approvals"
        body="Approval records for this shoot will show up here."
        icon={<BadgeCheck aria-hidden />}
      />
      <p className={styles.placeholderNote}>
        The approval workflow arrives with a later task. This tab is a placeholder shell.
      </p>
    </div>
  );
}