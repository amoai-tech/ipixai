import "server-only";

import { cloudinary } from "@/lib/cloudinary/config";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadChannelSpecsForQA, getShootDeliverableRequirements } from "./load-channel-specs";
import { runDeterministicChecks, runCloudinaryQualityChecks, computeChannelResult } from "./run-checks";
import type {
  QAAssetResult,
  QAChannelResult,
  CloudinaryAssetMetadata,
  ChannelSpecFull,
  ShootDeliverableRequirement,
} from "./types";

type AssetRow = {
  id: string;
  v2_shoot_id: string | null;
  brand_id: string | null;
  cloudinary_public_id: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  file_size: number | null;
  mime_type: string | null;
  metadata: Record<string, unknown>;
};

type ShootRow = {
  id: string;
  target_channels: string[] | null;
  deliverable_aspect_ratio: string | null;
  deliverable_format: string | null;
  brand_id: string | null;
};

type CloudinaryMirrorRow = {
  public_id: string;
  version: number | string | null;
  delivery_type: string | null;
  resource_type: string | null;
  format: string | null;
  cloudinary_asset_id: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
};

type BrandRow = {
  org_id: string;
};

export type QAServiceInput = {
  assetId: string;
  orgId: string;
  // shootId and channels are NOT accepted from caller - they are derived from asset/shoot
};

export type QAServiceResult =
  | { ok: true; result: QAAssetResult }
  | { ok: false; reason: string; status: number };

async function getAssetAndShoot(input: QAServiceInput): Promise<{
  asset: AssetRow | null;
  shoot: ShootRow | null;
  cloudinaryMirror: CloudinaryMirrorRow | null;
} | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, v2_shoot_id, brand_id, cloudinary_public_id, width, height, format, file_size, mime_type, metadata")
    .eq("id", input.assetId)
    .maybeSingle();

  if (assetError || !asset) return null;

  const typedAsset = asset as unknown as AssetRow;

  // MANDATORY: Asset must have brand_id and brand must belong to input org
  if (!typedAsset.brand_id) {
    return { ok: false, reason: "asset_missing_brand", status: 403 } as any;
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("org_id")
    .eq("id", typedAsset.brand_id)
    .maybeSingle();

  if (!brand?.org_id || brand.org_id !== input.orgId) {
    return { ok: false, reason: "foreign_org", status: 403 } as any;
  }

  // MANDATORY: Use asset's v2_shoot_id as the authoritative shoot
  // Caller-provided shootId is IGNORED - we only use the asset's canonical shoot
  if (!typedAsset.v2_shoot_id) {
    return { ok: false, reason: "asset_not_linked_to_shoot", status: 409 } as any;
  }

  const { data: shootData } = await supabase
    .from("shoots")
    .select("id, target_channels, deliverable_aspect_ratio, deliverable_format, brand_id")
    .eq("id", typedAsset.v2_shoot_id)
    .maybeSingle();

  if (!shootData) {
    return { ok: false, reason: "shoot_not_found", status: 409 } as any;
  }

  // Verify shoot belongs to same org
  const typedShootData = shootData as unknown as { brand_id: string | null };
  if (!typedShootData.brand_id) {
    return { ok: false, reason: "shoot_missing_brand", status: 409 } as any;
  }

  const { data: shootBrand } = await supabase
    .from("brands")
    .select("org_id")
    .eq("id", typedShootData.brand_id)
    .maybeSingle();

  if (!shootBrand?.org_id || shootBrand.org_id !== input.orgId) {
    return { ok: false, reason: "foreign_org", status: 403 } as any;
  }

  const shoot = shootData as unknown as ShootRow;

  const { data: mirror } = await supabase
    .from("cloudinary_assets")
    .select("public_id, version, delivery_type, resource_type, format, cloudinary_asset_id, width, height, bytes")
    .eq("asset_id", input.assetId)
    .maybeSingle();

  return { asset: typedAsset, shoot, cloudinaryMirror: mirror as CloudinaryMirrorRow | null };
}

