import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { sniffCandidateImageHeader } from "../src/lib/shoot/reference-candidate-image";
import {
  MAX_CANDIDATE_BYTES,
  isAcceptableProvenanceSource,
  parseReferenceCandidateManifest,
} from "../src/lib/shoot/reference-candidates";
import { runCli, type ReferenceLibraryDeps } from "../scripts/reference-library/candidates";
import { commandPreflight, type PreflightDeps } from "../scripts/reference-library/preflight";

const KEY = "clothing_flat_lay_knolling";
const MANIFEST_PATH = "scripts/reference-library/manifest.json";
const DIR = "assets/reference-candidates";
const PEXELS_PROVENANCE =
  "Pexels photo 3998648 by Hana Brannigan — flat lay of clothes — Pexels License — retrieved 2026-09-17 — https://www.pexels.com/photo/flat-lay-of-clothes-3998648/";
const CLOUDINARY_PROVENANCE =
  "existing Cloudinary library asset packshot-007_v167vg selected for IPI-644 reference library 2026-09";

function jpegBytes(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
}

function pngBytes(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
}

function textBytes(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "utf8"));
}

/** ISOBMFF `ispe` FullBox: size(4) type(4) version+flags(4) width(4) height(4). */
function ispeBox(width: number, height: number, versionFlags = 0): number[] {
  return [
    0x00, 0x00, 0x00, 0x14, 0x69, 0x73, 0x70, 0x65,
    (versionFlags >>> 24) & 0xff, (versionFlags >>> 16) & 0xff, (versionFlags >>> 8) & 0xff, versionFlags & 0xff,
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
  ];
}

function ftypBox(majorBrand: string, compatibleBrands: string[]): number[] {
  const brands = compatibleBrands.flatMap((brand) => [...brand].map((char) => char.charCodeAt(0)));
  const size = 16 + brands.length;
  return [
    (size >>> 24) & 0xff, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff,
    0x66, 0x74, 0x79, 0x70,
    ...[...majorBrand].map((char) => char.charCodeAt(0)),
    0x00, 0x00, 0x00, 0x00,
    ...brands,
  ];
}

function avifBytes(width: number, height: number, majorBrand = "avif"): Uint8Array {
  return new Uint8Array([...ftypBox(majorBrand, ["avif", "mif1", "miaf"]), ...ispeBox(width, height)]);
}

function ascii(value: string): number[] {
  return [...value].map((char) => char.charCodeAt(0));
}

function webpContainer(fourCc: string): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(ascii("RIFF"), 0);
  bytes.set(ascii("WEBP"), 8);
  bytes.set(ascii(fourCc), 12);
  return bytes;
}

/** WebP lossy "VP8 ": start code 9D 01 2A at 23-25, 14-bit dims at 26 (w) and 28 (h). */
function webpVp8Bytes(width: number, height: number): Uint8Array {
  const bytes = webpContainer("VP8 ");
  bytes[23] = 0x9d;
  bytes[24] = 0x01;
  bytes[25] = 0x2a;
  bytes[26] = width & 0xff;
  bytes[27] = (width >> 8) & 0xff;
  bytes[28] = height & 0xff;
  bytes[29] = (height >> 8) & 0xff;
  return bytes;
}

/** WebP lossless "VP8L": 0x2F signature at 20, 14-bit dims packed into the uint32 at 21. */
function webpVp8lBytes(width: number, height: number): Uint8Array {
  const bytes = webpContainer("VP8L");
  bytes[20] = 0x2f;
  const bits = (width - 1) | ((height - 1) << 14);
  bytes[21] = bits & 0xff;
  bytes[22] = (bits >>> 8) & 0xff;
  bytes[23] = (bits >>> 16) & 0xff;
  bytes[24] = (bits >>> 24) & 0xff;
  return bytes;
}

