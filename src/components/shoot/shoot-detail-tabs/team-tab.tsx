import { Users } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";

import styles from "../shoot-detail.module.css";

/** IPI-1067 · SHOOT-001 — crew list (read-only). */
export function TeamTab({ detail }: { detail: ShootDetail }) {
  const crew = detail.crew;
  if (crew.length === 0) {
    return (
      <EmptyState
        heading="No crew yet"
        body="Crew assigned to this shoot will show up here."
        icon={<Users aria-hidden />}
      />
    );
  }
  return (
    <div data-testid="shoot-tab-team">
      <ul className={styles.list}>
        {crew.map((member) => (
          <li key={member.id} className={styles.listItem}>
            <div className={styles.itemTitle}>{member.role ?? "Crew member"}</div>
            {member.confirmed !== null && (
              <p className={styles.itemMeta}>{member.confirmed ? "Confirmed" : "Not confirmed"}</p>
            )}
            {member.notes ? <p className={styles.itemBody}>{member.notes}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}