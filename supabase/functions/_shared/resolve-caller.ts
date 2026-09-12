import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { isAuthFailure, resolveAuth } from "./auth.ts";
import { getEdgeEnv } from "./env.ts";
import { createServiceClient, createUserClient } from "./supabase-client.ts";

export type CallerResult = { client: SupabaseClient; userId: string | null } | { response: Response };

export function isCallerFailure(result: CallerResult): result is { response: Response } {
  return "response" in result;
}

/**
 * Trusted internal callers (e.g. the Cloudinary webhook, already signature-verified)
 * authenticate with the service-role key instead of a user JWT — bypass RLS via
 * createServiceClient() rather than trying resolveAuth's getUser() on a non-JWT token.
 */
export async function resolveCaller(req: Request): Promise<CallerResult> {
  const header = req.headers.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token && token === getEdgeEnv().serviceRoleKey) {
    return { client: createServiceClient(), userId: null };
  }

  const auth = await resolveAuth(req, { required: true });
  if (isAuthFailure(auth)) return auth;
  return { client: createUserClient(auth.accessToken), userId: auth.user.id };
}
