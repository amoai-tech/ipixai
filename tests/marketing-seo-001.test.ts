// IPI-1063 · MARKETING-SEO-001 — sitemap, robots, redirects, and auth-page
// noindex contract for the public marketing site. sitemap.ts/robots.ts live
// under src/app/ (Next route-convention files) but are plain modules with no
// server/client component deps, so they're testable directly like the legacy
// Lumina implementation this was COPY+CLEANed from.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SERVICES } from "../src/components/marketing/services";

const PROD_ORIGIN = "https://www.ipix.co";

async function loadSitemap() {
  const { default: sitemap } = await import("../src/app/sitemap");
  return sitemap();
}

async function loadRobots() {
  const { default: robots } = await import("../src/app/robots");
  return robots();
}

function readSource(relPath: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", relPath), "utf8");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("sitemap.ts", () => {
  it("returns exactly home + the 5 canonical SERVICES routes, production host", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const urls = (await loadSitemap()).map((entry) => entry.url);

    expect(urls).toHaveLength(1 + SERVICES.length);
    expect(SERVICES.length).toBe(5);
    expect(urls[0]).toBe(`${PROD_ORIGIN}/`);
    for (const { href } of SERVICES) {
      expect(urls).toContain(`${PROD_ORIGIN}${href}`);
    }
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("never contains a preview/localhost host, even when env points at one", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ipix-preview.sk-498.workers.dev");
    for (const entry of await loadSitemap()) {
      expect(entry.url.startsWith(`${PROD_ORIGIN}/`)).toBe(true);
    }
  });

  it("excludes private/auth/merged-legacy routes", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const urls = (await loadSitemap()).map((entry) => entry.url);
    const excluded = [
      "/login",
      "/signup",
      "/app",
      "/auth",
      "/api",
      "/services/clothing",
      "/services/location",
      "/services/jewellery",
      "/services/video",
    ];
    for (const path of excluded) {
      expect(urls).not.toContain(`${PROD_ORIGIN}${path}`);
    }
  });

  it("does not stamp a fake lastModified freshness date", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    for (const entry of await loadSitemap()) {
      expect(entry.lastModified).toBeUndefined();
    }
  });
});

describe("robots.ts", () => {
  it("allows the public root and disallows /app/, /auth/, /api/", async () => {
    const { rules } = await loadRobots();
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/app/", "/auth/", "/api/"]);
  });

  it("points at the production sitemap regardless of env", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect((await loadRobots()).sitemap).toBe(`${PROD_ORIGIN}/sitemap.xml`);

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.fashionos.co");
    expect((await loadRobots()).sitemap).toBe(`${PROD_ORIGIN}/sitemap.xml`);
  });
});

describe("next.config.ts redirects()", () => {
  it("redirects merged legacy service URLs one hop, permanently, to their consolidated page", async () => {
    const { default: config } = await import("../next.config");
    const redirects = await config.redirects?.();
    expect(redirects).toBeDefined();

    const bySource = Object.fromEntries((redirects ?? []).map((r) => [r.source, r]));
    expect(bySource["/services/clothing"]).toMatchObject({
      destination: "/services/fashion-photography",
      permanent: true,
    });
    expect(bySource["/services/location"]).toMatchObject({
      destination: "/services/fashion-photography",
      permanent: true,
    });
    expect(bySource["/services/jewellery"]).toMatchObject({
      destination: "/services/ecommerce-photography",
      permanent: true,
    });

    // Every redirect destination must itself be a live canonical route, not
    // another redirect source — otherwise this would chain instead of
    // one-hop.
    const sources = new Set(Object.keys(bySource));
    for (const { destination } of Object.values(bySource)) {
      expect(sources.has(destination)).toBe(false);
      expect(SERVICES.some((s) => s.href === destination)).toBe(true);
    }
  });

  it("has no redirect entry for /services/video (explicit 404, not an unrelated redirect)", async () => {
    const { default: config } = await import("../next.config");
    const redirects = await config.redirects?.();
    const sources = (redirects ?? []).map((r) => r.source);
    expect(sources).not.toContain("/services/video");
  });
});

describe("/login and /signup noindex", () => {
  it("both carry robots: { index: false, follow: false } in their page metadata", () => {
    for (const page of [
      "src/app/(marketing)/login/page.tsx",
      "src/app/(marketing)/signup/page.tsx",
    ]) {
      const source = readSource(page);
      expect(source).toMatch(/robots:\s*{\s*index:\s*false,\s*follow:\s*false\s*}/);
    }
  });
});
