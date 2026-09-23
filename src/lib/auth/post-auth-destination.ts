import { resolveRuntimeTenant } from "./runtime-org";
import type { VerifiedOperator } from "./verified-operator";

// Allowlisted internal `?next=` post-auth destinations (IPI-837 ·
// AUTH-OAUTH-001 — Preserve Safe Post-Login Redirect Through Google OAuth).
// Anything outside this set is rejected by safeRedirect and never honored as
// a `next` target. /login is deliberately absent: it is a fail-closed
// destination postAuthDestinationFor returns directly, never a place a
// caller should ask to be sent back to. /onboarding is the AUTH-002 boundary
// owned by ONBOARD-001; /app is the single-org default workspace.
// IPI-1311 · AUTH-ORG-SINGLE-001 removed /org-selection: the MVP tenancy
// model is one membership per user, so there is no normal multi-org routing
// destination anymore. /planner is deliberately absent (IPI-1225 ·
// PLANNER-ROUTE-RETIRE-001): it is only a compatibility redirect to /app now
// (src/app/planner/page.tsx), never a valid post-auth target on its own.
const ALLOWED_INTERNAL_PATHS = new Set(["/app", "/onboarding"]);

const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Validate a post-auth destination. Returns the target only when it is an
 * allowlisted internal path; rejects external URLs, protocol-relative URLs,
 * javascript:/data: schemes, backslash tricks, and malformed values.
 */
export function safeRedirect(target: string | null | undefined): string | null {
  if (!target) return null;
  if (!target.startsWith("/")) return null;
  if (target.startsWith("//")) return null;
  if (EXTERNAL_SCHEME.test(target)) return null;
  if (target.includes("\\")) return null;
  const path = target.split(/[?#]/)[0];
  if (!ALLOWED_INTERNAL_PATHS.has(path)) return null;
  return target;
}

/**
 * One server-owned post-auth routing policy (IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup).
 * Resolves the trusted org membership (AUTH-002) to the exact destination:
 *   - zero memberships    -> /onboarding (IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace boundary)
 *   - one membership      -> /app (IPI-1058 · MARKETING-LOGIN-001 — the Command Center is the default workspace after login)
 *   - membership conflict -> /login (IPI-1311 · AUTH-ORG-SINGLE-001 — fail closed; the database rejects a second membership, so this is an invariant violation, never a routing choice)
 *   - lookup failure      -> /login (fail closed — no access granted)
 * Client orgId / user_metadata are never consulted.
 */
export async function postAuthDestinationFor(input: {
  operator: VerifiedOperator;
  listOrgIds: () => Promise<{ ok: true; orgIds: string[] } | { ok: false }>;
}): Promise<string> {
  const tenant = await resolveRuntimeTenant({ listOrgIds: input.listOrgIds });
  if (tenant.status === "needs_onboarding") return "/onboarding";
  if (tenant.status === "membership_conflict") return "/login";
  if (tenant.status === "lookup_failed") return "/login";
  return "/app";
}