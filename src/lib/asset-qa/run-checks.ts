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
  options: { skipResolutionCheck?: boolean } = {},
): QAFinding[] {
  const findings: QAFinding[] = [];

  // Aspect ratio check
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

  // Resolution check: canonical dimensions are authoritative only when they
  // describe the same geometry as the saved Shoot requirement.
  if (!options.skipResolutionCheck && spec.widthPx && spec.heightPx) {
    const effectiveMinWidth = spec.minWidthPx ?? spec.widthPx;
    const effectiveMinHeight = spec.minHeightPx ?? spec.heightPx;
    const effectiveMaxWidth = spec.maxWidthPx ?? null;
    const effectiveMaxHeight = spec.maxHeightPx ?? null;

    const meetsMinWidth = asset.width >= effectiveMinWidth;
    const meetsMinHeight = asset.height >= effectiveMinHeight;
    const meetsMaxWidth = effectiveMaxWidth === null || asset.width <= effectiveMaxWidth;
    const meetsMaxHeight = effectiveMaxHeight === null || asset.height <= effectiveMaxHeight;

    const resolutionOk = meetsMinWidth && meetsMinHeight && meetsMaxWidth && meetsMaxHeight;

    findings.push(
      makeFinding(
        resolutionOk ? "resolution_sufficient" : "resolution_insufficient",
        resolutionOk ? "pass" : "fail",
        resolutionOk ? "info" : "error",
        resolutionOk
          ? `Resolution ${asset.width}×${asset.height} meets spec requirements (min: ${effectiveMinWidth}×${effectiveMinHeight})`
          : `Resolution ${asset.width}×${asset.height} does not meet spec (min: ${effectiveMinWidth}×${effectiveMinHeight}${effectiveMaxWidth ? `, max: ${effectiveMaxWidth}×${effectiveMaxHeight}` : ""})`,
        {
          assetWidth: asset.width,
          assetHeight: asset.height,
          specMinWidth: effectiveMinWidth,
          specMinHeight: effectiveMinHeight,
          specMaxWidth: effectiveMaxWidth,
          specMaxHeight: effectiveMaxHeight,
        },
        resolutionOk ? undefined : "Re-shoot at higher resolution or check spec limits",
      ),
    );
  }

  // Format check
  const assetFormatUpper = asset.format.toUpperCase();
  if (!spec.acceptedFormats || spec.acceptedFormats.length === 0) {
    findings.push(
      makeFinding(
        "spec_missing",
        "unknown",
        "warning",
        `Channel "${channel}" spec missing accepted formats`,
        { acceptedFormats: spec.acceptedFormats },
        "Add accepted formats to channel spec in Supabase",
      ),
    );
  } else {
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
  }

  // File size check
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

  // Background requirement
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

  // Product fill requirement
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

  // Safe zone check: treat right/bottom as margins (insets from edges)
  const hasSafeZones =
    spec.safeZoneTopPx !== null ||
    spec.safeZoneBottomPx !== null ||
    spec.safeZoneLeftPx !== null ||
    spec.safeZoneRightPx !== null;

  if (hasSafeZones) {
    if (asset.coordinates && Object.keys(asset.coordinates).length > 0) {
      // Try to find subject/text bounds in coordinates
      let subjectBounds: { x: number; y: number; w: number; h: number } | null = null;
      for (const [, value] of Object.entries(asset.coordinates)) {
        if (value && typeof value === "object" && "x" in value && "y" in value && "w" in value && "h" in value) {
          const v = value as { x: string | number; y: string | number; w: string | number; h: string | number };
          subjectBounds = {
            x: Number(v.x),
            y: Number(v.y),
            w: Number(v.w),
            h: Number(v.h),
          };
          break;
        }
      }

      if (subjectBounds) {
        const { x, y, w, h } = subjectBounds;
        // Check for NaN values from invalid coordinate strings
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
          findings.push(
            makeFinding(
              "safe_zone_unknown",
              "unknown",
              "warning",
              "Safe zones defined but coordinate values are invalid",
              { safeZones: { top: spec.safeZoneTopPx, bottom: spec.safeZoneBottomPx, left: spec.safeZoneLeftPx, right: spec.safeZoneRightPx } },
              "Manual review required: verify subject/text within safe zones",
            ),
          );
        } else {
          const subjectLeft = x;
          const subjectRight = x + w;
          const subjectTop = y;
          const subjectBottom = y + h;

          // Compute safe zone boundaries: top/left are absolute, right/bottom are margins from edges
          const safeLeft = spec.safeZoneLeftPx ?? 0;
          const safeRight = spec.safeZoneRightPx !== null ? asset.width - spec.safeZoneRightPx : asset.width;
          const safeTop = spec.safeZoneTopPx ?? 0;
          const safeBottom = spec.safeZoneBottomPx !== null ? asset.height - spec.safeZoneBottomPx : asset.height;

          let safeZoneViolation = false;
          const violations: string[] = [];

          if (subjectLeft < safeLeft) {
            safeZoneViolation = true;
            violations.push(`left edge ${subjectLeft} < safe zone left ${safeLeft}`);
          }
          if (subjectRight > safeRight) {
            safeZoneViolation = true;
            violations.push(`right edge ${subjectRight} > safe zone right ${safeRight}`);
          }
          if (subjectTop < safeTop) {
            safeZoneViolation = true;
            violations.push(`top edge ${subjectTop} < safe zone top ${safeTop}`);
          }
          if (subjectBottom > safeBottom) {
            safeZoneViolation = true;
            violations.push(`bottom edge ${subjectBottom} > safe zone bottom ${safeBottom}`);
          }

          if (safeZoneViolation) {
            findings.push(
              makeFinding(
                "safe_zone_violation",
                "fail",
                "error",
                `Subject extends outside safe zone: ${violations.join("; ")}`,
                { subjectBounds, safeZones: { top: safeTop, bottom: safeBottom, left: safeLeft, right: safeRight }, violations },
                "Re-shoot or crop to keep subject within safe zones",
              ),
            );
          } else {
            findings.push(
              makeFinding(
                "safe_zone_ok",
                "pass",
                "info",
                "Subject within safe zone boundaries",
                { subjectBounds, safeZones: { top: safeTop, bottom: safeBottom, left: safeLeft, right: safeRight } },
              ),
            );
          }
        }
      } else {
        findings.push(
          makeFinding(
            "safe_zone_unknown",
            "unknown",
            "warning",
            "Safe zones defined but no recognizable subject/text bounds in coordinates",
            { safeZones: { top: spec.safeZoneTopPx, bottom: spec.safeZoneBottomPx, left: spec.safeZoneLeftPx, right: spec.safeZoneRightPx } },
            "Manual review required: verify subject/text within safe zones",
          ),
        );
      }
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

  // Spec provenance checks
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
  } else if (spec.specConfidence === "estimated" || spec.specConfidence === null) {
    findings.push(
      makeFinding(
        "spec_confidence_low",
        "warn",
        "warning",
        `Spec confidence is "${spec.specConfidence ?? "missing"}" — not officially verified`,
        { specConfidence: spec.specConfidence, sourceUrl: spec.sourceUrl },
        "Verify spec against official platform documentation",
      ),
    );
  }

  if (!spec.sourceUrl) {
    findings.push(
      makeFinding(
        "spec_missing",
        "unknown",
        "warning",
        `Channel "${channel}" spec missing source URL`,
        { sourceUrl: spec.sourceUrl },
        "Add source URL to channel spec in Supabase",
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
  } else {
    findings.push(
      makeFinding(
        "spec_missing",
        "unknown",
        "warning",
        `Channel "${channel}" spec missing verification timestamp`,
        { lastVerifiedAt: spec.lastVerifiedAt },
        "Add last_verified_at to channel spec in Supabase",
      ),
    );
  }

  return findings;
}

export function runCloudinaryQualityChecks(
  asset: CloudinaryAssetMetadata,
): QAFinding[] {
  const findings: QAFinding[] = [];

  if (asset.qualityAnalysis?.focus !== undefined) {
    const focus = asset.qualityAnalysis.focus;
    findings.push(
      makeFinding(
        "quality_focus_raw",
        "unknown",
        "info",
        `Focus score: ${focus.toFixed(2)} (0-1 scale, higher is sharper)`,
        { focusScore: focus },
        "Enable quality_analysis on upload or run Analyze API",
      ),
    );
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
    findings.push(
      makeFinding(
        "accessibility_raw",
        "unknown",
        "info",
        `Colorblind accessibility score: ${score.toFixed(2)} (0-1 scale)`,
        { accessibilityScore: score, analysis: asset.accessibilityAnalysis.colorblindAccessibilityAnalysis },
        "Enable accessibility_analysis on upload or run Analyze API",
      ),
    );
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
  // Separate required (deterministic) findings from advisory (provider) findings
  const requiredFindings = findings.filter((f) => !f.isAdvisory);
  const advisoryFindings = findings.filter((f) => f.isAdvisory);

  const requiredStatuses = requiredFindings.map((f) => f.status);
  let overallStatus: QAFindingStatus = "pass";
  if (requiredStatuses.includes("fail")) overallStatus = "fail";
  else if (requiredStatuses.includes("warn")) overallStatus = "warn";
  else if (requiredStatuses.includes("unknown")) overallStatus = "unknown";
  else if (requiredStatuses.every((s) => s === "pass")) overallStatus = "pass";

  // Score only based on required findings; advisory findings don't affect score
  const passCount = requiredFindings.filter((f) => f.status === "pass").length;
  const warnCount = requiredFindings.filter((f) => f.status === "warn").length;
  const failCount = requiredFindings.filter((f) => f.status === "fail").length;
  const totalScored = passCount + warnCount + failCount;
  const score = totalScored > 0 ? Math.round((passCount + warnCount * 0.5) / totalScored * 100) : null;

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