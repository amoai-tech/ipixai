import { describe, it, expect } from "vitest";
import { runDeterministicChecks } from "../run-checks";
import { runCloudinaryQualityChecks } from "../run-checks";
import { computeChannelResult } from "../run-checks";
import type { CloudinaryAssetMetadata, ChannelSpecFull } from "../types";

const mockAsset: CloudinaryAssetMetadata = {
  assetId: "test-asset-id",
  publicId: "test/public/id",
  version: 1234567890,
  width: 1080,
  height: 1350,
  format: "jpg",
  bytes: 1024 * 1024 * 2,
  resourceType: "image",
  deliveryType: "authenticated",
  qualityAnalysis: { focus: 0.8 },
  accessibilityAnalysis: {
    colorblindAccessibilityScore: 0.9,
    colorblindAccessibilityAnalysis: { distinctEdges: 0.9, distinctColors: 0.95 },
  },
  phash: "abc123",
  colors: [["#FF0000", "50"], ["#00FF00", "50"]],
  predominant: { google: [["red", "50"]], cloudinary: [["red", "50"]] },
  faces: [[100, 100, 50, 50]],
  coordinates: { subject: { x: "500", y: "600", w: "200", h: "300" } },
  mediaMetadata: {},
  illustrationScore: 0.1,
  semiTransparent: false,
  grayscale: false,
};

const mockSpec: ChannelSpecFull = {
  platformId: "instagram-id",
  platformSlug: "instagram",
  platformName: "Instagram",
  imageTypeId: "feed-post-id",
  imageTypeSlug: "feed_post",
  imageTypeName: "Feed Post",
  widthPx: 1080,
  heightPx: 1350,
  minWidthPx: 1080,
  minHeightPx: 1350,
  maxWidthPx: null,
  maxHeightPx: null,
  aspectRatioW: 4,
  aspectRatioH: 5,
  aspectRatioLabel: "4:5",
  acceptedFormats: ["JPG", "PNG", "BMP"],
  maxFileSizeMb: 8,
  recommendedColorMode: null,
  safeZoneTopPx: null,
  safeZoneBottomPx: null,
  safeZoneLeftPx: null,
  safeZoneRightPx: null,
  backgroundRequired: null,
  productFillMinPct: null,
  specConfidence: "official",
  organic: true,
  paid: false,
  shoppingSupport: false,
  mobileNotes: null,
  desktopNotes: null,
  cropNotes: "§2.3",
  bestUseCases: null,
  sourceUrl: "https://example.com/spec",
  lastVerifiedAt: "2026-06-26T05:21:09.04852Z",
};

