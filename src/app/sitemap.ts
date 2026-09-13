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
export default function sitemap(): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap[number] = {
    url: canonicalUrl("/"),
    changeFrequency: "weekly",
    priority: 1,
  };

  const services: MetadataRoute.Sitemap[number][] = SERVICES.map(({ href }) => ({
    url: canonicalUrl(href),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [home, ...services];
}
