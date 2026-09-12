"use client";

import { useEffect, useState } from "react";
import { ImageIcon, VideoIcon, FileIcon, RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import { ShootAssetUploader } from "../shoot-asset-uploader";
import { formatCountLabel } from "../shoot-detail-format";

import styles from "../shoot-detail.module.css";

/**
 * IPI-1118 · SHOOT-ASSETS-001 — assets tab renders canonical V2 assets
 * with IPI-1112 secure previews. Asset URLs in the detail payload are
 * metadata only; the authorized preview route is the delivery boundary.
 */
export function AssetsTab({ detail }: { detail: ShootDetail }) {
  const count = detail.assets.length;
  if (count === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          heading="No assets yet"
          body="Assets uploaded for this shoot will show up here."
          icon={<ImageIcon aria-hidden />}
        />
        <ShootAssetUploader brandId={detail.shoot.brand_id} shootId={detail.shoot.id} />
      </div>
    );
  }

  return (
    <div data-testid="shoot-tab-assets" className="space-y-6">
      <p className={styles.sectionTitle}>{formatCountLabel(count, "asset")}</p>
      <div className={styles.assetGrid} role="list" aria-label="Shoot assets">
        {detail.assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>
      <ShootAssetUploader brandId={detail.shoot.brand_id} shootId={detail.shoot.id} />
    </div>
  );
}

function AssetCard({ asset }: { asset: ShootDetail["assets"][0] }) {
  const isVideo = asset.resource_type === "video";
  const isRaw = asset.resource_type === "raw";
  const isImage = asset.resource_type === "image";
  const previewKind = "masonry";

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isImage) {
      setLoading(false);
      setError(true);
      return;
    }
    const controller = new AbortController();
    async function fetchPreview() {
      try {
        const res = await fetch(`/api/assets/${asset.id}/preview?preview=${previewKind}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("preview failed");
        const data = await res.json();
        if (typeof data.url === "string" && data.url.length > 0) {
          setPreviewUrl(data.url);
        } else {
          setError(true);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchPreview();
    return () => { controller.abort(); };
  }, [asset.id, isImage, attempt]);

  const handleRetry = () => {
    setError(false);
    setPreviewUrl(null);
    setLoading(true);
    setAttempt((a) => a + 1);
  };

  if (loading) {
    return (
      <article className={styles.assetCard} role="listitem">
        <div className={styles.assetPreview} aria-busy="true">
          <div className={styles.loadingPlaceholder} />
        </div>
        <div className={styles.assetMeta}>
          <p className={styles.assetId}>{asset.id.slice(0, 8)}…</p>
          <p className={styles.assetDimensions}>
            {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
          </p>
          <p className={styles.assetFormat}>{asset.format ?? "—"}</p>
        </div>
      </article>
    );
  }

  if (error || !previewUrl) {
    return (
      <article className={styles.assetCard} role="listitem">
        <div className={styles.assetPreview}>
          {isRaw ? (
            <div className={styles.rawPlaceholder} aria-label={`Raw asset ${asset.id}`}>
              <FileIcon aria-hidden />
              <span className={styles.rawFormat}>{asset.format?.toUpperCase() ?? "RAW"}</span>
            </div>
          ) : isVideo ? (
            <div className={styles.videoPlaceholder} aria-label={`Video asset ${asset.id}`}>
              <VideoIcon aria-hidden />
              <span className={styles.videoLabel}>Video preview unavailable</span>
            </div>
          ) : (
            <div className={styles.imagePlaceholder} aria-label={`Image asset ${asset.id}`}>
              <ImageIcon aria-hidden />
              <span className={styles.imageLabel}>Preview unavailable</span>
              <button
                type="button"
                className={styles.retryButton}
                onClick={handleRetry}
                aria-label="Retry loading preview"
              >
                <RotateCcw aria-hidden />
              </button>
            </div>
          )}
        </div>
        <div className={styles.assetMeta}>
          <p className={styles.assetId}>{asset.id.slice(0, 8)}…</p>
          <p className={styles.assetDimensions}>
            {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
          </p>
          <p className={styles.assetFormat}>{asset.format ?? "—"}</p>
        </div>
      </article>
    );
  }

  return (
    <article className={styles.assetCard} role="listitem">
      <div className={styles.assetPreview}>
        <img
          className={styles.assetMedia}
          src={previewUrl}
          alt=""
          loading="lazy"
          width={asset.width ?? undefined}
          height={asset.height ?? undefined}
          onError={() => setError(true)}
        />
        <div className={styles.assetOverlay}>
          {asset.status && <span className={styles.assetStatus}>{asset.status}</span>}
          {asset.dna_score !== null && (
            <span className={styles.assetDnaScore}>DNA {asset.dna_score}</span>
          )}
        </div>
      </div>
      <div className={styles.assetMeta}>
        <p className={styles.assetId}>{asset.id.slice(0, 8)}…</p>
        <p className={styles.assetDimensions}>
          {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
        </p>
        <p className={styles.assetFormat}>{asset.format ?? "—"}</p>
      </div>
    </article>
  );
}