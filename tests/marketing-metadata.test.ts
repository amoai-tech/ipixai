import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "../src/lib/site";

// IPI-1064 · MARKETING-MEDIA-001 PR #141 — regression for the Sentry finding:
// the 5 service pages declare relative `openGraph.images` paths
// ("/images/<file>.jpg") but nothing set `metadataBase`, so social crawlers
// couldn't resolve them to a real URL. `src/app/(marketing)/layout.tsx` can't
// be imported directly here — it pulls in "./marketing.css", which vitest's
// PostCSS pipeline can't process outside a full Next build — so this proves
// the composition two ways: (1) the layout source is actually wired to the
// existing SITE_URL source of truth, not a hardcoded/second helper, and
// (2) resolving each service page's real openGraph.images path against that
// same SITE_URL produces a correct, non-preview absolute URL. The decisive
// runtime proof (rendered <meta property="og:image"> on a booted server) is
// covered separately by curl, per the PR's verification evidence.
const ROOT = resolve(__dirname, "..");

describe("marketing metadataBase composition (IPI-1064 PR #141)", () => {
  it("wires (marketing)/layout.tsx metadataBase to the existing SITE_URL source of truth", () => {
    const layoutSource = readFileSync(
      join(ROOT, "src/app/(marketing)/layout.tsx"),
      "utf8",
    );
    expect(layoutSource).toMatch(/import\s*\{\s*SITE_URL\s*\}\s*from\s*["']@\/lib\/site["']/);
    expect(layoutSource).toMatch(/metadataBase:\s*new URL\(SITE_URL\)/);
  });

  it("resolves every service page's openGraph image to an absolute, non-preview URL", () => {
    const serviceDir = join(ROOT, "src/app/(marketing)/services");
    const ogImagePaths: string[] = [];
    for (const entry of readdirSync(serviceDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = readFileSync(join(serviceDir, entry.name, "page.tsx"), "utf8");
      const match = src.match(/images:\s*\["(\/images\/[^"]+)"\]/);
      expect(match, `${entry.name}/page.tsx has no openGraph.images entry`).toBeTruthy();
      if (match) ogImagePaths.push(match[1]);
    }

    expect(ogImagePaths).toHaveLength(5);

    for (const path of ogImagePaths) {
      // Same composition Next performs with metadataBase: new URL(relative, base).
      const resolved = new URL(path, SITE_URL).toString();
      expect(resolved.startsWith("https://www.ipix.co/images/")).toBe(true);
      expect(resolved).not.toMatch(/vercel\.app|workers\.dev|localhost/);
    }
  });
});