/** WebP extended "VP8X": 24-bit (dimension - 1) at 24 (w) and 27 (h). */
function webpVp8xBytes(width: number, height: number): Uint8Array {
  const bytes = webpContainer("VP8X");
  const storedWidth = width - 1;
  const storedHeight = height - 1;
  bytes[24] = storedWidth & 0xff;
  bytes[25] = (storedWidth >>> 8) & 0xff;
  bytes[26] = (storedWidth >>> 16) & 0xff;
  bytes[27] = storedHeight & 0xff;
  bytes[28] = (storedHeight >>> 8) & 0xff;
  bytes[29] = (storedHeight >>> 16) & 0xff;
  return bytes;
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    referenceKey: KEY,
    file: `${DIR}/${KEY}.jpg`,
    provenanceSource: PEXELS_PROVENANCE,
    ...overrides,
  };
}

function manifestWith(candidates: Record<string, unknown>[]) {
  return { schemaVersion: "reference-candidate-v1", candidates };
}

function makePreflightDeps(overrides: Partial<PreflightDeps> = {}): PreflightDeps {
  return {
    log: vi.fn(),
    stderr: vi.fn(),
    readManifest: vi.fn(async () => manifestWith([candidate()])),
    listDirectory: vi.fn(async () => [`${KEY}.jpg`]),
    readFileBytes: vi.fn(async () => jpegBytes(1600, 2400)),
    loadCatalog: vi.fn(async () => [{ id: "ref-uuid-1", referenceKey: KEY }]),
    loadApprovedMappings: vi.fn(async () => []),
    ...overrides,
  };
}

function joined(mock: ReturnType<typeof vi.fn>): string {
  return mock.mock.calls.map((call) => String(call[0])).join("\n");
}

