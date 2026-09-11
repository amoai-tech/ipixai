import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import {
  brandStatusDotToken,
  brandStatusLabel,
  type BrandListItem,
} from "@/lib/brand/get-brands";

import styles from "./brands-list.module.css";

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * IPI-1068 · BRAND-001 — browse card for one brand. Mirrors `ShootCard`:
 * whole card is a `Link` to `/app/brands/[id]`, honest no-image thumb (no
 * fabricated cover), and a status chip reflecting real durable state
 * (`brandStatusLabel`) rather than a score-presence heuristic.
 */
export function BrandCard({ brand }: { brand: BrandListItem }) {
  const hostname = hostnameOf(brand.brandUrl);
  return (
    <li>
      <Link href={`/app/brands/${brand.id}`} className={styles.cardLink}>
        <Card>
          <div className={styles.thumb}>
            <span className={styles.thumbPlaceholder} aria-hidden>
              <Sparkles size={28} strokeWidth={1.5} />
            </span>
          </div>
          <div className={styles.body}>
            <p className={styles.title}>{brand.name}</p>
            <StatusChip
              dot={brandStatusDotToken(brand.intakeStatus, brand.approvedProfileAt)}
              label={brandStatusLabel(brand.intakeStatus, brand.approvedProfileAt)}
            />
            {hostname && <p className={styles.meta}>{hostname}</p>}
          </div>
        </Card>
      </Link>
    </li>
  );
}
