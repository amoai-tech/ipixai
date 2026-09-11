import type { SignedUploadParams } from "@/lib/cloudinary/upload-contract";

/**
 * The only Cloudinary fields a browser may send after the trusted signer has
 * authorized the operator, brand, and shoot.  The browser adds the selected
 * file; it never chooses any of these values.
 */
export const DIRECT_UPLOAD_SIGNED_FIELDS = [
  "api_key",
  "timestamp",
  "signature",
  "folder",
  "public_id",
  "context",
  "upload_preset",
  "type",
  "overwrite",
] as const;

export type DirectUploadContract = {
  apiKey: string;
  cloudName: string;
  signature: string;
  params: SignedUploadParams;
};

export type AuthenticatedUploadResult = {
  cloudinaryAssetId: string;
  publicId: string;
  version: string | number;
};

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid_signed_upload_contract:${key}`);
  }
  return value;
}

/**
 * Narrows the server response before any browser-side request is made.  This
 * is deliberately strict: a stale signer response cannot silently downgrade
 * authenticated delivery or overwrite protection.
 */
export function parseDirectUploadContract(payload: unknown): DirectUploadContract {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid_signed_upload_contract");
  }
  const record = payload as Record<string, unknown>;
  const timestamp = record.timestamp;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    throw new Error("invalid_signed_upload_contract:timestamp");
  }
  if (record.type !== "authenticated") {
    throw new Error("invalid_signed_upload_contract:type");
  }
  if (record.overwrite !== false) {
    throw new Error("invalid_signed_upload_contract:overwrite");
  }

  const cloudName = requiredString(record, "cloud_name");
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) {
    throw new Error("invalid_signed_upload_contract:cloud_name");
  }

  return {
    apiKey: requiredString(record, "api_key"),
    cloudName,
    signature: requiredString(record, "signature"),
    params: {
      timestamp,
      folder: requiredString(record, "folder"),
      public_id: requiredString(record, "public_id"),
      type: "authenticated",
      context: requiredString(record, "context"),
      upload_preset: requiredString(record, "upload_preset"),
      overwrite: false,
    },
  };
}

/** The fields covered by the server signature, exactly as sent to Cloudinary. */
export function signedParamsForDirectUpload(
  contract: DirectUploadContract,
): SignedUploadParams {
  return { ...contract.params };
}

export function directUploadUrl(cloudName: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) {
    throw new Error("invalid_signed_upload_contract:cloud_name");
  }
  return `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
}

/**
 * Builds the final browser → Cloudinary request body.  It intentionally has
 * no options for folder, public ID, context, preset, type, or overwrite.
 */
export function buildDirectUploadFormData(
  file: File,
  contract: DirectUploadContract,
): FormData {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("api_key", contract.apiKey);
  formData.set("timestamp", String(contract.params.timestamp));
  formData.set("signature", contract.signature);
  formData.set("folder", contract.params.folder);
  formData.set("public_id", contract.params.public_id);
  formData.set("context", contract.params.context);
  formData.set("upload_preset", contract.params.upload_preset);
  formData.set("type", contract.params.type);
  formData.set("overwrite", "false");
  return formData;
}

export function parseAuthenticatedUploadResult(payload: unknown): AuthenticatedUploadResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid_cloudinary_upload_response");
  }
  const record = payload as Record<string, unknown>;
  if (record.type !== "authenticated") {
    throw new Error("cloudinary_delivery_type_not_authenticated");
  }
  const version = record.version;
  if (typeof version !== "string" && typeof version !== "number") {
    throw new Error("invalid_cloudinary_upload_response:version");
  }
  return {
    cloudinaryAssetId: requiredString(record, "asset_id"),
    publicId: requiredString(record, "public_id"),
    version,
  };
}
