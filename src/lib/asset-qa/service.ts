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
  shootId?: string;
  channels?: string[];
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

  if (typedAsset.brand_id) {
    const { data: brand } = await supabase
      .from("brands")
      .select("org_id")
      .eq("id", typedAsset.brand_id)
      .maybeSingle();
    if (brand?.org_id !== input.orgId) {
      return { asset: typedAsset, shoot: null, cloudinaryMirror: null };
    }
  }

  let shoot: ShootRow | null = null;
  const shootId = input.shootId ?? typedAsset.v2_shoot_id;
  if (shootId) {
    const { data: shootData } = await supabase
      .from("shoots")
      .select("id, target_channels, deliverable_aspect_ratio, deliverable_format")
      .eq("id", shootId)
      .maybeSingle();
    shoot = shootData as ShootRow | null;
  }

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

    return {
      assetId: cloudinaryAssetId,
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

  const channelsToCheck = input.channels ?? shoot?.target_channels ?? [];
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

  const assetMetadata = cloudinaryMetadata ?? buildCloudinaryAssetMetadataFromMirror(cloudinaryMirror);

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
        score: 0,
      });
      continue;
    }

    const deliverableReq = deliverableRequirements.get(channel);
    let findings = runDeterministicChecks(assetMetadata, spec, channel);

    if (deliverableReq?.aspectRatio) {
      const assetRatio = aspectRatioToString(assetMetadata.width, assetMetadata.height);
      if (assetRatio && assetRatio !== deliverableReq.aspectRatio) {
        findings.push({
          code: "aspect_ratio_mismatch",
          status: "warn",
          severity: "warning",
          message: `Asset aspect ratio ${assetRatio} differs from shoot deliverable requirement ${deliverableReq.aspectRatio}`,
          evidence: { assetAspectRatio: assetRatio, deliverableAspectRatio: deliverableReq.aspectRatio },
          recommendedAction: "Verify with operator: shoot deliverable takes precedence over platform spec",
        });
      }
    }

    if (deliverableReq?.format) {
      const assetFormatUpper = assetMetadata.format.toUpperCase();
      const deliverableFormatUpper = deliverableReq.format.toUpperCase();
      if (assetFormatUpper !== deliverableFormatUpper) {
        findings.push({
          code: "format_unsupported",
          status: "warn",
          severity: "warning",
          message: `Asset format ${assetMetadata.format} differs from shoot deliverable requirement ${deliverableReq.format}`,
          evidence: { assetFormat: assetMetadata.format, deliverableFormat: deliverableReq.format },
          recommendedAction: "Verify with operator: shoot deliverable takes precedence over platform spec",
        });
      }
    }

    const qualityFindings = runCloudinaryQualityChecks(assetMetadata);
    findings = [...findings, ...qualityFindings];

    channelResults.push(computeChannelResult(channel, spec, findings));
  }

  const allStatuses = channelResults.map((c) => c.overallStatus);
  let overallStatus: QAAssetResult["overallStatus"] = "pass";
  if (allStatuses.includes("fail")) overallStatus = "fail";
  else if (allStatuses.includes("warn")) overallStatus = "warn";
  else if (allStatuses.every((s) => s === "unknown")) overallStatus = "unknown";

  const totalScore = channelResults.reduce((sum, c) => sum + c.score, 0);
  const overallScore = channelResults.length > 0 ? Math.round(totalScore / channelResults.length) : 0;

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