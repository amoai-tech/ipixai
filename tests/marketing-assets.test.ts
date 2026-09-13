import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Adapted from amoai-tech/luminaai app/src/lib/marketing-assets.test.ts
// (IPI-1064 · MARKETING-MEDIA-001). Walks the current iPix marketing source
// (home components + the 5 canonical /services/* pages from IPI-1060),
// extracts every `/images/*` reference, and asserts each one resolves under
// `public/images`. Legacy counted a 9-service, ~30+ asset set; the current
// iPix repo intentionally ships a smaller, provenance-UNVERIFIED set (see
// hero-section.tsx's provenance note — these 12 files trace to Lovable
// AI-scaffolding commits, not a commissioned iPix shoot) — do not reinstate
// the old counts, and do not describe this set as "verified" until an
// actual license record exists.
const ROOT = resolve(__dirname, "..");
const IMAGES_DIR = resolve(ROOT, "public/images");

const MARKETING_SOURCE_DIRS = [
  join(ROOT, "src/app/(marketing)"),
  join(ROOT, "src/components/marketing"),
] as const;

/** Walk a directory tree and return absolute paths to non-test .ts/.tsx files. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSourceFiles(abs));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.tsx")) out.push(abs);
  }
  return out;
}

/** Extract `/images/<file>` references from marketing source (JSX src/href strings). */
function extractReferencedImageFiles(source: string): Set<string> {
  const files = new Set<string>();
  for (const m of source.matchAll(/["']\/images\/([^"']+)["']/g)) {
    files.add(m[1]);
  }
  return files;
}

describe("marketing image assets (IPI-1064 · MARKETING-MEDIA-001)", () => {
  const sources = MARKETING_SOURCE_DIRS.flatMap(collectSourceFiles);
  const referenced = new Set<string>();

  for (const file of sources) {
    for (const img of extractReferencedImageFiles(readFileSync(file, "utf8"))) {
      referenced.add(img);
    }
  }

  it("discovers image references across current marketing source", () => {
    // Home hero (1) + portfolio (6) + 5 service-page heroes = 12 distinct files.
    expect(referenced.size).toBeGreaterThanOrEqual(12);
  });

  it("maps every referenced image to a file under public/images", () => {
    const missing: string[] = [];
    for (const img of [...referenced].sort()) {
      if (!existsSync(join(IMAGES_DIR, img))) missing.push(img);
    }
    expect(missing, `missing assets: ${missing.join(", ")}`).toEqual([]);
  });

  it("covers openGraph hero images declared on the 5 canonical service pages", () => {
    const ogImages = new Set<string>();
    const serviceDir = join(ROOT, "src/app/(marketing)/services");
    for (const entry of readdirSync(serviceDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = readFileSync(join(serviceDir, entry.name, "page.tsx"), "utf8");
      for (const m of src.matchAll(/images:\s*\["(\/images\/[^"]+)"\]/g)) {
        ogImages.add(m[1].replace(/^\/images\//, ""));
      }
    }
    expect(ogImages.size).toBe(5);
    for (const img of ogImages) {
      expect(existsSync(join(IMAGES_DIR, img)), img).toBe(true);
    }
  });

  it("has no orphaned files in public/images (every shipped file has a consumer)", () => {
    const shipped = existsSync(IMAGES_DIR) ? readdirSync(IMAGES_DIR) : [];
    const orphans = shipped.filter((f) => !referenced.has(f));
    expect(orphans, `orphaned public/images files: ${orphans.join(", ")}`).toEqual([]);
  });
});
