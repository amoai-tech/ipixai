import { test, expect } from "@playwright/test";

import { SERVICES } from "../src/components/marketing/services";

// IPI-1063 · MARKETING-SEO-001 — runtime HTTP proof that the SEO contract
// actually works over real routes, not just that sitemap()/robots()/
// redirects() return the right data structures. marketing-seo-001.test.ts
// (vitest) proves the functions' return values; this proves Next actually
// wires them into /sitemap.xml, /robots.txt, real 308s, and rendered
// noindex meta — closing the false-green gap where all of those unit tests
// could pass while the real HTTP routes were still broken. Public marketing
// surface — no auth needed (same pattern as marketing-services.spec.ts).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("SEO contract: real HTTP routes", () => {
  test("/sitemap.xml serves exactly home + the 5 canonical service URLs, production host", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toHaveLength(1 + SERVICES.length);
    expect(locs[0]).toBe("https://www.ipix.co/");
    for (const { href } of SERVICES) {
      expect(locs).toContain(`https://www.ipix.co${href}`);
    }
    // Every entry must be the production host — never this test's own
    // localhost origin — even though the request itself hit localhost.
    for (const loc of locs) {
      expect(loc.startsWith("https://www.ipix.co/")).toBe(true);
    }
  });

  test("/robots.txt allows the public root, disallows private paths, points at the production sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/Allow:\s*\//);
    expect(body).toMatch(/Disallow:\s*\/app\//);
    expect(body).toMatch(/Disallow:\s*\/auth\//);
    expect(body).toMatch(/Disallow:\s*\/api\//);
    expect(body).toContain("Sitemap: https://www.ipix.co/sitemap.xml");
  });

  test("legacy service URLs redirect one hop, permanently, to a live canonical page", async ({ request }) => {
    const cases: Array<[string, string]> = [
      ["/services/clothing", "/services/fashion-photography"],
      ["/services/location", "/services/fashion-photography"],
      ["/services/jewellery", "/services/ecommerce-photography"],
    ];
    for (const [source, destination] of cases) {
      const redirect = await request.get(source, { maxRedirects: 0 });
      expect(redirect.status(), `${source} should be a permanent redirect`).toBe(308);
      expect(new URL(redirect.headers()["location"] ?? "", "http://x").pathname).toBe(destination);

      // Follow it for real and confirm one hop lands on a 200 canonical page,
      // not a chain into another redirect.
      const followed = await request.get(source);
      expect(followed.status(), `${source} should resolve to a live page`).toBe(200);
      expect(new URL(followed.url()).pathname).toBe(destination);
    }
  });

  test("/services/video is a deliberate 404, not a redirect", async ({ request }) => {
    const response = await request.get("/services/video", { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });

  test("/login and /signup are live and render noindex,nofollow", async ({ page }) => {
    for (const path of ["/login", "/signup"]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should be publicly reachable`).toBe(200);
      const content = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(content, `${path} should be noindex`).toMatch(/noindex/);
      expect(content, `${path} should be nofollow`).toMatch(/nofollow/);
    }
  });

  test("home and every canonical service page self-canonicalize, matching the sitemap URL", async ({ page }) => {
    const routes = ["/", ...SERVICES.map(({ href }) => href)];
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} should be publicly reachable`).toBe(200);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      // Compare through URL parsing, not raw string equality: Next's dev
      // server (this suite's target — see playwright.config.ts's `dev:e2e`)
      // renders the root path's canonical as "https://www.ipix.co" while a
      // production build renders "https://www.ipix.co/" — confirmed on both
      // directly, and production (the actual observable outcome) already
      // carries the trailing slash. `new URL(...).toString()` normalizes
      // both to the same value, since it's the same URL either way.
      expect(canonical, `${route} canonical should resolve`).toBeTruthy();
      expect(
        new URL(canonical as string).toString(),
        `${route} canonical should match its own sitemap URL`,
      ).toBe(new URL(`https://www.ipix.co${route}`).toString());
    }
  });
});
