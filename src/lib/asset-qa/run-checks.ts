import type {
  QAFinding,
  QAFindingStatus,
  QAFindingSeverity,
  QAChannelResult,
  ChannelSpecFull,
  CloudinaryAssetMetadata,
  QAFindingCode,
} from "./types";

function makeFinding(
  code: QAFindingCode,
  status: QAFindingStatus,
  severity: QAFindingSeverity,
  message: string,
  evidence?: Record<string, unknown>,
  recommendedAction?: string,
): QAFinding {
  return { code, status, severity, message, evidence, recommendedAction };
}

function aspectRatioToString(w: number | null, h: number | null): string | null {
  if (!w || !h) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

function parseAspectRatio(label: string | null): { w: number; h: number } | null {
  if (!label) return null;
  const parts = label.split(":");
  if (parts.length !== 2) return null;
  const w = parseInt(parts[0], 10);
  const h = parseInt(parts[1], 10);
  if (isNaN(w) || isNaN(h) || w === 0 || h === 0) return null;
  return { w, h };
}

function aspectRatiosMatch(assetW: number, assetH: number, specW: number, specH: number): boolean {
  const assetRatio = assetW / assetH;
  const specRatio = specW / specH;
  return Math.abs(assetRatio - specRatio) < 0.02;
}

export function runDeterministicChecks(
  asset: CloudinaryAssetMetadata,
  spec: ChannelSpecFull,
  channel: string,
): QAFinding[] {
  const findings: QAFinding[] = [];

  if (!spec.aspectRatioLabel) {
    findings.push(
      makeFinding(
        "spec_missing",
        "unknown",
        "warning",
        `Channel "${channel}" spec missing aspect ratio label`,
        { specConfidence: spec.specConfidence, sourceUrl: spec.sourceUrl },
        "Verify channel spec data in Supabase",
      ),
    );
  } else {
    const specRatio = parseAspectRatio(spec.aspectRatioLabel);
    if (specRatio) {
const matches = aspectRatiosMatch(asset.width, asset.height, specRatio.w, specRatio.h);
    findings.push(
      makeFinding(
        matches ? "aspect_ratio_valid" : "aspect_ratio_mismatch",
        matches ? "pass" : "fail",
        matches ? "info" : "error",
        matches
          ? `Aspect ratio ${asset.width}:${asset.height} matches spec ${spec.aspectRatioLabel}`
          : `Aspect ratio ${asset.width}:${asset.height} does not match spec ${spec.aspectRatioLabel}`,
        { assetAspectRatio: `${asset.width}:${asset.height}`, specAspectRatio: spec.aspectRatioLabel },
        matches ? undefined : "Re-shoot or crop to match required aspect ratio",
      ),
    );
    } else {
      findings.push(
        makeFinding(
          "spec_missing",
          "unknown",
          "warning",
          `Channel "${channel}" spec aspect ratio label "${spec.aspectRatioLabel}" is unparseable`,
          { specAspectRatioLabel: spec.aspectRatioLabel },
          "Fix spec data in Supabase",
        ),
      );
    }
  }

  if (spec.widthPx && spec.heightPx) {
    const meetsMinWidth = !spec.minWidthPx || asset.width >= spec.minWidthPx;
    const meetsMinHeight = !spec.minHeightPx || asset.height >= spec.minHeightPx;
    const meetsMaxWidth = !spec.maxWidthPx || asset.width <= spec.maxWidthPx;
    const meetsMaxHeight = !spec.maxHeightPx || asset.height <= spec.maxHeightPx;

    const resolutionOk = meetsMinWidth && meetsMinHeight && meetsMaxWidth && meetsMaxHeight;

    findings.push(
      makeFinding(
        resolutionOk ? "resolution_sufficient" : "resolution_insufficient",
        resolutionOk ? "pass" : "fail",
        resolutionOk ? "info" : "error",
        resolutionOk
          ? `Resolution ${asset.width}×${asset.height} meets spec requirements`
          : `Resolution ${asset.width}×${asset.height} does not meet spec (min: ${spec.minWidthPx ?? "any"}×${spec.minHeightPx ?? "any"}, max: ${spec.maxWidthPx ?? "any"}×${spec.maxHeightPx ?? "any"})`,
        {
          assetWidth: asset.width,
          assetHeight: asset.height,
          specMinWidth: spec.minWidthPx,
          specMinHeight: spec.minHeightPx,
          specMaxWidth: spec.maxWidthPx,
          specMaxHeight: spec.maxHeightPx,
        },
        resolutionOk ? undefined : "Re-shoot at higher resolution or check spec limits",
      ),
    );
  }

  const assetFormatUpper = asset.format.toUpperCase();
  const acceptedFormatsUpper = spec.acceptedFormats.map((f) => f.toUpperCase());
  const formatSupported = acceptedFormatsUpper.includes(assetFormatUpper);

  findings.push(
    makeFinding(
      formatSupported ? "format_supported" : "format_unsupported",
      formatSupported ? "pass" : "fail",
      formatSupported ? "info" : "error",
      formatSupported
        ? `Format ${asset.format} is supported for ${channel}`
        : `Format ${asset.format} is not in accepted formats: ${spec.acceptedFormats.join(", ")}`,
      { assetFormat: asset.format, acceptedFormats: spec.acceptedFormats },
      formatSupported ? undefined : "Convert to supported format or update spec",
    ),
  );

  if (spec.maxFileSizeMb !== null && spec.maxFileSizeMb > 0) {
    const assetSizeMb = asset.bytes / (1024 * 1024);
    const sizeOk = assetSizeMb <= spec.maxFileSizeMb;

    findings.push(
      makeFinding(
        sizeOk ? "file_size_within_limit" : "file_size_exceeds_limit",
        sizeOk ? "pass" : "fail",
        sizeOk ? "info" : "error",
        sizeOk
          ? `File size ${assetSizeMb.toFixed(2)}MB is within limit of ${spec.maxFileSizeMb}MB`
          : `File size ${assetSizeMb.toFixed(2)}MB exceeds limit of ${spec.maxFileSizeMb}MB`,
        { assetSizeMb: Number(assetSizeMb.toFixed(2)), maxFileSizeMb: spec.maxFileSizeMb },
        sizeOk ? undefined : "Compress image or request spec limit increase",
      ),
    );
  }

  if (spec.backgroundRequired) {
    findings.push(
      makeFinding(
        "background_mismatch",
        "unknown",
        "warning",
        `Background requirement: ${spec.backgroundRequired} — cannot verify automatically`,
        { backgroundRequired: spec.backgroundRequired },
        "Manual review required: verify background matches requirement",
      ),
    );
  }

  if (spec.productFillMinPct !== null && spec.productFillMinPct > 0) {
    findings.push(
      makeFinding(
        "product_fill_insufficient",
        "unknown",
        "warning",
        `Product fill minimum ${spec.productFillMinPct}% — cannot verify automatically`,
        { productFillMinPct: spec.productFillMinPct },
        "Manual review required: verify product fills required percentage of frame",
      ),
    );
  }

  const hasSafeZones =
    spec.safeZoneTopPx !== null ||
    spec.safeZoneBottomPx !== null ||
    spec.safeZoneLeftPx !== null ||
    spec.safeZoneRightPx !== null;

  if (hasSafeZones) {
    if (asset.coordinates && Object.keys(asset.coordinates).length > 0) {
      findings.push(
        makeFinding(
          "safe_zone_ok",
          "pass",
          "info",
          "Safe zones defined and coordinates available for verification",
          { safeZones: { top: spec.safeZoneTopPx, bottom: spec.safeZoneBottomPx, left: spec.safeZoneLeftPx, right: spec.safeZoneRightPx } },
        ),
      );
    } else {
      findings.push(
        makeFinding(
          "safe_zone_unknown",
          "unknown",
          "warning",
          "Safe zones defined but no subject/text coordinates available for verification",
          { safeZones: { top: spec.safeZoneTopPx, bottom: spec.safeZoneBottomPx, left: spec.safeZoneLeftPx, right: spec.safeZoneRightPx } },
          "Manual review required: verify subject/text within safe zones",
        ),
      );
    }
  }

  if (spec.specConfidence === "community") {
    findings.push(
      makeFinding(
        "spec_confidence_low",
        "warn",
        "warning",
        `Spec confidence is "community" — not officially verified`,
        { specConfidence: spec.specConfidence, sourceUrl: spec.sourceUrl },
        "Verify spec against official platform documentation",
      ),
    );
  }

  if (spec.lastVerifiedAt) {
    const lastVerified = new Date(spec.lastVerifiedAt);
    const now = new Date();
    const monthsSinceVerified = (now.getFullYear() - lastVerified.getFullYear()) * 12 + (now.getMonth() - lastVerified.getMonth());
    if (monthsSinceVerified > 12) {
      findings.push(
        makeFinding(
          "spec_stale",
          "warn",
          "warning",
          `Spec last verified ${monthsSinceVerified} months ago (${spec.lastVerifiedAt})`,
          { lastVerifiedAt: spec.lastVerifiedAt, monthsSinceVerified },
          "Re-verify spec against current platform requirements",
        ),
      );
    }
  }

  return findings;
}

export function runCloudinaryQualityChecks(
  asset: CloudinaryAssetMetadata,
): QAFinding[] {
  const findings: QAFinding[] = [];

  if (asset.qualityAnalysis?.focus !== undefined) {
    const focus = asset.qualityAnalysis.focus;
    if (focus < 0.3) {
      findings.push(
        makeFinding(
          "quality_focus_low",
          "warn",
          "warning",
          `Focus score ${focus.toFixed(2)} is low (threshold 0.3)`,
          { focusScore: focus },
          "Consider re-shooting for better focus",
        ),
      );
    } else if (focus < 0.5) {
      findings.push(
        makeFinding(
          "quality_focus_low",
          "warn",
          "info",
          `Focus score ${focus.toFixed(2)} is moderate (threshold 0.5)`,
          { focusScore: focus },
          "Review image sharpness manually",
        ),
      );
    } else {
      findings.push(
        makeFinding(
          "quality_focus_ok",
          "pass",
          "info",
          `Focus score ${focus.toFixed(2)} is good`,
          { focusScore: focus },
        ),
      );
    }
  } else {
    findings.push(
      makeFinding(
        "quality_focus_unknown",
        "unknown",
        "info",
        "Cloudinary quality analysis not available for this asset",
        {},
        "Enable quality_analysis on upload or run Analyze API",
      ),
    );
  }

  if (asset.accessibilityAnalysis?.colorblindAccessibilityScore !== undefined) {
    const score = asset.accessibilityAnalysis.colorblindAccessibilityScore;
    if (score < 0.5) {
      findings.push(
        makeFinding(
          "accessibility_low",
          "warn",
          "warning",
          `Colorblind accessibility score ${score.toFixed(2)} is low`,
          { accessibilityScore: score, analysis: asset.accessibilityAnalysis.colorblindAccessibilityAnalysis },
          "Review color contrast for accessibility",
        ),
      );
    } else {
      findings.push(
        makeFinding(
          "accessibility_ok",
          "pass",
          "info",
          `Colorblind accessibility score ${score.toFixed(2)} is acceptable`,
          { accessibilityScore: score },
        ),
      );
    }
  } else {
    findings.push(
      makeFinding(
        "accessibility_unknown",
        "unknown",
        "info",
        "Cloudinary accessibility analysis not available for this asset",
        {},
        "Enable accessibility_analysis on upload or run Analyze API",
      ),
    );
  }

  if (asset.phash) {
    findings.push(
      makeFinding(
        "duplicate_asset",
        "unknown",
        "info",
        `Perceptual hash available for duplicate detection: ${asset.phash}`,
        { phash: asset.phash },
        "Run duplicate check against existing approved assets",
      ),
    );
  }

  return findings;
}

export function computeChannelResult(
  channel: string,
  spec: ChannelSpecFull,
  findings: QAFinding[],
): QAChannelResult {
  const statuses = findings.map((f) => f.status);
  let overallStatus: QAFindingStatus = "pass";
  if (statuses.includes("fail")) overallStatus = "fail";
  else if (statuses.includes("warn")) overallStatus = "warn";
  else if (statuses.every((s) => s === "unknown")) overallStatus = "unknown";

  const passCount = findings.filter((f) => f.status === "pass").length;
  const warnCount = findings.filter((f) => f.status === "warn").length;
  const failCount = findings.filter((f) => f.status === "fail").length;
  const totalScored = passCount + warnCount + failCount;
  const score = totalScored > 0 ? Math.round((passCount + warnCount * 0.5) / totalScored * 100) : 0;

  return {
    channel,
    platform: spec.platformSlug,
    imageType: spec.imageTypeSlug,
    specConfidence: spec.specConfidence,
    sourceUrl: spec.sourceUrl,
    lastVerifiedAt: spec.lastVerifiedAt,
    findings,
    overallStatus,
    score,
  };
}