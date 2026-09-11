"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildDirectUploadFormData,
  directUploadUrl,
  parseAuthenticatedUploadResult,
  parseDirectUploadContract,
} from "@/lib/cloudinary/direct-upload";

const MAX_FILES_PER_BATCH = 10;
const IMAGE_MIME_PREFIX = "image/";

type UploadStatus = "uploading" | "processing" | "failed";

type UploadItem = {
  id: number;
  file: File;
  status: UploadStatus;
  error?: string;
};

type Props = {
  brandId: string;
  shootId: string;
};

function uploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "cloudinary_delivery_type_not_authenticated") {
    return "Cloudinary did not return an authenticated asset. The upload was not accepted.";
  }
  return "Upload failed. You can retry this file.";
}

/**
 * IPI-1116 — browser-only transport.  File bytes go directly to Cloudinary;
 * this component asks iPix only for an authorized, server-owned signature.
 */
export function ShootAssetUploader({ brandId, shootId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);

  function updateItem(id: number, update: Partial<UploadItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }

  async function upload(item: UploadItem) {
    updateItem(item.id, { status: "uploading", error: undefined });
    try {
      const signResponse = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          v2_shoot_id: shootId,
          paramsToSign: {},
        }),
      });
      if (!signResponse.ok) throw new Error("signing_failed");

      const contract = parseDirectUploadContract(await signResponse.json());
      const providerResponse = await fetch(directUploadUrl(contract.cloudName), {
        method: "POST",
        body: buildDirectUploadFormData(item.file, contract),
      });
      if (!providerResponse.ok) throw new Error("provider_upload_failed");

      // Processing is the terminal success state for this task.  IPI-1115
      // owns the notification route that can later prove durable Ready.
      parseAuthenticatedUploadResult(await providerResponse.json());
      updateItem(item.id, { status: "processing" });
    } catch (error) {
      updateItem(item.id, { status: "failed", error: uploadErrorMessage(error) });
    }
  }

  function addFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    const images = selected.filter((file) => file.type.startsWith(IMAGE_MIME_PREFIX));
    const accepted = images.slice(0, MAX_FILES_PER_BATCH);
    const messages: string[] = [];
    if (images.length !== selected.length) messages.push("Only image files can be uploaded.");
    if (images.length > MAX_FILES_PER_BATCH) {
      messages.push(`Only the first ${MAX_FILES_PER_BATCH} image files were added.`);
    }
    setBatchError(messages.length ? messages.join(" ") : null);
    const additions = accepted.map((file) => ({
      id: nextId.current++,
      file,
      status: "uploading" as const,
    }));
    setItems((current) => [...current, ...additions]);
    for (const item of additions) void upload(item);
  }

  return (
    <section aria-labelledby="shoot-upload-heading" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 id="shoot-upload-heading" className="text-sm font-semibold">
            Upload selects
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Uploaded files are Processing until the provider notification flow records their durable status.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          className="sr-only"
          aria-label="Upload image files"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {batchError && <p role="alert" className="text-sm text-[var(--destructive)]">{batchError}</p>}

      {items.length > 0 && (
        <ul className="space-y-2" aria-label="Upload queue">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{item.file.name}</span>
              <span role="status">
                {item.status === "uploading" ? "Uploading…" : item.status === "processing" ? "Processing" : "Failed"}
              </span>
              {item.status === "failed" && (
                <>
                  <span role="alert" className="text-[var(--destructive)]">{item.error}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void upload(item)}>
                    Retry
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
