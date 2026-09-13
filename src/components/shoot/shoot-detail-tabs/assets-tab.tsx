"use client";

import { useEffect, useState } from "react";
import { ImageIcon, VideoIcon, FileIcon, RotateCcw, CheckCircle2, AlertTriangle, XCircle, HelpCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import { ShootAssetUploader } from "../shoot-asset-uploader";
import { formatCountLabel } from "../shoot-detail-format";

import styles from "../shoot-detail.module.css";

/**
 * IPI-1118 · SHOOT-ASSETS-001 — assets tab renders canonical V2 assets
 * with IPI-1112 secure previews. Asset URLs in the detail payload are
 * metadata only; the authorized preview route is the delivery boundary.
 * IPI-1138 · ASSET-QA-001 — adds QA findings panel for asset quality checks.
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
          <AssetCard key={asset.id} asset={asset} shootId={detail.shoot.id} />
        ))}
      </div>
      <ShootAssetUploader brandId={detail.shoot.brand_id} shootId={detail.shoot.id} />
    </div>
  );
}

function AssetCard({ asset, shootId }: { asset: ShootDetail["assets"][0]; shootId: string }) {
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

  const runQA = async () => {
    setQaLoading(true);
    setQaError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}/qa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shootId }),
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
      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          type="button"
          onClick={() => setShowQA(!showQA)}
          className="w-full py-2 px-3 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          {showQA ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>{showQA ? "Hide" : "Show"} Quality & Channel Readiness</span>
          <RefreshCw className="w-4 h-4" aria-hidden />
        </button>
        {showQA && (
          <QAFindingsPanel
            assetId={asset.id}
            shootId={shootId}
            initialResult={qaResult}
            loading={qaLoading}
            error={qaError}
            onRunQA={runQA}
          />
        )}
      </div>
    </article>
  );
}

interface QAAssetResult {
  assetId: string;
  cloudinaryAssetId: string | null;
  version: number;
  width: number;
  height: number;
  format: string;
  bytes: number;
  aspectRatio: string;
  channels: QAChannelResult[];
  overallStatus: "pass" | "warn" | "fail" | "unknown";
  overallScore: number;
  checkedAt: string;
  checkerVersion: string;
}

interface QAChannelResult {
  channel: string;
  platform: string;
  imageType: string;
  specConfidence: "official" | "community" | "estimated" | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  findings: QAFinding[];
  overallStatus: "pass" | "warn" | "fail" | "unknown";
  score: number;
}

interface QAFinding {
  code: string;
  status: "pass" | "warn" | "fail" | "unknown";
  severity: "info" | "warning" | "error";
  message: string;
  evidence?: Record<string, unknown>;
  recommendedAction?: string;
}

const STATUS_ICONS = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
  unknown: HelpCircle,
} as const;

const STATUS_COLORS = {
  pass: "text-green-600",
  warn: "text-amber-600",
  fail: "text-red-600",
  unknown: "text-gray-500",
} as const;

const SEVERITY_COLORS = {
  info: "text-blue-600",
  warning: "text-amber-600",
  error: "text-red-600",
} as const;

function getStatusIcon(status: keyof typeof STATUS_ICONS) {
  return STATUS_ICONS[status];
}

function QAFindingsPanel({
  assetId,
  shootId,
  initialResult,
  loading,
  error,
  onRunQA,
}: {
  assetId: string;
  shootId: string;
  initialResult: QAAssetResult | null;
  loading: boolean;
  error: string | null;
  onRunQA: () => void;
}) {
  const [result, setResult] = useState<QAAssetResult | null>(initialResult);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  const handleRunQA = async () => {
    await onRunQA();
  };

  if (!result && !loading && !error) {
    return (
      <div className="qa-panel p-4 border border-gray-200 rounded-lg bg-gray-50 mt-3">
        <button
          type="button"
          onClick={handleRunQA}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" aria-hidden />
          Run Quality & Channel Readiness Check
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="qa-panel p-4 border border-gray-200 rounded-lg bg-gray-50 mt-3">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
          Running QA checks...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="qa-panel p-4 border border-red-200 rounded-lg bg-red-50 mt-3">
        <p className="text-red-600 mb-2">Error: {error}</p>
        <button
          type="button"
          onClick={handleRunQA}
          className="py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!result) return null;

  const OverallIcon = getStatusIcon(result.overallStatus);
  const overallColor = STATUS_COLORS[result.overallStatus];

  return (
    <div className="qa-panel border border-gray-200 rounded-lg bg-white mt-3">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <OverallIcon className={`w-6 h-6 ${overallColor}`} aria-hidden />
            <div>
              <h4 className="font-semibold text-gray-900">Quality & Channel Readiness</h4>
              <p className="text-sm text-gray-500">
                Overall: <span className={`font-medium ${overallColor}`}>{result.overallStatus.toUpperCase()}</span> • Score: {result.overallScore}/100
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRunQA}
            className="py-1 px-3 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" aria-hidden />
            Re-run
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {result.channels.map((channel) => (
          <ChannelFindings
            key={channel.channel}
            channel={channel}
            expanded={expandedChannels.has(channel.channel)}
            onToggle={() => {
              setExpandedChannels((prev) => {
                const next = new Set(prev);
                if (next.has(channel.channel)) next.delete(channel.channel);
                else next.add(channel.channel);
                return next;
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ChannelFindings({ channel, expanded, onToggle }: { channel: QAChannelResult; expanded: boolean; onToggle: () => void }) {
  const ChannelIcon = getStatusIcon(channel.overallStatus);
  const channelColor = STATUS_COLORS[channel.overallStatus];

  return (
    <div className="channel-findings">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
      >
        <ChannelIcon className={`w-5 h-5 ${channelColor}`} aria-hidden />
        <div className="flex-1">
          <p className="font-medium text-gray-900">{channel.channel}</p>
          <p className="text-sm text-gray-500">
            {channel.platform} / {channel.imageType} • Score: {channel.score}/100
          </p>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded ${channelColor} bg-opacity-10`}>
          {channel.overallStatus.toUpperCase()}
        </span>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          {channel.specConfidence && (
            <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
              <span className="font-medium text-blue-800">Spec Confidence: </span>
              <span className="text-blue-700 capitalize">{channel.specConfidence}</span>
              {channel.lastVerifiedAt && (
                <>
                  <span className="text-blue-700 mx-2">•</span>
                  <span className="text-blue-700">Last verified: {new Date(channel.lastVerifiedAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            {channel.findings.map((finding, idx) => (
              <FindingRow key={idx} finding={finding} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingRow({ finding }: { finding: QAFinding }) {
  const FindingIcon = getStatusIcon(finding.status);
  const statusColor = STATUS_COLORS[finding.status];
  const severityColor = SEVERITY_COLORS[finding.severity];

  return (
    <div className="finding-row flex gap-3 p-3 bg-white rounded border border-gray-200">
      <FindingIcon className={`w-5 h-5 ${statusColor} flex-shrink-0 mt-0.5`} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{finding.message}</span>
          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${severityColor} bg-opacity-10`}>
            {finding.severity.toUpperCase()}
          </span>
          <span className="px-1.5 py-0.5 text-xs font-medium rounded text-gray-600 bg-gray-100">
            {finding.code}
          </span>
        </div>
        {finding.evidence && Object.keys(finding.evidence).length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer">Show evidence</summary>
            <pre className="mt-1 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(finding.evidence, null, 2)}
            </pre>
          </details>
        )}
        {finding.recommendedAction && (
          <p className="mt-2 text-sm text-blue-700 bg-blue-50 p-2 rounded">
            <span className="font-medium">Recommended: </span>{finding.recommendedAction}
          </p>
        )}
      </div>
    </div>
  );
}