function makeRuntimeDeps(overrides: Partial<ReferenceLibraryDeps> = {}): ReferenceLibraryDeps {
  return {
    ...makePreflightDeps(),
    fileExists: vi.fn(() => true),
    listProviderCandidates: vi.fn(async () => []),
    uploadCandidate: vi.fn(async () => {
      throw new Error("upload must not run during preflight");
    }),
    destroyCandidate: vi.fn(async () => {}),
    recordApprovedMapping: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("provenance hardening", () => {
  it.each([
    "extern",
    "cloudinary",
    "TODO",
    "PENDING",
    "XXX",
    "none",
    "unknown",
    "n/a",
    "REPLACE",
    "CHANGE_ME",
    "change me",
  ])("rejects the bare placeholder value %s", (value) => {
    expect(isAcceptableProvenanceSource(value)).toBe(false);
  });

  it.each(["REPLACE_WITH_APPROVED_SOURCE", "REPLACE_IF_REQUIRED", "TODO add the real source", "pending review"])(
    "rejects the unfinished marker %s",
    (value) => {
      expect(isAcceptableProvenanceSource(value)).toBe(false);
    },
  );

  it("accepts valid external provenance", () => {
    expect(isAcceptableProvenanceSource(PEXELS_PROVENANCE)).toBe(true);
  });

  it("accepts valid existing-Cloudinary provenance without treating the provider name as a placeholder", () => {
    expect(isAcceptableProvenanceSource(CLOUDINARY_PROVENANCE)).toBe(true);
    expect(isAcceptableProvenanceSource("iPix-owned studio library")).toBe(true);
  });

  it("fails manifest parsing with a placeholder_provenance reason", () => {
    const parsed = parseReferenceCandidateManifest(manifestWith([candidate({ provenanceSource: "extern" })]));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toBe("placeholder_provenance");
  });

  it("still parses a candidate with factual provenance", () => {
    const parsed = parseReferenceCandidateManifest(manifestWith([candidate()]));
    expect(parsed.ok).toBe(true);
  });
});

describe("candidate image sniffing", () => {
  it("reads real dimensions from JPEG and PNG headers", () => {
    expect(sniffCandidateImageHeader(jpegBytes(1200, 1600))).toEqual({ format: "jpg", width: 1200, height: 1600 });
    expect(sniffCandidateImageHeader(pngBytes(900, 810))).toEqual({ format: "png", width: 900, height: 810 });
  });

  it("returns null for bytes that are not an accepted image", () => {
    expect(sniffCandidateImageHeader(textBytes("this is not an image at all, just prose"))).toBeNull();
  });

  it("reads AVIF dimensions from the ispe box at type+8 (width) and type+12 (height)", () => {
    expect(sniffCandidateImageHeader(avifBytes(1234, 5678))).toEqual({ format: "avif", width: 1234, height: 5678 });
  });

  it("accepts a valid AVIF whose ftyp box is shorter than 48 bytes", () => {
    const shortFtyp = new Uint8Array([...ftypBox("mif1", ["avif"]), ...ispeBox(1024, 768)]);
    expect(shortFtyp.length).toBe(40);
    expect(sniffCandidateImageHeader(shortFtyp)).toEqual({ format: "avif", width: 1024, height: 768 });
  });

  it("ignores a decoy ispe box whose version and flags are not zero", () => {
    const decoy = new Uint8Array([
      ...ftypBox("avif", ["avif", "mif1", "miaf"]),
      ...ispeBox(1, 1, 1),
      ...ispeBox(1234, 5678),
    ]);
    expect(sniffCandidateImageHeader(decoy)).toEqual({ format: "avif", width: 1234, height: 5678 });
  });

  it("reads WebP dimensions from all three chunk variants", () => {
    expect(sniffCandidateImageHeader(webpVp8Bytes(1200, 1600))).toEqual({ format: "webp", width: 1200, height: 1600 });
    expect(sniffCandidateImageHeader(webpVp8lBytes(1024, 768))).toEqual({ format: "webp", width: 1024, height: 768 });
    expect(sniffCandidateImageHeader(webpVp8xBytes(2268, 4032))).toEqual({ format: "webp", width: 2268, height: 4032 });
  });

  it("rejects a WebP container whose inner signature is wrong", () => {
    const badStartCode = webpVp8Bytes(1200, 1600);
    badStartCode[24] = 0x00;
    expect(sniffCandidateImageHeader(badStartCode)).toBeNull();

    const badLosslessSignature = webpVp8lBytes(1024, 768);
    badLosslessSignature[20] = 0x00;
    expect(sniffCandidateImageHeader(badLosslessSignature)).toBeNull();

    expect(sniffCandidateImageHeader(webpContainer("VP8 "))).toBeNull();
  });
});

describe("commandPreflight", () => {
  it("passes a valid candidate and never uploads or approves", async () => {
    const deps = makePreflightDeps();
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(0);
    const output = joined(deps.log as ReturnType<typeof vi.fn>);
    expect(output).toContain("PREFLIGHT PASSED");
    expect(output).toContain(`PASS ${KEY}`);
    expect(output).toContain("No upload and no approval was performed by this command.");
  });

  it("passes a valid WebP candidate through the whole gate", async () => {
    const deps = makePreflightDeps({
      listDirectory: vi.fn(async () => [`${KEY}.webp`]),
      readFileBytes: vi.fn(async () => webpVp8lBytes(1600, 900)),
      readManifest: vi.fn(async () => manifestWith([candidate({ file: `${DIR}/${KEY}.webp` })])),
    });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(0);
    const output = joined(deps.log as ReturnType<typeof vi.fn>);
    expect(output).toContain("PREFLIGHT PASSED");
    expect(output).toContain(`PASS ${KEY}`);
    expect(output).toContain("1600x900");
    expect(output).toContain("webp");
  });

  it("fails when no candidate file exists for a requested key", async () => {
    const deps = makePreflightDeps({ listDirectory: vi.fn(async () => []) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("no candidate file found");
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("STOP: do not upload.");
  });

  it("fails on ambiguous candidate files", async () => {
    const deps = makePreflightDeps({ listDirectory: vi.fn(async () => [`${KEY}.jpg`, `${KEY}.png`]) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("ambiguous");
  });

  it("fails when the manifest file name does not match the candidate on disk", async () => {
    const deps = makePreflightDeps({ listDirectory: vi.fn(async () => [`${KEY}.png`]) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("does not match");
  });

  it("fails when the manifest declares the same file name in a different directory", async () => {
    const deps = makePreflightDeps({
      readManifest: vi.fn(async () => manifestWith([candidate({ file: `/tmp/elsewhere/${KEY}.jpg` })])),
    });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("does not match");
  });

  it("fails when the candidate file cannot be read", async () => {
    const deps = makePreflightDeps({ readFileBytes: vi.fn(async () => null) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("not readable");
  });

  it("fails when the bytes are not an image", async () => {
    const deps = makePreflightDeps({ readFileBytes: vi.fn(async () => textBytes("not an image")) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("not a valid jpg/png/webp/avif image");
  });

  it("fails when the extension disagrees with the detected format", async () => {
    const deps = makePreflightDeps({ readFileBytes: vi.fn(async () => pngBytes(1600, 2400)) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("does not match detected format");
  });

  it("fails when the short edge is below the minimum", async () => {
    const deps = makePreflightDeps({ readFileBytes: vi.fn(async () => jpegBytes(1600, 400)) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("short edge must be at least");
  });

  it("fails when the file exceeds the maximum size", async () => {
    const oversized = new Uint8Array(MAX_CANDIDATE_BYTES + 1);
    oversized.set(jpegBytes(1600, 2400));
    const deps = makePreflightDeps({ readFileBytes: vi.fn(async () => oversized) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("bytes must be between");
  });

  it("fails when the reference key is not in the canonical catalog", async () => {
    const deps = makePreflightDeps({ loadCatalog: vi.fn(async () => [{ id: "other", referenceKey: "other_key" }]) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("not in the canonical catalog");
  });

  it("fails when the reference already has an approved mapping", async () => {
    const deps = makePreflightDeps({
      loadApprovedMappings: vi.fn(async () => [{ referenceId: "ref-uuid-1", hasApprovedMedia: true }]),
    });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("already has an approved mapping");
  });

  it("fails when a requested key is absent from the manifest", async () => {
    const deps = makePreflightDeps();
    expect(await commandPreflight(MANIFEST_PATH, ["some_other_key"], DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("not in the manifest");
  });

  it("fails when the manifest itself is invalid", async () => {
    const deps = makePreflightDeps({ readManifest: vi.fn(async () => ({ schemaVersion: "nope", candidates: [] })) });
    expect(await commandPreflight(MANIFEST_PATH, null, DIR, deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("manifest invalid");
  });

  it("is wired into runCli with --keys and --dir parsing and never writes", async () => {
    const deps = makeRuntimeDeps();
    expect(await runCli(["preflight", MANIFEST_PATH, "--keys", KEY, "--dir", DIR], deps)).toBe(0);
    expect(joined(deps.log as ReturnType<typeof vi.fn>)).toContain(`PASS ${KEY}`);
    expect(deps.uploadCandidate).not.toHaveBeenCalled();
    expect(deps.recordApprovedMapping).not.toHaveBeenCalled();
  });

  it("blocks any command path that would re-prepare an approved reference", async () => {
    const deps = makeRuntimeDeps({
      loadApprovedMappings: vi.fn(async () => [{ referenceId: "ref-uuid-1", hasApprovedMedia: true }]),
    });
    expect(await runCli(["preflight", MANIFEST_PATH], deps)).toBe(1);
    expect(joined(deps.stderr as ReturnType<typeof vi.fn>)).toContain("already has an approved mapping");
  });
});

describe("repository hygiene for candidate artifacts", () => {
  it("ignores candidate binaries and the working manifest but keeps the example tracked", async () => {
    const ignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
    const lines = ignore.split("\n").map((line) => line.trim());
    expect(lines).toContain("/assets/reference-candidates/");
    expect(lines).toContain("/scripts/reference-library/manifest.json");
    expect(lines).not.toContain("/scripts/reference-library/manifest.example.json");
  });
});
