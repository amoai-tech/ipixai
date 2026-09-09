import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { createServiceRoleClient } from "@/lib/supabase/service-role";

type TypedClient = SupabaseClient<Database>;
type ServiceRoleClient = NonNullable<ReturnType<typeof createServiceRoleClient>>;

/**
 * Compile-only coverage for the representative generated-type contracts in
 * IPI-1161. This function is never executed; `npm run typecheck` verifies the
 * table, view, public RPC, service-role RPC, and public-only schema boundary.
 */
export function assertSupabaseDatabaseTypeContract(client: TypedClient) {
  const tableRead = client.from("brands").select("id, approved_profile_at");
  const viewRead = client.from("shoot_portfolio_view").select("id, brand_id");
  const publicRpc = client.rpc("get_shoot_detail", { p_shoot_id: "00000000-0000-0000-0000-000000000000" });
  const serviceRoleRpc = client.rpc("apply_cloudinary_asset_events", { p_events: [] });

  // @ts-expect-error -- the retired singular table must stay out of the contract.
  client.from("event_schedule");
  // @ts-expect-error -- private shoot must not be exposed by the public type owner.
  client.schema("shoot");

  return { tableRead, viewRead, publicRpc, serviceRoleRpc };
}

/** Proves the existing service-role factory returns the same typed contract. */
export function assertServiceRoleDatabaseTypeContract(client: ServiceRoleClient) {
  const typedClient: TypedClient = client;
  return typedClient.rpc("apply_cloudinary_asset_events", { p_events: [] });
}
