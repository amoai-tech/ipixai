import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const config = getPublicSupabaseConfig();
  if (!config) return supabaseResponse;

  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  // Planner requests stream for at most five minutes. Do not start a run with
  // a JWT that can expire mid-stream: Realtime closes private channels after
  // expiry, making cross-instance Stop/reconnect unavailable.
  const pathname = request.nextUrl.pathname;
  const isPlannerRoute = pathname === "/api/copilotkit" || pathname.startsWith("/api/copilotkit/");
  const original = claimsData?.claims;
  if (isPlannerRoute && !claimsError && original && typeof original.exp === "number") {
    const now = Math.floor(Date.now() / 1000);
    const requiredLifetimeSeconds = 360; // 300s route maxDuration + 60s margin
    if (original.exp - now < requiredLifetimeSeconds) {
      // The Proxy (not a streaming Route Handler) owns refresh-token rotation:
      // its existing setAll writes both the request and response cookies.
      const { data, error } = await supabase.auth.refreshSession();
      const renewed = !error && data.session ? await supabase.auth.getClaims() : null;
      if (
        error || !data.session || renewed?.error ||
        !renewed?.data?.claims ||
        renewed?.data?.claims?.sub !== original.sub ||
        (renewed?.data?.claims?.exp ?? 0) - Math.floor(Date.now() / 1000) < requiredLifetimeSeconds
      ) {
        return NextResponse.json(
          { error: "planner_session_refresh_required" },
          { status: 401, headers: { "Cache-Control": "private, no-store" } },
        );
      }
    }
  }
  return supabaseResponse;
}
