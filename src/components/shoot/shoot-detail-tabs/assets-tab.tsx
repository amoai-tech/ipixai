"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, VideoIcon, FileIcon, RotateCcw, ChevronDown, ChevronUp, Check, X } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import { ShootAssetUploader } from "../shoot-asset-uploader";
import { formatCountLabel } from "../shoot-detail-format";
import { QAFindingsPanel } from "../qa-findings-panel";
import type { QAAssetResult, QAChannelResult, QAFinding } from "@/lib/asset-qa/types";

import styles from "../shoot-detail.module.css";

/**
 * IPI-1118 · SHOOT-ASSETS-001 — assets tab renders canonical V2 assets
 * with IPI-1112 secure previews. Asset URLs in the detail payload are
 * metadata only; the authorized preview route is the delivery boundary.
 * IPI-1138 · ASSET-QA-001 — adds QA findings panel for asset quality checks.
 * IPI-1119 · MEDIA-APPROVAL-001 — exact-version approve/reject.
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

type ApprovalState = string | null | undefined;

function ApprovalBadge({ approval, assetId }: { approval: ApprovalState; assetId: string }) {
  return (
    <span
      data-testid={`asset-approval-${assetId}`}
      className={
        approval === "approved"
          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800"
          : approval === "rejected"
            ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
            : "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700"
      }
    >
      {approval === "approved"
        ? "Approved"
        : approval === "rejected"
          ? "Rejected"
          : "Pending"}
    </span>
  );
}

type AssetDecisionIdentity = {
  assetId: string;
  version: string | number | null | undefined;
  cloudinaryAssetId: string | null | undefined;
};

type AssetDecisionState = {
  approval: ApprovalState;
  hasExactVersion: boolean;
  pending: boolean;
  final: boolean;
  staleWarning: boolean;
  error: string | null;
};

type AssetDecisionPanelProps = {
  identity: AssetDecisionIdentity;
  state: AssetDecisionState;
  reason: string;
  onReasonChange: Dispatch<SetStateAction<string>>;
  onApprove: () => void;
  onReject: () => void;
  onRefresh: () => void;
};

function AssetDecisionPanel({
  identity,
  state,
  reason,
  onReasonChange,
  onApprove,
  onReject,
  onRefresh,
}: AssetDecisionPanelProps) {
  const { assetId, version, cloudinaryAssetId } = identity;
  const {
    approval,
    hasExactVersion,
    pending: decisionPending,
    final: decisionFinal,
    staleWarning,
    error: decisionError,
  } = state;
  const buttonsDisabled = !hasExactVersion || decisionPending || decisionFinal;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Approval
        </span>
        <ApprovalBadge approval={approval} assetId={assetId} />
      </div>

      {hasExactVersion ? (
        <p className="mb-2 text-xs text-gray-500">
          Version {String(version)} · {cloudinaryAssetId?.slice(0, 12)}…
        </p>
      ) : (
        <p className="mb-2 text-xs text-gray-500">
          Exact version unavailable — approval is disabled until the provider version is known.
        </p>
      )}

      {staleWarning && (
        <div
          role="alert"
          data-testid={`asset-stale-${assetId}`}
          className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          This asset changed while you were reviewing it. Review the newest version before
          deciding.
          <button type="button" onClick={onRefresh} className="ml-2 font-semibold underline">
            Refresh
          </button>
        </div>
      )}

      {decisionError && (
        <p role="alert" className="mb-2 text-xs text-red-700">
          {decisionError}
        </p>
      )}

      <input
        type="text"
        value={reason}
        onChange={(e) => { onReasonChange(e.target.value); }}
        placeholder="Reason (optional)"
        aria-label="Decision reason (optional)"
        className="mb-2 w-full rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700"
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={buttonsDisabled}
          onClick={onApprove}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4" aria-hidden />
          Approve
        </button>
        <button
          type="button"
          disabled={buttonsDisabled}
          onClick={onReject}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden />
          Reject
        </button>
      </div>

      {decisionFinal && (
        <p className="mt-2 text-xs text-gray-500">
          Decision is final for this exact version. A newer uploaded version returns to Pending.
        </p>
      )}
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
  const [showQA, setShowQA] = useState(false);
  const [qaResult, setQaResult] = useState<QAAssetResult | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [approval, setApproval] = useState<string | null>(asset.approval ?? null);
  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [staleWarning, setStaleWarning] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();

  // Re-sync local decision state when the underlying asset row changes, e.g.
  // after router.refresh() surfaces a newer provider version following a
  // stale warning. Keyed on id/version/approval so a local optimistic
  // decision (which does not change the prop) is not clobbered.
  useEffect(() => {
    setApproval(asset.approval ?? null);
    setStaleWarning(false);
    setDecisionError(null);
  }, [asset.id, asset.version, asset.approval]);

  useEffect(() => {
    setPreviewUrl(null);
    setLoading(true);
    setError(false);

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
  }, [asset.id, asset.version, isImage, attempt]);

  const handleRetry = () => {
    setError(false);
    setPreviewUrl(null);
    setLoading(true);
    setAttempt((a) => a + 1);
  };

  const runQA = async () => {
    setQaLoading(true);
    setQaError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}/qa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.reason || "QA check failed");
      }
      const data = await res.json();
      setQaResult(data);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "Failed to run QA check");
    } finally {
      setQaLoading(false);
    }
  };

  const hasExactVersion =
    typeof asset.cloudinary_asset_id === "string" &&
    asset.cloudinary_asset_id.length > 0 &&
    asset.version !== null &&
    asset.version !== undefined;

  const decisionFinal = approval === "approved" || approval === "rejected";

  const handleDecision = async (decision: "approved" | "rejected") => {
    if (!hasExactVersion) return;
    setDecisionPending(true);
    setDecisionError(null);
    setStaleWarning(false);
    try {
      const res = await fetch(`/api/assets/${asset.id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          expectedCloudinaryAssetId: asset.cloudinary_asset_id,
          expectedVersion: asset.version,
          reason: reason.trim() || undefined,
          requestId: crypto.randomUUID(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.reason === "stale_version") {
          setStaleWarning(true);
          return;
        }
        throw new Error(data.reason || "Decision failed");
      }
      setApproval(typeof data.approval === "string" ? data.approval : decision);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setDecisionPending(false);
    }
  };

  // Rendered in the preview-unavailable and loaded branches so video/raw
  // assets and failed previews still expose the exact-version decision
  // controls. The transient loading branch shows the read-only badge only.
  const decisionIdentity: AssetDecisionIdentity = {
    assetId: asset.id,
    version: asset.version,
    cloudinaryAssetId: asset.cloudinary_asset_id,
  };
  const decisionState: AssetDecisionState = {
    approval,
    hasExactVersion,
    pending: decisionPending,
    final: decisionFinal,
    staleWarning,
    error: decisionError,
  };
  const decisionPanel = (
    <AssetDecisionPanel
      identity={decisionIdentity}
      state={decisionState}
      reason={reason}
      onReasonChange={setReason}
      onApprove={() => { void handleDecision("approved"); }}
      onReject={() => { void handleDecision("rejected"); }}
      onRefresh={() => { router.refresh(); }}
    />
  );

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
        <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Approval
          </span>
          <ApprovalBadge approval={asset.approval} assetId={asset.id} />
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
        {decisionPanel}
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
      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          type="button"
          onClick={() => { setShowQA(!showQA); }}
          className="w-full py-2 px-3 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          {showQA ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>{showQA ? "Hide" : "Show"} Quality & Channel Readiness</span>
        </button>
        {showQA && (
          <QAFindingsPanel
            assetId={asset.id}
            initialResult={qaResult}
            loading={qaLoading}
            error={qaError}
            onRunQA={runQA}
          />
        )}
      </div>
      {decisionPanel}
    </article>
  );
}
