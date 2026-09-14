export type QAFindingStatus = "pass" | "warn" | "fail" | "unknown";

export type QAFindingSeverity = "info" | "warning" | "error";

export interface QAFinding {
  code: string;
  status: QAFindingStatus;
  severity: QAFindingSeverity;
  message: string;
  evidence?: Record<string, unknown>;
  recommendedAction?: string;
}

export interface QAChannelResult {
  channel: string;
  platform: string;
  imageType: string;
  specConfidence: "official" | "community" | "estimated" | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  findings: QAFinding[];
  overallStatus: QAFindingStatus;
  score: number | null;
}

export interface QAAssetResult {
  assetId: string;
  cloudinaryAssetId: string | null;
  version: number;
  width: number;
  height: number;
  format: string;
  bytes: number;
  aspectRatio: string;
  channels: QAChannelResult[];
  overallStatus: QAFindingStatus;
  overallScore: number | null;
  checkedAt: string;
  checkerVersion: string;
}

export interface ChannelSpecFull {
  platformId: string;
  platformSlug: string;
  platformName: string;
  imageTypeId: string;
  imageTypeSlug: string;
  imageTypeName: string;
  widthPx: number;
  heightPx: number;
  minWidthPx: number | null;
  minHeightPx: number | null;
  maxWidthPx: number | null;
  maxHeightPx: number | null;
  aspectRatioW: number | null;
  aspectRatioH: number | null;
  aspectRatioLabel: string | null;
  acceptedFormats: string[] | null;
  maxFileSizeMb: number | null;
  recommendedColorMode: string | null;
  safeZoneTopPx: number | null;
  safeZoneBottomPx: number | null;
  safeZoneLeftPx: number | null;
  safeZoneRightPx: number | null;
  backgroundRequired: string | null;
  productFillMinPct: number | null;
  specConfidence: "official" | "community" | "estimated" | null;
  organic: boolean;
  paid: boolean;
  shoppingSupport: boolean;
  mobileNotes: string | null;
  desktopNotes: string | null;
  cropNotes: string | null;
  bestUseCases: string[] | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

export interface CloudinaryAssetMetadata {
  assetId: string;
  publicId: string;
  version: number;
  width: number;
  height: number;
  format: string;
  bytes: number;
  resourceType: string;
  deliveryType: string;
  qualityAnalysis?: {
    focus?: number;
  };
  accessibilityAnalysis?: {
    colorblindAccessibilityScore?: number;
    colorblindAccessibilityAnalysis?: {
      distinctEdges?: number;
      distinctColors?: number;
      mostIndistinctPair?: string[];
    };
  };
  phash?: string;
  colors?: string[][];
  predominant?: {
    google?: string[][];
    cloudinary?: string[][];
  };
  faces?: number[][];
  coordinates?: Record<string, unknown>;
  mediaMetadata?: Record<string, unknown>;
  illustrationScore?: number;
  semiTransparent?: boolean;
  grayscale?: boolean;
}

export interface ShootDeliverableRequirement {
  channel: string;
  aspectRatio?: string;
  acceptedFormats?: string[];
  requiredWidth?: number;
  requiredHeight?: number;
  maxFileSizeMb?: number;
  backgroundRequired?: string;
  productFillMinPct?: number;
  safeZoneTopPx?: number;
  safeZoneBottomPx?: number;
  safeZoneLeftPx?: number;
  safeZoneRightPx?: number;
}

export const QA_CHECKER_VERSION = "1.0.0";

export type QAFindingCode =
  | "aspect_ratio_mismatch"
  | "aspect_ratio_valid"
  | "resolution_insufficient"
  | "resolution_sufficient"
  | "format_unsupported"
  | "format_supported"
  | "file_size_exceeds_limit"
  | "file_size_within_limit"
  | "background_mismatch"
  | "background_matches"
  | "product_fill_insufficient"
  | "product_fill_sufficient"
  | "safe_zone_violation"
  | "safe_zone_ok"
  | "safe_zone_unknown"
  | "quality_focus_low"
  | "quality_focus_ok"
  | "quality_focus_unknown"
  | "quality_focus_raw"
  | "accessibility_low"
  | "accessibility_ok"
  | "accessibility_unknown"
  | "accessibility_raw"
  | "duplicate_asset"
  | "missing_metadata"
  | "transform_unavailable"
  | "transform_available"
  | "spec_missing"
  | "spec_stale"
  | "spec_confidence_low"
  | "provider_enrichment_unavailable";

export const QA_FINDING_CODES = {
  ASPECT_RATIO_MISMATCH: "aspect_ratio_mismatch" as QAFindingCode,
  ASPECT_RATIO_VALID: "aspect_ratio_valid" as QAFindingCode,
  RESOLUTION_INSUFFICIENT: "resolution_insufficient" as QAFindingCode,
  RESOLUTION_SUFFICIENT: "resolution_sufficient" as QAFindingCode,
  FORMAT_UNSUPPORTED: "format_unsupported" as QAFindingCode,
  FORMAT_SUPPORTED: "format_supported" as QAFindingCode,
  FILE_SIZE_EXCEEDS_LIMIT: "file_size_exceeds_limit" as QAFindingCode,
  FILE_SIZE_WITHIN_LIMIT: "file_size_within_limit" as QAFindingCode,
  BACKGROUND_MISMATCH: "background_mismatch" as QAFindingCode,
  BACKGROUND_MATCHES: "background_matches" as QAFindingCode,
  PRODUCT_FILL_INSUFFICIENT: "product_fill_insufficient" as QAFindingCode,
  PRODUCT_FILL_SUFFICIENT: "product_fill_sufficient" as QAFindingCode,
  SAFE_ZONE_VIOLATION: "safe_zone_violation" as QAFindingCode,
  SAFE_ZONE_OK: "safe_zone_ok" as QAFindingCode,
  SAFE_ZONE_UNKNOWN: "safe_zone_unknown" as QAFindingCode,
  QUALITY_FOCUS_LOW: "quality_focus_low" as QAFindingCode,
  QUALITY_FOCUS_OK: "quality_focus_ok" as QAFindingCode,
  QUALITY_FOCUS_UNKNOWN: "quality_focus_unknown" as QAFindingCode,
  QUALITY_FOCUS_RAW: "quality_focus_raw" as QAFindingCode,
  ACCESSIBILITY_LOW: "accessibility_low" as QAFindingCode,
  ACCESSIBILITY_OK: "accessibility_ok" as QAFindingCode,
  ACCESSIBILITY_UNKNOWN: "accessibility_unknown" as QAFindingCode,
  ACCESSIBILITY_RAW: "accessibility_raw" as QAFindingCode,
  DUPLICATE_ASSET: "duplicate_asset" as QAFindingCode,
  MISSING_METADATA: "missing_metadata" as QAFindingCode,
  TRANSFORM_UNAVAILABLE: "transform_unavailable" as QAFindingCode,
  TRANSFORM_AVAILABLE: "transform_available" as QAFindingCode,
  SPEC_MISSING: "spec_missing" as QAFindingCode,
  SPEC_STALE: "spec_stale" as QAFindingCode,
  SPEC_CONFIDENCE_LOW: "spec_confidence_low" as QAFindingCode,
  PROVIDER_ENRICHMENT_UNAVAILABLE: "provider_enrichment_unavailable" as QAFindingCode,
} as const;