import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// CopilotKit 1.85's GenUI entrypoint dynamically imports the optional
// maplibre-gl peer. iPix has no Map component, and the compatible 5.x line has
// a critical XSS advisory (CVE-2026-85061), so the import is aliased to this
// inert placeholder for every bundler. Keep both aliases below in sync.
const MAPLIBRE_PLACEHOLDER = "./src/lib/copilotkit/maplibre-unavailable.ts";

// Minimal local webpack shape: the Next config callback is untyped, and
// importing webpack's own types would add a direct dependency for one alias.
type WebpackAliasValue = string | false | string[];
type WebpackResolveConfig = {
  alias?: Record<string, WebpackAliasValue>;
  [key: string]: unknown;
};
type WebpackConfig = {
  resolve?: WebpackResolveConfig;
  [key: string]: unknown;
};

// IPI-1063 · MARKETING-SEO-001 — merged-page redirects from IPI-1060's
// service-page consolidation. Static + permanent so Next emits one 308 hop
// (no chains) and search engines consolidate ranking signal onto the target.
// /services/video is deliberately absent: the legacy video-production page
// (cinematic brand films/motion graphics) has no content overlap with any of
// the 5 photography-only canonical pages it could be pointed at, and IPI-1060
// dropped it as a nav destination without a consolidation target — an
// unrelated redirect target risks reading as a soft 404 to Google. It 404s.
const SERVICE_REDIRECTS = [
  { source: "/services/clothing", destination: "/services/fashion-photography" },
  { source: "/services/location", destination: "/services/fashion-photography" },
  { source: "/services/jewellery", destination: "/services/ecommerce-photography" },
] as const;

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return SERVICE_REDIRECTS.map(({ source, destination }) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  // Pin the workspace root so a leftover lockfile in $HOME does not steal it.
  // Expanding this to /home/sk would watch the whole home directory.
  turbopack: {
    root: process.cwd(),
    // CopilotKit 1.85's GenUI entrypoint dynamically imports optional MapLibre.
    // Our read-only ConceptComparison catalog has NO maps. Alias the optional
    // import to an inert module rather than shipping vulnerable MapLibre 5.x
    // (CVE-2026-85061); remove this alias only with a separately reviewed map feature.
    // Official Next 16 optional-package fallback: turbopack.resolveAlias.
    resolveAlias: {
      "maplibre-gl": MAPLIBRE_PLACEHOLDER,
    },
  },
  // The Vercel project builds with Next's webpack bundler, where
  // turbopack.resolveAlias does not apply. Without this, the optional import
  // fails the production build with "Module not found: Can't resolve
  // 'maplibre-gl'" (proved by Preview deployment dpl_9tSb9HQumrCZ5B3ACDVniWCKMmP4
  // on aa1989f). Keep the target identical to the Turbopack alias.
  webpack: (config: WebpackConfig) => {
    const resolve = config.resolve ?? {};
    config.resolve = {
      ...resolve,
      alias: {
        ...(resolve.alias ?? {}),
        "maplibre-gl": path.resolve(process.cwd(), MAPLIBRE_PLACEHOLDER),
      },
    };
    return config;
  },
  experimental: {
    // Default is CPUs-1 (19 on this machine). That spawned a page-data worker
    // storm during `next build` and contributed to global OOM. Cap it.
    // Vercel's Standard machine is 4 cores / 8 GB; four workers plus the main
    // webpack process does not fit once GenUI is in the graph, so the build
    // runs two. The heap cap lives on the Vercel project build command.
    cpus: 2,
    memoryBasedWorkersCount: true,
  },
  // No `env` block: it previously derived a dead NEXT_PUBLIC_COPILOTKIT_THREADS_ENABLED
  // flag from COPILOTKIT_LICENSE_TOKEN at build time (zero consumers, and the
  // secret is not set in any Vercel environment), forcing a needless build-time
  // secret read. No `typescript.ignoreBuildErrors` either — CI `npm run typecheck`
  // is the gate, so the Vercel build must not silently swallow type errors.
};

// Raw config for contract tests; Next consumes only the default export.
export { nextConfig };

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