async function getCloudinaryAssetMetadata(
  cloudinaryAssetId: string,
  publicId: string,
  version: number,
): Promise<CloudinaryAssetMetadata | null> {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: "image",
      type: "authenticated",
      version,
      colors: true,
      faces: true,
      phash: true,
      quality_analysis: true,
      accessibility_analysis: true,
      coordinates: true,
      media_metadata: true,
      max_results: 10,
    });

    // CRITICAL: Verify Cloudinary returned the exact expected asset_id and version
    if (result.asset_id !== cloudinaryAssetId) {
      console.warn(`[asset-qa] Asset ID mismatch: expected ${cloudinaryAssetId}, got ${result.asset_id}`);
      return null;
    }
    if (result.version !== version) {
      console.warn(`[asset-qa] Version drift: expected ${version}, got ${result.version}`);
      return null;
    }

    return {
      assetId: result.asset_id,
      publicId: result.public_id,
      version: result.version,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      resourceType: result.resource_type,
      deliveryType: result.type,
      qualityAnalysis: result.quality_analysis ? { focus: result.quality_analysis.focus } : undefined,
      accessibilityAnalysis: result.accessibility_analysis
        ? {
            colorblindAccessibilityScore: result.accessibility_analysis.colorblind_accessibility_score,
            colorblindAccessibilityAnalysis: result.accessibility_analysis.colorblind_accessibility_analysis,
          }
        : undefined,
      phash: result.phash,
      colors: result.colors,
      predominant: result.predominant,
      faces: result.faces,
      coordinates: result.coordinates,
      mediaMetadata: result.media_metadata,
      illustrationScore: result.illustration_score,
      semiTransparent: result.semi_transparent,
      grayscale: result.grayscale,
    };
  } catch (err) {
    console.warn("[asset-qa] Failed to fetch Cloudinary asset metadata:", err);
    return null;
  }
}

function buildCloudinaryAssetMetadataFromMirror(
  mirror: { public_id: string; version: number | string | null; delivery_type: string | null; resource_type: string | null; format: string | null; cloudinary_asset_id: string | null; width: number | null; height: number | null; bytes: number | null },
): CloudinaryAssetMetadata {
  const versionNum = typeof mirror.version === "string" ? Number(mirror.version) : mirror.version ?? 0;
  return {
    assetId: mirror.cloudinary_asset_id ?? "",
    publicId: mirror.public_id,
    version: versionNum,
    width: mirror.width ?? 0,
    height: mirror.height ?? 0,
    format: mirror.format ?? "unknown",
    bytes: mirror.bytes ?? 0,
    resourceType: mirror.resource_type ?? "image",
    deliveryType: mirror.delivery_type ?? "authenticated",
  };
}

function getMissingMirrorFields(mirror: { width: number | null; height: number | null; format: string | null; bytes: number | null }): string[] {
  const missing: string[] = [];
  if (mirror.width === null) missing.push("width");
  if (mirror.height === null) missing.push("height");
  if (mirror.format === null) missing.push("format");
  if (mirror.bytes === null) missing.push("bytes");
  return missing;
}

// Build effective spec by merging saved Shoot deliverable (authoritative) with platform spec (recommendation)
function buildEffectiveSpec(
  spec: ChannelSpecFull,
  deliverableReq: { aspectRatio?: string; format?: string } | undefined,
): ChannelSpecFull {
  if (!deliverableReq) return spec;

  const effectiveSpec = { ...spec };

  // Saved deliverable aspect ratio takes precedence
  if (deliverableReq.aspectRatio) {
    const parts = deliverableReq.aspectRatio.split(":");
    if (parts.length === 2) {
      const w = parseInt(parts[0], 10);
      const h = parseInt(parts[1], 10);
      if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
        effectiveSpec.aspectRatioLabel = deliverableReq.aspectRatio;
        effectiveSpec.aspectRatioW = w;
        effectiveSpec.aspectRatioH = h;
        // Use deliverable dimensions as canonical if platform spec doesn't have explicit min
        if (!effectiveSpec.minWidthPx) effectiveSpec.minWidthPx = w * 100; // scale factor
        if (!effectiveSpec.minHeightPx) effectiveSpec.minHeightPx = h * 100;
      }
    }
  }

  // Saved deliverable format takes precedence
  if (deliverableReq.format) {
    effectiveSpec.acceptedFormats = [deliverableReq.format.toUpperCase()];
  }

  return effectiveSpec;
}

