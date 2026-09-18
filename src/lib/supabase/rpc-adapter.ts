import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Adapts a Supabase client to the plain promise shape the ShootPlan approval
 * cores accept. The untyped `.rpc(name, args)` call and the thenable-to-promise
 * conversion live here, once, instead of being re-cast at every call site.
 */

export type SupabaseRpcCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export function rpcCallFromClient(client: SupabaseClient<Database>): SupabaseRpcCall {
  return async (name, args) => {
    const builder = client.rpc(name as never, args as never);
    const result = await (builder as unknown as PromiseLike<{ data: unknown; error: unknown }>);
    return { data: result.data, error: result.error };
  };
}

export function brandOrgLookupFromClient(
  client: SupabaseClient<Database>,
): (brandId: string) => Promise<{ data: unknown; error: unknown }> {
  return async (brandId) => {
    const { data, error } = await client
      .from("brands")
      .select("org_id")
      .eq("id", brandId)
      .single();
    return { data, error };
  };
}
