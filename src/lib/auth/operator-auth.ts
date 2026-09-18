import {
  claimsFromSupabaseResult,
  getVerifiedOperatorFromClaims,
} from "./verified-operator";
import { createClient, createClientFromRequest } from "@/lib/supabase/server";

/** Generic request auth with no CopilotKit/Mastra dependency. */
export async function getVerifiedOperatorForRequest(request: Request) {
  const supabase = createClientFromRequest(request);
  if (!supabase) return null;
  return getVerifiedOperatorFromClaims({
    request,
    getClaims: async () =>
      claimsFromSupabaseResult(await supabase.auth.getClaims()),
  });
}

/** Generic cookie auth for server-rendered operator surfaces. */
export async function getVerifiedOperatorFromCookies() {
  const supabase = await createClient();
  if (!supabase) return null;
  return getVerifiedOperatorFromClaims({
    getClaims: async () =>
      claimsFromSupabaseResult(await supabase.auth.getClaims()),
  });
}
