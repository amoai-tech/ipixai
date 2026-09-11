// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  buildDirectUploadFormData,
  parseDirectUploadContract,
  signedParamsForDirectUpload,
} from "@/lib/cloudinary/direct-upload";
import { signUploadParams } from "@/lib/cloudinary/sign-upload";
import type { SignedUploadParams } from "@/lib/cloudinary/upload-contract";
import { ShootAssetUploader } from "./shoot-asset-uploader";

const BRAND_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SHOOT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function signedResponse(index = 1) {
  const params = {
    timestamp: 1_700_000_000 + index,
    folder: `ipix/org/one/brand/${BRAND_ID}/shoot/${SHOOT_ID}`,
    public_id: `11111111-1111-4111-8111-11111111111${index}`,
    type: "authenticated" as const,
    context: `org_id=one|brand_id=${BRAND_ID}|asset_id=11111111-1111-4111-8111-11111111111${index}|schema_version=1|v2_shoot_id=${SHOOT_ID}`,
    upload_preset: "ipix-signed-upload",
    overwrite: false as const,
  };
  return {
    api_key: "public-api-key",
    cloud_name: "ipix-cloudinary",
    signature: signUploadParams(params, "test-api-secret"),
    ...params,
  };
}

function providerResponse(index = 1, type: "authenticated" | "upload" = "authenticated") {
  return {
    asset_id: `provider-asset-${index}`,
    public_id: `11111111-1111-4111-8111-11111111111${index}`,
    version: 1_700_000_100 + index,
    type,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function image(name: string) {
  return new File(["synthetic"], name, { type: "image/png" });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => vi.clearAllMocks());

describe("IPI-1116 · CLD-UPLOAD-001 direct signed upload contract", () => {
  it("copies only the exact server-signed parameters into FormData", () => {
    const response = signedResponse();
    const contract = parseDirectUploadContract(response);
    const formData = buildDirectUploadFormData(image("select.png"), contract);

    expect(Array.from(formData.keys()).sort()).toEqual([
      "api_key",
      "context",
      "file",
      "folder",
      "overwrite",
      "public_id",
      "signature",
      "timestamp",
      "type",
      "upload_preset",
    ]);
    expect(formData.get("folder")).toBe(response.folder);
    expect(formData.get("public_id")).toBe(response.public_id);
    expect(formData.get("context")).toBe(response.context);
    expect(formData.get("type")).toBe("authenticated");
    expect(formData.get("overwrite")).toBe("false");
    expect(formData.has("api_secret")).toBe(false);

    // A changed public ID/folder/context/type would produce another server
    // signature.  The browser has no override input to make that change.
    expect(signUploadParams(signedParamsForDirectUpload(contract), "test-api-secret")).toBe(
      response.signature,
    );
    expect(
      signUploadParams({ ...signedParamsForDirectUpload(contract), public_id: "tampered" }, "test-api-secret"),
    ).not.toBe(response.signature);
    expect(
      signUploadParams({ ...signedParamsForDirectUpload(contract), folder: "tampered" }, "test-api-secret"),
    ).not.toBe(response.signature);
    expect(
      signUploadParams({ ...signedParamsForDirectUpload(contract), context: "tampered" }, "test-api-secret"),
    ).not.toBe(response.signature);
    expect(
      signUploadParams(
        { ...signedParamsForDirectUpload(contract), type: "upload" } as unknown as SignedUploadParams,
        "test-api-secret",
      ),
    ).not.toBe(response.signature);
  });

  it("rejects a signer response that weakens authenticated delivery or overwrite protection", () => {
    expect(() => parseDirectUploadContract({ ...signedResponse(), type: "upload" })).toThrow(
      "invalid_signed_upload_contract:type",
    );
    expect(() => parseDirectUploadContract({ ...signedResponse(), overwrite: true })).toThrow(
      "invalid_signed_upload_contract:overwrite",
    );
  });

  it("posts only route context to the signer, sends bytes directly to Cloudinary, and stops at Processing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(signedResponse()))
      .mockResolvedValueOnce(jsonResponse(providerResponse()));
    vi.stubGlobal("fetch", fetchMock);

    render(<ShootAssetUploader brandId={BRAND_ID} shootId={SHOOT_ID} />);
    fireEvent.change(screen.getByLabelText("Upload image files"), {
      target: { files: [image("select.png")] },
    });

    await screen.findByText("Processing");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/cloudinary/sign");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      brand_id: BRAND_ID,
      v2_shoot_id: SHOOT_ID,
      paramsToSign: {},
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.cloudinary.com/v1_1/ipix-cloudinary/auto/upload",
    );
    const signSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    const providerSignal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    expect(signSignal).toBeInstanceOf(AbortSignal);
    expect(providerSignal).toBe(signSignal);
    const formData = fetchMock.mock.calls[1][1].body as FormData;
    expect(formData.get("file")).toBeInstanceOf(File);
    expect(formData.get("type")).toBe("authenticated");
    expect(formData.get("public_id")).toBe(signedResponse().public_id);
    expect(formData.get("folder")).toBe(signedResponse().folder);
    expect(formData.get("context")).toBe(signedResponse().context);
    expect(formData.has("api_secret")).toBe(false);
    expect(screen.queryByText("Ready")).toBeNull();
  });

  it("cancels an active upload and ignores later request completion", async () => {
    let resolveSign!: (response: Response) => void;
    const signResponse = new Promise<Response>((resolve) => {
      resolveSign = resolve;
    });
    const fetchMock = vi.fn().mockReturnValueOnce(signResponse);
    vi.stubGlobal("fetch", fetchMock);

    render(<ShootAssetUploader brandId={BRAND_ID} shootId={SHOOT_ID} />);
    fireEvent.change(screen.getByLabelText("Upload image files"), {
      target: { files: [image("cancel-me.png")] },
    });

    await screen.findByText("Uploading…");
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(signal.aborted).toBe(true);
    expect(await screen.findByText("Cancelled")).not.toBeNull();

    resolveSign(jsonResponse(signedResponse()));
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByText("Cancelled")).not.toBeNull();
    expect(screen.queryByText("Processing")).toBeNull();
    expect(screen.queryByText("Failed")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when Cloudinary reports a non-authenticated delivery type", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(signedResponse()))
      .mockResolvedValueOnce(jsonResponse(providerResponse(1, "upload")));
    vi.stubGlobal("fetch", fetchMock);

    render(<ShootAssetUploader brandId={BRAND_ID} shootId={SHOOT_ID} />);
    fireEvent.change(screen.getByLabelText("Upload image files"), {
      target: { files: [image("downgraded.png")] },
    });

    expect(await screen.findByText("Failed")).not.toBeNull();
    expect((await screen.findByRole("alert")).textContent).toMatch(/not accepted/i);
    expect(screen.queryByText("Processing")).toBeNull();
  });

  it("keeps sibling failures independent and retries only the failed file", async () => {
    let signCount = 0;
    let uploadCount = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/cloudinary/sign") {
        signCount += 1;
        return Promise.resolve(jsonResponse(signedResponse(signCount)));
      }
      uploadCount += 1;
      return Promise.resolve(
        uploadCount === 1
          ? jsonResponse({ error: { message: "temporary" } }, 500)
          : jsonResponse(providerResponse(uploadCount)),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ShootAssetUploader brandId={BRAND_ID} shootId={SHOOT_ID} />);
    fireEvent.change(screen.getByLabelText("Upload image files"), {
      target: { files: [image("first.png"), image("second.png")] },
    });

    await waitFor(() => {
      expect(screen.getByText("first.png")).not.toBeNull();
      expect(screen.getByText("second.png")).not.toBeNull();
      expect(screen.getByText("Failed")).not.toBeNull();
      expect(screen.getByText("Processing")).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getAllByText("Processing")).toHaveLength(2));
    expect(signCount).toBe(3);
    expect(uploadCount).toBe(3);
  });

  it("rejects non-image files before requesting a signature", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ShootAssetUploader brandId={BRAND_ID} shootId={SHOOT_ID} />);
    fireEvent.change(screen.getByLabelText("Upload image files"), {
      target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] },
    });

    expect((await screen.findByRole("alert")).textContent).toContain("Only image files can be uploaded.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Upload queue")).toBeNull();
  });

  it("accepts no more than ten files in one batch", async () => {
    let signerRequests = 0;
    let providerRequests = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/cloudinary/sign") {
        signerRequests += 1;
        return Promise.resolve(jsonResponse(signedResponse(signerRequests)));
      }
      providerRequests += 1;
      return Promise.resolve(jsonResponse(providerResponse(providerRequests)));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ShootAssetUploader brandId={BRAND_ID} shootId={SHOOT_ID} />);
    fireEvent.change(screen.getByLabelText("Upload image files"), {
      target: { files: Array.from({ length: 11 }, (_, index) => image(`select-${index}.png`)) },
    });

    expect(await screen.findByRole("alert")).not.toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(20));
    expect(screen.getAllByText("Processing")).toHaveLength(10);
    expect(screen.queryByText("Failed")).toBeNull();
    expect(signerRequests).toBe(10);
    expect(providerRequests).toBe(10);
  });
});