describe("runDeterministicChecks", () => {
  it("passes aspect ratio check when asset matches spec", () => {
    const findings = runDeterministicChecks(mockAsset, mockSpec, "instagram_feed");
    const aspectFinding = findings.find((f) => f.code === "aspect_ratio_valid");
    expect(aspectFinding).toBeDefined();
    expect(aspectFinding?.status).toBe("pass");
  });

  it("fails aspect ratio check when asset does not match spec", () => {
    const asset = { ...mockAsset, width: 1080, height: 1080 };
    const findings = runDeterministicChecks(asset, mockSpec, "instagram_feed");
    const aspectFinding = findings.find((f) => f.code === "aspect_ratio_mismatch");
    expect(aspectFinding).toBeDefined();
    expect(aspectFinding?.status).toBe("fail");
  });

  it("passes resolution check when asset meets min dimensions", () => {
    const findings = runDeterministicChecks(mockAsset, mockSpec, "instagram_feed");
    const resolutionFinding = findings.find((f) => f.code === "resolution_sufficient");
    expect(resolutionFinding).toBeDefined();
    expect(resolutionFinding?.status).toBe("pass");
  });

  it("fails resolution check when asset below min dimensions", () => {
    const asset = { ...mockAsset, width: 500, height: 500 };
    const findings = runDeterministicChecks(asset, mockSpec, "instagram_feed");
    const resolutionFinding = findings.find((f) => f.code === "resolution_insufficient");
    expect(resolutionFinding).toBeDefined();
    expect(resolutionFinding?.status).toBe("fail");
  });

  it("passes format check when asset format is accepted", () => {
    const findings = runDeterministicChecks(mockAsset, mockSpec, "instagram_feed");
    const formatFinding = findings.find((f) => f.code === "format_supported");
    expect(formatFinding).toBeDefined();
    expect(formatFinding?.status).toBe("pass");
  });

  it("fails format check when asset format is not accepted", () => {
    const asset = { ...mockAsset, format: "webp" };
    const findings = runDeterministicChecks(asset, mockSpec, "instagram_feed");
    const formatFinding = findings.find((f) => f.code === "format_unsupported");
    expect(formatFinding).toBeDefined();
    expect(formatFinding?.status).toBe("fail");
  });

  it("passes file size check when within limit", () => {
    const findings = runDeterministicChecks(mockAsset, mockSpec, "instagram_feed");
    const sizeFinding = findings.find((f) => f.code === "file_size_within_limit");
    expect(sizeFinding).toBeDefined();
    expect(sizeFinding?.status).toBe("pass");
  });

  it("fails file size check when exceeds limit", () => {
    const asset = { ...mockAsset, bytes: 1024 * 1024 * 10 };
    const findings = runDeterministicChecks(asset, mockSpec, "instagram_feed");
    const sizeFinding = findings.find((f) => f.code === "file_size_exceeds_limit");
    expect(sizeFinding).toBeDefined();
    expect(sizeFinding?.status).toBe("fail");
  });

  it("returns unknown for background requirement when specified", () => {
    const spec = { ...mockSpec, backgroundRequired: "pure_white" };
    const findings = runDeterministicChecks(mockAsset, spec, "amazon_product");
    const bgFinding = findings.find((f) => f.code === "background_mismatch");
    expect(bgFinding).toBeDefined();
    expect(bgFinding?.status).toBe("unknown");
  });

  it("returns unknown for product fill when specified", () => {
    const spec = { ...mockSpec, productFillMinPct: 85 };
    const findings = runDeterministicChecks(mockAsset, spec, "amazon_product");
    const fillFinding = findings.find((f) => f.code === "product_fill_insufficient");
    expect(fillFinding).toBeDefined();
    expect(fillFinding?.status).toBe("unknown");
  });

  it("returns unknown for safe zones when no coordinates", () => {
    const spec = { ...mockSpec, safeZoneTopPx: 100, safeZoneBottomPx: 100 };
    const asset = { ...mockAsset, coordinates: {} };
    const findings = runDeterministicChecks(asset, spec, "instagram_story");
    const safeZoneFinding = findings.find((f) => f.code === "safe_zone_unknown");
    expect(safeZoneFinding).toBeDefined();
    expect(safeZoneFinding?.status).toBe("unknown");
  });

  it("warns when spec confidence is community", () => {
    const spec = { ...mockSpec, specConfidence: "community" as const };
    const findings = runDeterministicChecks(mockAsset, spec, "tiktok_video_cover");
    const confidenceFinding = findings.find((f) => f.code === "spec_confidence_low");
    expect(confidenceFinding).toBeDefined();
    expect(confidenceFinding?.status).toBe("warn");
  });

  it("warns when spec is stale (>12 months)", () => {
    const spec = { ...mockSpec, lastVerifiedAt: "2024-01-01T00:00:00.000Z" };
    const findings = runDeterministicChecks(mockAsset, spec, "instagram_feed");
    const staleFinding = findings.find((f) => f.code === "spec_stale");
    expect(staleFinding).toBeDefined();
    expect(staleFinding?.status).toBe("warn");
  });
});

