/**
 * IPI-1228 · SHOOT-REF-CONTENT-001 — dependency-free image header sniffing.
 *
 * The reference-library preflight must prove a candidate file is a real image and
 * know its pixel dimensions *before* anything is uploaded, using only packages the
 * repository actually declares. This module is therefore a pure, self-contained
 * byte-level parser for the four formats the reference library accepts.
 */

export type CandidateImageFormat = "jpg" | "png" | "webp" | "avif";

export type CandidateImageHeader = {
  format: CandidateImageFormat;
  width: number;
  height: number;
};

const MAX_REASONABLE_EDGE_PX = 100_000;

function readUint16BE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 3 > bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    (bytes[offset] * 0x1000000) + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function readUint32LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] * 0x1000000)
  );
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string | null {
  if (offset < 0 || offset + length > bytes.length) return null;
  let text = "";
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(bytes[offset + index]);
  return text;
}

function matchesAscii(bytes: Uint8Array, offset: number, expected: string): boolean {
  return asciiAt(bytes, offset, expected.length) === expected;
}

function header(format: CandidateImageFormat, width: number | null, height: number | null): CandidateImageHeader | null {
  if (width === null || height === null) return null;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) return null;
  if (width <= 0 || height <= 0) return null;
  if (width > MAX_REASONABLE_EDGE_PX || height > MAX_REASONABLE_EDGE_PX) return null;
  return { format, width, height };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function sniffPng(bytes: Uint8Array): CandidateImageHeader | null {
  if (bytes.length < 24) return null;
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) return null;
  }
  if (!matchesAscii(bytes, 12, "IHDR")) return null;
  return header("png", readUint32BE(bytes, 16), readUint32BE(bytes, 20));
}

function sniffJpeg(bytes: Uint8Array): CandidateImageHeader | null {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null;

    const segmentLength = readUint16BE(bytes, offset + 2);
    if (segmentLength === null || segmentLength < 2) return null;

    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return header("jpg", readUint16BE(bytes, offset + 7), readUint16BE(bytes, offset + 5));
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function sniffWebp(bytes: Uint8Array): CandidateImageHeader | null {
  if (bytes.length < 30) return null;
  if (!matchesAscii(bytes, 0, "RIFF") || !matchesAscii(bytes, 8, "WEBP")) return null;

  const fourCc = asciiAt(bytes, 12, 4);
  if (fourCc === "VP8 ") {
    if (!(bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a)) return null;
    const width = readUint16LE(bytes, 26);
    const height = readUint16LE(bytes, 28);
    return header("webp", width === null ? null : width & 0x3fff, height === null ? null : height & 0x3fff);
  }
  if (fourCc === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const bits = readUint32LE(bytes, 21);
    if (bits === null) return null;
    return header("webp", (bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }
  if (fourCc === "VP8X") {
    const width = readUint24LE(bytes, 24);
    const height = readUint24LE(bytes, 27);
    return header("webp", width === null ? null : width + 1, height === null ? null : height + 1);
  }
  return null;
}

function sniffAvif(bytes: Uint8Array): CandidateImageHeader | null {
  if (bytes.length < 16) return null;
  if (!matchesAscii(bytes, 4, "ftyp")) return null;

  const majorBrand = asciiAt(bytes, 8, 4)?.toLowerCase() ?? "";
  if (majorBrand !== "avif" && majorBrand !== "avis") {
    // Read only the compatible-brand bytes that are actually present; an ftyp box may
    // declare fewer than the 32 bytes this parser would ideally inspect.
    const brandBytes = Math.max(0, Math.min(32, bytes.length - 16));
    const compatibleBrands = (asciiAt(bytes, 16, brandBytes) ?? "").toLowerCase();
    if (majorBrand !== "mif1" || (!compatibleBrands.includes("avif") && !compatibleBrands.includes("avis"))) {
      return null;
    }
  }

  const limit = bytes.length - 16;
  for (let index = 0; index <= limit; index += 1) {
    if (!matchesAscii(bytes, index, "ispe")) continue;
    // `ispe` is a FullBox: the 4 bytes after the box type are version + flags and must be
    // zero. Skipping non-zero matches stops compressed frame data (a legal mdat-before-meta
    // layout) from being mistaken for the real dimension box.
    if (readUint32BE(bytes, index + 4) !== 0) continue;
    return header("avif", readUint32BE(bytes, index + 8), readUint32BE(bytes, index + 12));
  }
  return null;
}

/**
 * Returns the real format and pixel dimensions encoded in the file header, or null
 * when the bytes are not one of the accepted reference-candidate image formats.
 * Never trusts the file extension.
 */
export function sniffCandidateImageHeader(bytes: Uint8Array): CandidateImageHeader | null {
  if (bytes.length < 16) return null;
  return sniffPng(bytes) ?? sniffJpeg(bytes) ?? sniffWebp(bytes) ?? sniffAvif(bytes);
}
