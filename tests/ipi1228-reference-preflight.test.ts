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
