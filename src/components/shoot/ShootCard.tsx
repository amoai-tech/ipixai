import Link from "next/link";
import { Camera } from "lucide-react";

import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import type { ShootListItem } from "@/lib/shoot/get-shoot-detail";
import {
  channelLabel,
  shootStatusDotToken,
  shootStatusLabel,
} from "@/lib/shoot/shoot-list-filters";

import styles from "./shoots-list.module.css";

/** DNA badge tone — mirrors command-center.tsx (>=80 high, >=60 mid, else low). */
function dnaBadgeClass(score: number): string {
  if (score >= 80) return `${styles.dnaBadge} ${styles.dnaHigh}`;
  if (score >= 60) return `${styles.dnaBadge} ${styles.dnaMid}`;
  return `${styles.dnaBadge} ${styles.dnaLow}`;
}

/**
 * IPI-1067 · SHOOT-001 — browse card for one shoot. COPY+CLEAN of Lumina's
 * ShootCard, adapted to org-scoped server data and current atoms.
 *
 * Direct card → detail navigation (no IntelligencePanel detour): the whole
 * card is a Link to `/app/shoots/[id]`. The thumb is an honest no-image
 * tile — `cover_url` has no proven secure-delivery bridge until
 * IPI-1112 · CLD-DELIVERY-001, so it is never rendered here.
 */
export function ShootCard({ shoot }: { shoot: ShootListItem }) {
  return (
    <li>
      <Link href={`/app/shoots/${shoot.id}`} className={styles.cardLink}>
        <Card>
          <div className={styles.thumb}>
            <span className={styles.thumbPlaceholder} aria-hidden>
              <Camera size={28} strokeWidth={1.5} />
            </span>
            {typeof shoot.dnaScore === "number" && (
              <span
                className={dnaBadgeClass(shoot.dnaScore)}
                aria-label={`DNA score: ${Math.round(shoot.dnaScore)}`}
              >
                {Math.round(shoot.dnaScore)}
              </span>
            )}
          </div>
          <div className={styles.body}>
            <p className={styles.title}>{shoot.name}</p>
            <StatusChip
              dot={shootStatusDotToken(shoot.status)}
              label={shootStatusLabel(shoot.status)}
            />
            <p className={styles.meta}>
              <span>{channelLabel(shoot.channel)}</span>
              {shoot.shotCount !== null && (
                <>
                  <span className={styles.metaSeparator} aria-hidden>
                    ·
                  </span>
                  <span>
                    {shoot.shotCount} shot{shoot.shotCount === 1 ? "" : "s"}
                  </span>
                </>
              )}
              {shoot.assetCount !== null && (
                <>
                  <span className={styles.metaSeparator} aria-hidden>
                    ·
                  </span>
                  <span>
                    {shoot.assetCount} asset{shoot.assetCount === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </p>
          </div>
        </Card>
      </Link>
    </li>
  );
}