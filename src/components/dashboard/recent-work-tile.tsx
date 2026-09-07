"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";

import { channelLabel } from "@/lib/shoot/shoot-list-filters";

import styles from "./command-center.module.css";

function dnaBadgeClass(score: number): string {
  if (score >= 80) return `${styles.recentDnaBadge} ${styles.recentDnaHigh}`;
  if (score >= 60) return `${styles.recentDnaBadge} ${styles.recentDnaMid}`;
  return `${styles.recentDnaBadge} ${styles.recentDnaLow}`;
}

/**
 * Client boundary isolated to exactly one Recent Work tile — not all of
 * CommandCenter (a server component): a signed preview URL can fail to
 * load after the server already validated it (network blip, the
 * underlying Cloudinary asset deleted/renamed after the DB mirror row was
 * checked, a corrupt transform, etc.), and recovering from that needs an
 * `onError` handler, which needs client-side state.
 *
 * On failure this tile falls back to exactly the same honest placeholder +
 * below-thumb title the no-preview-yet path already renders (never a
 * broken-image icon) — `showImage` is the single source of truth both
 * branches below key off, so the two paths can't drift out of sync.
 */
export function RecentWorkTile({
  shootId,
  name,
  channel,
  dnaScore,
  previewUrl,
  aspectRatioLabel,
}: {
  shootId: string;
  name: string;
  channel: string | null;
  dnaScore: number | null;
  previewUrl: string | undefined;
  /** Real per-channel spec from image_specs (via loadChannelSpecs), never a
   *  guessed default — undefined for any channel that reference table
   *  doesn't cover, in which case the meta line shows the channel alone. */
  aspectRatioLabel?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(previewUrl) && !imageFailed;

  return (
    <Link href={`/app/shoots/${shootId}`} className={styles.recentTile}>
      <div className={styles.recentThumb}>
        {/* shoot_portfolio_view.cover_url (mood_board_urls) is never
            rendered directly — no bridge to this app's one proven
            secure-delivery contract. The real cover here comes only from
            loadRecentWorkPreviews: a shoot-linked `assets` row with an
            `authenticated`-type Cloudinary mirror, signed by
            get-authorized-asset-preview.ts, per
            IPI-1112 · CLD-DELIVERY-001 — Serve Org-Safe Cloudinary
            Previews with Named Transforms. No entry for this shoot in the
            map, or a load failure below, both mean the same thing to the
            operator: honest no-image placeholder, not a fabricated cover. */}
        {showImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL; Next/Image would re-request/re-optimize it server-side */}
            <img
              src={previewUrl}
              alt=""
              className={styles.recentImage}
              onError={() => setImageFailed(true)}
            />
            <span className={styles.recentThumbScrim} aria-hidden />
            <span className={styles.recentLabel}>{name}</span>
          </>
        ) : (
          <span className={styles.recentThumbPlaceholder} aria-hidden>
            <Camera />
          </span>
        )}
        {typeof dnaScore === "number" && (
          <span
            className={dnaBadgeClass(dnaScore)}
            aria-label={`DNA score: ${Math.round(dnaScore)}`}
          >
            {Math.round(dnaScore)}
          </span>
        )}
      </div>
      {!showImage && <p className={styles.recentTitle}>{name}</p>}
      {channel && (
        <p className={styles.recentMeta}>
          {/* channelLabel: same short display convention already shown
              elsewhere for shoots (ShootCard, deliverables tab) — real enum
              values (e.g. "instagram_feed") shouldn't render raw here
              either. aspectRatioLabel only ever comes from a live
              image_specs row (see command-center.tsx); no channel gets a
              guessed ratio appended. */}
          {aspectRatioLabel ? `${channelLabel(channel)} · ${aspectRatioLabel}` : channelLabel(channel)}
        </p>
      )}
    </Link>
  );
}
