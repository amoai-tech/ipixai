import type { MetadataRoute } from "next";

import { SERVICES } from "@/components/marketing/services";
import { canonicalUrl } from "@/lib/site";

// IPI-1063 · MARKETING-SEO-001 — application-owned sitemap.xml for the public
// marketing routes. Derived from the SERVICES registry (single source of
// truth also used by the header/footer nav) so route additions stay in sync.
// /login and /signup are intentionally excluded — both are noindex (see
// (marketing)/login/page.tsx and (marketing)/signup/page.tsx).
//
// No `lastModified` field: these are static marketing routes with no real
// content-mtime source, and stamping `new Date()` would fake freshness on
// every build (Lumina did this; IPI-1063 explicitly drops it).
//
// No `changeFrequency`/`priority` either: Google's sitemap docs say it
// ignores both (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
// so the differentiated weekly/1.0 vs monthly/0.8 values Lumina set were
// dead weight carried over from the COPY+CLEAN, not a real signal to anyone
// that reads this sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const urls = [canonicalUrl("/"), ...SERVICES.map(({ href }) => canonicalUrl(href))];
  return urls.map((url) => ({ url }));
}
