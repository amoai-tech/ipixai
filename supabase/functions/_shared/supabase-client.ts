import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import { getEdgeEnv, getPublicEdgeEnv } from "./env.ts";

export function createServiceClient(): SupabaseClient {
  const { supabaseUrl, serviceRoleKey } = getEdgeEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** User-scoped client — respects RLS when JWT is passed. */
export function createUserClient(accessToken: string): SupabaseClient {
  const { supabaseUrl, anonKey } = getPublicEdgeEnv();
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