export async function runAssetQA(input: QAServiceInput): Promise<QAServiceResult> {
  const data = await getAssetAndShoot(input);
  if (!data) {
    return { ok: false, reason: "asset_not_found", status: 404 };
  }

  const { asset, shoot, cloudinaryMirror } = data;

  if (!cloudinaryMirror?.public_id) {
    return { ok: false, reason: "missing_cloudinary_mirror", status: 409 };
  }

  if (cloudinaryMirror.resource_type !== "image") {
    return { ok: false, reason: "unsupported_resource_type", status: 409 };
  }

  if (cloudinaryMirror.delivery_type !== "authenticated") {
    return { ok: false, reason: "invalid_delivery_type", status: 409 };
  }

  const version = typeof cloudinaryMirror.version === "string" ? Number(cloudinaryMirror.version) : cloudinaryMirror.version;
  if (!Number.isFinite(version) || !version || version <= 0) {
    return { ok: false, reason: "invalid_cloudinary_version", status: 409 };
  }

  // ONLY use channels from the authoritative shoot - ignore caller-provided channels
  const channelsToCheck = shoot?.target_channels ?? [];
  if (channelsToCheck.length === 0) {
    return { ok: false, reason: "no_channels_to_check", status: 400 };
  }

  const deliverableRequirements = shoot ? getShootDeliverableRequirements(shoot) : new Map();

  const specMap = await loadChannelSpecsForQA(channelsToCheck);

  const cloudinaryMetadata = await getCloudinaryAssetMetadata(
    cloudinaryMirror.cloudinary_asset_id ?? "",
    cloudinaryMirror.public_id,
    version,
  );

  // If Cloudinary metadata unavailable or identity/version mismatch, use mirror metadata
  // but mark as provider-enrichment-unavailable
  const providerEnrichmentUnavailable = !cloudinaryMetadata;
  const assetMetadata = cloudinaryMetadata ?? buildCloudinaryAssetMetadataFromMirror(cloudinaryMirror);

  // Check for missing mirror fields when Cloudinary metadata unavailable
  if (!cloudinaryMetadata) {
    const missingFields = getMissingMirrorFields(cloudinaryMirror);
    if (missingFields.length > 0) {
      (assetMetadata as CloudinaryAssetMetadata & { _missingMirrorFields?: string[] })._missingMirrorFields = missingFields;
    }
  }

  const channelResults: QAChannelResult[] = [];

  for (const channel of channelsToCheck) {
    const spec = specMap.get(channel);
    if (!spec) {
      channelResults.push({
        channel,
        platform: "unknown",
        imageType: "unknown",
        specConfidence: null,
        sourceUrl: null,
        lastVerifiedAt: null,
        findings: [
          {
            code: "spec_missing",
            status: "unknown",
            severity: "warning",
            message: `No spec found for channel "${channel}"`,
            evidence: { channel },
            recommendedAction: "Add channel spec to Supabase or verify channel name",
          },
        ],
        overallStatus: "unknown",
        score: null,
      });
      continue;
    }

    const deliverableReq = deliverableRequirements.get(channel);
    
    // Build effective spec: saved Shoot deliverable is authoritative, platform spec is recommendation
    const effectiveSpec = buildEffectiveSpec(spec, deliverableReq);
    
    let findings = runDeterministicChecks(assetMetadata, effectiveSpec, channel);

    // Add missing_metadata finding if mirror fields were missing
    const missingFields = (assetMetadata as CloudinaryAssetMetadata & { _missingMirrorFields?: string[] })._missingMirrorFields;
    if (missingFields && missingFields.length > 0) {
      findings.push({
        code: "missing_metadata",
        status: "unknown",
        severity: "warning",
        message: `Cloudinary mirror missing required fields: ${missingFields.join(", ")}`,
        evidence: { missingFields },
        recommendedAction: "Re-run Cloudinary webhook sync or re-upload asset",
      });
    }

    // Provider enrichment unavailable finding
    if (providerEnrichmentUnavailable) {
      findings.push({
        code: "provider_enrichment_unavailable",
        status: "unknown",
        severity: "info",
        message: "Cloudinary provider enrichment unavailable; using mirror metadata only",
        evidence: {},
        recommendedAction: "Re-run Cloudinary webhook sync or re-upload asset for full analysis",
      });
    }

    // Cloudinary quality/accessibility findings are ADVISORY ONLY - do not affect readiness score
    const qualityFindings = runCloudinaryQualityChecks(assetMetadata);
    const advisoryFindings = qualityFindings.map(f => ({ ...f, _advisory: true }));
    findings = [...findings, ...advisoryFindings];

    channelResults.push(computeChannelResult(channel, effectiveSpec, findings));
  }

  const allStatuses = channelResults.map((c) => c.overallStatus);
  let overallStatus: QAAssetResult["overallStatus"] = "pass";
  if (allStatuses.includes("fail")) overallStatus = "fail";
  else if (allStatuses.includes("warn")) overallStatus = "warn";
  else if (allStatuses.includes("unknown")) overallStatus = "unknown";
  else if (allStatuses.every((s) => s === "pass")) overallStatus = "pass";

  const scoredChannels = channelResults.filter((c) => c.score !== null);
  const totalScore = scoredChannels.reduce((sum, c) => sum + (c.score ?? 0), 0);
  const overallScore = scoredChannels.length > 0 ? Math.round(totalScore / scoredChannels.length) : null;

  const result: QAAssetResult = {
    assetId: asset!.id,
    cloudinaryAssetId: cloudinaryMirror.cloudinary_asset_id,
    version,
    width: assetMetadata.width,
    height: assetMetadata.height,
    format: assetMetadata.format,
    bytes: assetMetadata.bytes,
    aspectRatio: aspectRatioToString(assetMetadata.width, assetMetadata.height) ?? "unknown",
    channels: channelResults,
    overallStatus,
    overallScore,
    checkedAt: new Date().toISOString(),
    checkerVersion: "1.0.0",
  };

  return { ok: true, result };
}

function aspectRatioToString(w: number, h: number): string | null {
  if (!w || !h) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}