import { NextResponse, type NextRequest } from "next/server";

import {
  postAuthDestinationFor,
  safeRedirect,
} from "@/lib/auth/post-auth-destination";
import { listMembershipOrgIdsFromServerClient } from "@/lib/auth/runtime-org";
import {
  claimsFromSupabaseResult,
  getVerifiedOperatorFromClaims,
} from "@/lib/auth/verified-operator";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");
  const next = safeRedirect(request.nextUrl.searchParams.get("next"));

  function redirectToLogin(error: string, description: string | null) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", error);
    if (description) {
      login.searchParams.set("error_description", description);
    }
    // Preserve a validated internal target so the user returns to their
    // intended destination after re-authenticating.
    if (next) {
      login.searchParams.set("next", next);
    }
    return NextResponse.redirect(login);
  }

  if (providerError && !code) {
    return redirectToLogin(providerError, errorDescription);
  }

  // Create the response first so the Supabase client can persist the exchanged
  // session cookies on it (createClientFromRequest writes to the response).
  // /app is the single-org default workspace; the resolved destination below
  // overrides this location when a verified operator is present.
  const response = NextResponse.redirect(new URL("/app", request.url));
  const supabase = createClientFromRequest(request, response);
  if (!supabase) {
    return redirectToLogin(
      providerError ?? "auth",
      errorDescription ?? "session_exchange_failed",
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectToLogin(
        providerError ?? "auth",
        errorDescription ?? "session_exchange_failed",
      );
    }
  }

  // One server-owned destination policy: resolve by trusted org membership
  // (AUTH-002) from the exchanged session (response-bound client — the
  // incoming request cookies do not yet carry the new session). Then honor a
  // safe `next` target only when its path is compatible with the resolved
  // tenant state. The allowlist is a shape check, not a tenant check — a
  // zero-org user must not be dumped into /planner via ?next=/planner.
  // IPI-1225 · PLANNER-ROUTE-RETIRE-001 — next=/planner is normalized to the
  // resolved destination (/app for a single-org user) instead of honoring it
  // literally: /planner itself now just redirects to /app (src/app/planner/
  // page.tsx), so sending the operator there directly skips a redundant hop.
  const operator = await getVerifiedOperatorFromClaims({
    getClaims: async () =>
      claimsFromSupabaseResult(await supabase.auth.getClaims()),
  });
  if (operator) {
    const destination = await postAuthDestinationFor({
      operator,
      listOrgIds: () =>
        listMembershipOrgIdsFromServerClient(supabase, operator.id),
    });
    const nextPath = next ? new URL(next, request.url).pathname : null;
    const nextIsCompatible = next !== null && nextPath === destination;
    const final = nextIsCompatible ? next : destination;
    response.headers.set("location", new URL(final, request.url).toString());
    return response;
  }

  // No verified session after exchange — fail closed to /login rather than
  // returning the pre-built /app response.
  return redirectToLogin("auth", "session_required");
}