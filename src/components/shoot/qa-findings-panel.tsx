"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

import type { QAAssetResult, QAChannelResult, QAFinding } from "@/lib/asset-qa/types";

const STATUS_ICONS = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
  unknown: HelpCircle,
} as const;

function getStatusIcon(status: keyof typeof STATUS_ICONS) {
  return STATUS_ICONS[status];
}

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

interface QAFindingsPanelProps {
  assetId: string;
  shootId?: string;
  channels?: string[];
  initialResult?: QAAssetResult | null;
  loading?: boolean;
  error?: string | null;
  onRunQA: () => Promise<void>;
}

export function QAFindingsPanel({ assetId, shootId, channels, initialResult, loading, error, onRunQA }: QAFindingsPanelProps) {
  const [result, setResult] = useState<QAAssetResult | null>(initialResult ?? null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  useEffect(() => {
    setResult(initialResult ?? null);
  }, [initialResult]);

  const handleRunQA = () => {
    onRunQA();
  };

  const isLoading = loading ?? false;
  const currentError = error ?? null;

  if (!result && !isLoading && !currentError) {
    return (
      <div className="qa-panel p-4 border border-gray-200 rounded-lg bg-gray-50">
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

  if (isLoading) {
    return (
      <div className="qa-panel p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
          Running QA checks...
        </div>
      </div>
    );
  }

  if (currentError) {
    return (
      <div className="qa-panel p-4 border border-red-200 rounded-lg bg-red-50">
        <p className="text-red-600 mb-2">Error: {currentError}</p>
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
    <div className="qa-panel border border-gray-200 rounded-lg bg-white">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <OverallIcon className={`w-6 h-6 ${overallColor}`} aria-hidden />
            <div>
              <h4 className="font-semibold text-gray-900">Quality & Channel Readiness</h4>
              <p className="text-sm text-gray-500">
                Overall: <span className={`font-medium ${overallColor}`}>{result.overallStatus.toUpperCase()}</span> • Score: {result.overallScore ?? "N/A"}/100
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
            {channel.platform} / {channel.imageType} • Score: {channel.score ?? "N/A"}/100
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