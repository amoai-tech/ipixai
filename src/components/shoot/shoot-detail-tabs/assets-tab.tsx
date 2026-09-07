import { ImageIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import { formatCountLabel } from "../shoot-detail-format";

import styles from "../shoot-detail.module.css";

/**
 * IPI-1067 · SHOOT-001 — assets tab: count + honest placeholder only.
 * Secure previews arrive with IPI-1112 · CLD-DELIVERY-001 — asset URLs in
 * the detail payload have no proven secure-delivery bridge, so they are
 * never rendered here (same contract as the browse cards).
 */
export function AssetsTab({ detail }: { detail: ShootDetail }) {
  const count = detail.assets.length;
  if (count === 0) {
    return (
      <EmptyState
        heading="No assets yet"
        body="Assets uploaded for this shoot will show up here."
        icon={<ImageIcon aria-hidden />}
      />
    );
  }
  return (
    <div data-testid="shoot-tab-assets">
      <p className={styles.sectionTitle}>{formatCountLabel(count, "asset")}</p>
      <p className={styles.placeholderNote}>
        Secure asset previews arrive with IPI-1112 · CLD-DELIVERY-001. Until then, asset
        thumbnails are not rendered.
      </p>
    </div>
  );
}