describe("runCloudinaryQualityChecks", () => {
  it("passes focus check when score is high", () => {
    const asset = { ...mockAsset, qualityAnalysis: { focus: 0.8 } };
    const findings = runCloudinaryQualityChecks(asset);
    const focusFinding = findings.find((f) => f.code === "quality_focus_ok");
    expect(focusFinding).toBeDefined();
    expect(focusFinding?.status).toBe("pass");
  });

  it("warns when focus score is low", () => {
    const asset = { ...mockAsset, qualityAnalysis: { focus: 0.2 } };
    const findings = runCloudinaryQualityChecks(asset);
    const focusFinding = findings.find((f) => f.code === "quality_focus_low");
    expect(focusFinding).toBeDefined();
    expect(focusFinding?.status).toBe("warn");
  });

  it("warns when focus score is moderate", () => {
    const asset = { ...mockAsset, qualityAnalysis: { focus: 0.4 } };
    const findings = runCloudinaryQualityChecks(asset);
    const focusFinding = findings.find((f) => f.code === "quality_focus_low");
    expect(focusFinding).toBeDefined();
    expect(focusFinding?.status).toBe("warn");
    expect(focusFinding?.severity).toBe("info");
  });

  it("returns unknown when quality analysis not available", () => {
    const asset = { ...mockAsset, qualityAnalysis: undefined };
    const findings = runCloudinaryQualityChecks(asset);
    const focusFinding = findings.find((f) => f.code === "quality_focus_unknown");
    expect(focusFinding).toBeDefined();
    expect(focusFinding?.status).toBe("unknown");
  });

  it("passes accessibility check when score is high", () => {
    const asset = { ...mockAsset, accessibilityAnalysis: { colorblindAccessibilityScore: 0.9 } };
    const findings = runCloudinaryQualityChecks(asset);
    const a11yFinding = findings.find((f) => f.code === "accessibility_ok");
    expect(a11yFinding).toBeDefined();
    expect(a11yFinding?.status).toBe("pass");
  });

  it("warns when accessibility score is low", () => {
    const asset = { ...mockAsset, accessibilityAnalysis: { colorblindAccessibilityScore: 0.3 } };
    const findings = runCloudinaryQualityChecks(asset);
    const a11yFinding = findings.find((f) => f.code === "accessibility_low");
    expect(a11yFinding).toBeDefined();
    expect(a11yFinding?.status).toBe("warn");
  });

  it("returns unknown when accessibility analysis not available", () => {
    const asset = { ...mockAsset, accessibilityAnalysis: undefined };
    const findings = runCloudinaryQualityChecks(asset);
    const a11yFinding = findings.find((f) => f.code === "accessibility_unknown");
    expect(a11yFinding).toBeDefined();
    expect(a11yFinding?.status).toBe("unknown");
  });

  it("returns duplicate asset info when phash available", () => {
    const findings = runCloudinaryQualityChecks(mockAsset);
    const dupFinding = findings.find((f) => f.code === "duplicate_asset");
    expect(dupFinding).toBeDefined();
    expect(dupFinding?.status).toBe("unknown");
  });
});

describe("computeChannelResult", () => {
  it("computes overall pass when all findings pass", () => {
    const findings = [
      { code: "aspect_ratio_valid", status: "pass" as const, severity: "info" as const, message: "OK" },
      { code: "resolution_sufficient", status: "pass" as const, severity: "info" as const, message: "OK" },
    ];
    const result = computeChannelResult("instagram_feed", mockSpec, findings);
    expect(result.overallStatus).toBe("pass");
    expect(result.score).toBe(100);
  });

  it("computes overall fail when any finding fails", () => {
    const findings = [
      { code: "aspect_ratio_valid", status: "pass" as const, severity: "info" as const, message: "OK" },
      { code: "format_unsupported", status: "fail" as const, severity: "error" as const, message: "Bad" },
    ];
    const result = computeChannelResult("instagram_feed", mockSpec, findings);
    expect(result.overallStatus).toBe("fail");
  });

  it("computes overall warn when any finding warns", () => {
    const findings = [
      { code: "aspect_ratio_valid", status: "pass" as const, severity: "info" as const, message: "OK" },
      { code: "quality_focus_low", status: "warn" as const, severity: "warning" as const, message: "Low" },
    ];
    const result = computeChannelResult("instagram_feed", mockSpec, findings);
    expect(result.overallStatus).toBe("warn");
  });

  it("computes overall unknown when all findings unknown", () => {
    const findings = [
      { code: "spec_missing", status: "unknown" as const, severity: "warning" as const, message: "Missing" },
      { code: "quality_focus_unknown", status: "unknown" as const, severity: "info" as const, message: "Unknown" },
    ];
    const result = computeChannelResult("instagram_feed", mockSpec, findings);
    expect(result.overallStatus).toBe("unknown");
    expect(result.score).toBe(0);
  });

  it("includes spec provenance in result", () => {
    const findings = [{ code: "aspect_ratio_valid", status: "pass" as const, severity: "info" as const, message: "OK" }];
    const result = computeChannelResult("instagram_feed", mockSpec, findings);
    expect(result.specConfidence).toBe("official");
    expect(result.sourceUrl).toBe("https://example.com/spec");
    expect(result.lastVerifiedAt).toBe("2026-06-26T05:21:09.04852Z");
  });
});