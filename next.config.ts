import type { NextConfig } from "next";

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
  },
  experimental: {
    // Default is CPUs-1 (19 on this machine). That spawned a page-data worker
    // storm during `next build` and contributed to global OOM. Cap it.
    cpus: 4,
    memoryBasedWorkersCount: true,
  },
  // NOTE: the former `env.NEXT_PUBLIC_COPILOTKIT_THREADS_ENABLED` block was
  // removed — it derived a client flag from COPILOTKIT_LICENSE_TOKEN at build
  // time, but that derived variable had zero consumers in src/ and in every
  // installed package, and COPILOTKIT_LICENSE_TOKEN is not configured in any
  // Vercel environment. It therefore evaluated to "false" unconditionally while
  // forcing an unnecessary build-time read of a secret.
  // `typescript.ignoreBuildErrors` was also removed so a Vercel build can no
  // longer ship type errors on its own; CI `npm run typecheck` is the gate.
};

export default nextConfig;
