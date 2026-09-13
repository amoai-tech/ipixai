import type { MetadataRoute } from "next";

import { canonicalUrl } from "@/lib/site";

// IPI-1063 · MARKETING-SEO-001 — application-owned robots.txt. Allows the
// public marketing surface and keeps the operator app, Supabase auth
// callbacks, and API routes out of the crawl. This is a crawl-budget policy
// only — it is not the noindex mechanism for /login or /signup (those carry
// page-level `robots: { index: false, follow: false }` metadata; Google
// treats robots disallow and page noindex as distinct signals).
// The sitemap reference is pinned to the immutable production origin via
// canonicalUrl — per-environment NEXT_PUBLIC_SITE_URL can never leak into it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/auth/", "/api/"],
    },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
