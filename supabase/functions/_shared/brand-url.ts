/**
 * IPI-920 · ONB2-INT-001g — brand website URL identity SSOT.
 *
 * One rule, two runtimes: Supabase Edge (Deno) imports this file directly;
 * `app/src/lib/brand/brand-url.ssot.ts` is a byte-identical generated mirror
 * because Next.js/Turbopack cannot resolve modules outside the `app/` root
 * (same constraint that made `config/groq-models.json` a generated SSOT).
 *
 * Edit THIS file only, then mirror into the app tree:
 *   `cp supabase/functions/_shared/brand-url.ts app/src/lib/brand/brand-url.ssot.ts`
 * (or `npm run sync:brand-url` once the CI/config sibling lands).
 * Drift is a test failure — see app/src/lib/brand/brand-url.ssot.test.ts.
 * Shared behaviour matrix: brand-url.fixtures.json (asserted on both sides).
 *
 * Keep this module dependency-free so both runtimes can consume it verbatim.
 */

/** Private/internal/link-local hosts — blocked to prevent SSRF. */
export const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  // Carrier-grade NAT (RFC 6598) 100.64.0.0/10
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^0\.0\.0\.0$/i,
  /^0\./,
  /^::$/,
  /^::1$/,
  /^::ffff:/i,
  // RFC 4193 unique local (ULA) fc00::/7 = fc00::/8 (unassigned, e.g. cjdns) + fd00::/8
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe[89ab][0-9a-f]:/i,
  /\.local$/i,
  /\.internal$/i,
];

/** Lowercase and unwrap the `[…]` brackets WHATWG puts around IPv6 hosts. */
export function normalizeHostname(host: string): string {
  const h = host.toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) return h.slice(1, -1);
  return h;
}

export function isPrivateOrInternalHost(hostname: string): boolean {
  return PRIVATE_HOST_PATTERNS.some((p) => p.test(normalizeHostname(hostname)));
}

/**
 * Canonical identity for a brand website.
 *
 * Origin-only, so `https://Brand.com/shop?utm=1#x` and `https://brand.com` are
 * the same brand everywhere: the app reuses one crawl instead of starting a
 * second, and brand-intelligence matches the same `brand_crawls.source_url`.
 *
 * Returns `null` — never a best-effort string — for anything unusable, so a
 * malformed value can never accidentally equal another malformed value.
 * Rejects non-http(s), private/internal hosts, embedded credentials (they must
 * never reach `brands.brand_url`, attempt keys, or `ai_agent_logs`), and any
 * whitespace inside the URL.
 */
export function normalizeBrandUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (isPrivateOrInternalHost(parsed.hostname)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

/** True when both values resolve to the same brand website. */
export function sameBrandWebsite(a: string | null, b: string | null): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = normalizeBrandUrl(a);
  return left !== null && left === normalizeBrandUrl(b);
}
