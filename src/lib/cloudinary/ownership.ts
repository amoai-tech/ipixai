import { isDatabaseUuid } from "@/lib/database-uuid";

export const isUuid = isDatabaseUuid;

type BrandLookupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => PromiseLike<{
            data: { id: string } | null;
            error: unknown;
          }>;
        };
      };
    };
  };
};

type ShootRpcClient = {
  rpc: (
    fn: "v2_shoot_owned_by_brand",
    args: { p_shoot_id: string; p_brand_id: string },
  ) => PromiseLike<{ data: boolean | null; error: unknown }>;
};

/** Brand must belong to the trusted org (never trust body.org_id). */
export async function assertBrandOwnedByOrg(
  supabase: unknown,
  input: { brandId: string; orgId: string },
): Promise<"ok" | "forbidden" | "lookup_failed"> {
  if (!isUuid(input.brandId) || !isUuid(input.orgId)) return "forbidden";
  const client = supabase as BrandLookupClient;
  try {
    const { data, error } = await client
      .from("brands")
      .select("id")
      .eq("id", input.brandId)
      .eq("org_id", input.orgId)
      .maybeSingle();
    if (error) return "lookup_failed";
    return data?.id ? "ok" : "forbidden";
  } catch {
    return "lookup_failed";
  }
}

/**
 * Optional V2 shoot must belong to the already-proven brand.
 * Uses public.v2_shoot_owned_by_brand — shoot schema is not PostgREST-exposed.
 */
export async function assertV2ShootOwnedByBrand(
  supabase: unknown,
  input: { v2ShootId: string; brandId: string },
): Promise<"ok" | "forbidden" | "lookup_failed"> {
  if (!isUuid(input.v2ShootId) || !isUuid(input.brandId)) return "forbidden";
  const client = supabase as ShootRpcClient;
  try {
    const { data, error } = await client.rpc("v2_shoot_owned_by_brand", {
      p_shoot_id: input.v2ShootId,
      p_brand_id: input.brandId,
    });
    if (error) return "lookup_failed";
    return data === true ? "ok" : "forbidden";
  } catch {
    return "lookup_failed";
  }
}
