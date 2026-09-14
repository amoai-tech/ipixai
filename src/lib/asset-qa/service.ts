import "server-only";

import { cloudinary } from "@/lib/cloudinary/config";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadChannelSpecsForQA } from "./load-channel-specs";
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

type ShootDeliverableRow = {
  id: string;
  channel: string;
  format: string | null;
  aspect_ratio: string | null;
  origin: string | null;
  quantity: number | null;
  status: string | null;
};

type ShootDetailRpcResult = {
  shoot: {
    id: string;
    target_channels: string[] | null;
    brand_id: string;
  } | null;
  deliverables: ShootDeliverableRow[] | null;
};

type QAContextResult =
  | {
      ok: true;
      asset: AssetRow;
      shootId: string;
      deliverables: ShootDeliverableRequirement[];
      cloudinaryMirror: CloudinaryMirrorRow;
    }
  | {
      ok: false;
      reason: string;
      status: 400 | 403 | 404 | 409 | 500;
    };

export type QAServiceInput = {
  assetId: string;
  orgId: string;
};

export type QAServiceResult =
  | { ok: true; result: QAAssetResult }
  | { ok: false; reason: string; status: number };

async function loadQAContext(input: QAServiceInput): Promise<QAContextResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false, reason: "supabase_unavailable", status: 500 };
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, v2_shoot_id, brand_id, cloudinary_public_id, width, height, format, file_size, mime_type, metadata")
    .eq("id", input.assetId)
    .maybeSingle();

  if (assetError || !asset) {
    return { ok: false, reason: "asset_not_found", status: 404 };
  }

  const typedAsset = asset as unknown as AssetRow;

  if (!typedAsset.brand_id) {
    return { ok: false, reason: "asset_missing_brand", status: 403 };
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("org_id")
    .eq("id", typedAsset.brand_id)
    .maybeSingle();

  if (!brand?.org_id || brand.org_id !== input.orgId) {
    return { ok: false, reason: "foreign_org", status: 403 };
  }

  if (!typedAsset.v2_shoot_id) {
    return { ok: false, reason: "asset_not_linked_to_shoot", status: 409 };
  }

  const { data: shootDetail, error: shootError } = await supabase
    .rpc("get_shoot_detail", { p_shoot_id: typedAsset.v2_shoot_id });

  if (shootError || !shootDetail) {
    return { ok: false, reason: "shoot_not_found", status: 409 };
  }

  const typedShootDetail = shootDetail as ShootDetailRpcResult;
  const shoot = typedShootDetail.shoot;
  if (!shoot) {
    return { ok: false, reason: "shoot_not_found", status: 409 };
  }

  if (shoot.brand_id !== typedAsset.brand_id) {
    return { ok: false, reason: "shoot_brand_mismatch", status: 409 };
  }

  const deliverables = (typedShootDetail.deliverables as ShootDeliverableRow[] | null) ?? [];

  const { data: mirror } = await supabase
    .from("cloudinary_assets")
    .select("public_id, version, delivery_type, resource_type, format, cloudinary_asset_id, width, height, bytes")
    .eq("asset_id", input.assetId)
    .maybeSingle();

  if (!mirror) {
    return { ok: false, reason: "missing_cloudinary_mirror", status: 409 };
  }

  return {
    ok: true,
    asset: typedAsset,
    shootId: shoot.id,
    deliverables: deliverables.map((d) => {
      const normalized = normalizeDeliverableFormat(d.format);
      return {
        channel: d.channel,
        aspectRatio: d.aspect_ratio ?? normalized.aspectRatio,
        acceptedFormats: normalized.acceptedFormats,
        requiredWidth: undefined,
        requiredHeight: undefined,
        maxFileSizeMb: undefined,
        backgroundRequired: undefined,
        productFillMinPct: undefined,
        safeZoneTopPx: undefined,
        safeZoneBottomPx: undefined,
        safeZoneLeftPx: undefined,
        safeZoneRightPx: undefined,
      };
    }),
    cloudinaryMirror: mirror as CloudinaryMirrorRow,
  };
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

export function normalizeDeliverableFormat(format: string | null): { aspectRatio?: string; acceptedFormats?: string[] } {
  if (!format) return {};

  const trimmed = format.trim();
  if (!trimmed) return {};

  const parts = trimmed.split(/\s+/);
  if (parts.length === 0) return {};

  const aspectRatio = parts[0];
  const formatPart = parts.slice(1).join(" ").toUpperCase();

  const ratioParts = aspectRatio.split(":");
  if (ratioParts.length !== 2) {
    // No valid aspect ratio in the first part; treat entire string as format
    return { acceptedFormats: trimmed ? [trimmed.toUpperCase()] : undefined };
  }

  const w = parseInt(ratioParts[0], 10);
  const h = parseInt(ratioParts[1], 10);
  if (isNaN(w) || isNaN(h) || w === 0 || h === 0) {
    return { acceptedFormats: formatPart ? [formatPart] : undefined };
  }

  return {
    aspectRatio: `${w}:${h}`,
    acceptedFormats: formatPart ? [formatPart] : undefined,
  };
}

function buildEffectiveSpec(
  spec: ChannelSpecFull,
  deliverableReq: ShootDeliverableRequirement | undefined,
): ChannelSpecFull {
  if (!deliverableReq) return spec;

  const effectiveSpec = { ...spec };

  if (deliverableReq.aspectRatio) {
    const parts = deliverableReq.aspectRatio.split(":");
    if (parts.length === 2) {
      const w = parseInt(parts[0], 10);
      const h = parseInt(parts[1], 10);
      if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
        effectiveSpec.aspectRatioLabel = deliverableReq.aspectRatio;
        effectiveSpec.aspectRatioW = w;
        effectiveSpec.aspectRatioH = h;
      }
    }
  }

  if (deliverableReq.acceptedFormats && deliverableReq.acceptedFormats.length > 0) {
    effectiveSpec.acceptedFormats = deliverableReq.acceptedFormats;
  }

  return effectiveSpec;
}

export async function runAssetQA(input: QAServiceInput): Promise<QAServiceResult> {
  const context = await loadQAContext(input);
  if (!context.ok) {
    return context;
  }

  const { asset, deliverables, cloudinaryMirror } = context;

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

  const channelsToCheck = deliverables.map((d) => d.channel);
  if (channelsToCheck.length === 0) {
    return { ok: false, reason: "no_channels_to_check", status: 400 };
  }

  const deliverableRequirements = new Map<string, ShootDeliverableRequirement>();
  for (const d of deliverables) {
    deliverableRequirements.set(d.channel, d);
  }

  const specMap = await loadChannelSpecsForQA(channelsToCheck);

  const cloudinaryMetadata = await getCloudinaryAssetMetadata(
    cloudinaryMirror.cloudinary_asset_id ?? "",
    cloudinaryMirror.public_id,
    version,
  );

  const providerEnrichmentUnavailable = !cloudinaryMetadata;
  const assetMetadata = cloudinaryMetadata ?? buildCloudinaryAssetMetadataFromMirror(cloudinaryMirror);

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
    const effectiveSpec = buildEffectiveSpec(spec, deliverableReq);

    let findings = runDeterministicChecks(assetMetadata, effectiveSpec, channel);

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

    const qualityFindings = runCloudinaryQualityChecks(assetMetadata);
    const advisoryFindings = qualityFindings.map((f) => ({ ...f, _advisory: true }));
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
    assetId: asset.id,
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