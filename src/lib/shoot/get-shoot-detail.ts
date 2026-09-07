import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { runBrandIdBatches } from "@/lib/dashboard/command-center";
import { isDatabaseUuid } from "@/lib/database-uuid";

/**
 * IPI-1067 · SHOOT-001 — org-scoped shoot browse + detail data layer.
 *
 * Tenant boundary (AUTH-002): every read is scoped by `brandIds` — the
 * trusted org's brand ids, resolved server-side via `loadTrustedBrandIds`
 * (never a client-supplied org/brand value). `public.shoot_portfolio_view`
 * is the only PostgREST-exposed shoot surface; the `shoot` schema is never
 * queried directly (`.schema("shoot")` is forbidden by the task).
 *
 * Detail flow is public-contract-first: the view preauth (brand_id IN
 * trustedBrandIds) is the FINAL authorization; `public.get_shoot_detail`
 * is only a hydrated read-only payload loader whose membership-union RLS
 * is defense in depth, never the authority.
 */

export type ShootListItem = {
  id: string;
  name: string;
  status: string | null;
  type: string | null;
  brandId: string;
  dnaScore: number | null;
  channel: string | null;
  updatedAt: string;
  shotCount: number | null;
  assetCount: number | null;
};

/** Composite keyset cursor — (updated_at, id) matches the list's
 *  `updated_at desc, id asc` sort; `id` is the stable tie-breaker. */
export type ShootListCursor = { updatedAt: string; id: string };

export type ShootListResult =
  | { ok: true; shoots: ShootListItem[]; nextCursor: ShootListCursor | null }
  | { ok: false };

export const SHOOT_BROWSE_PAGE_SIZE = 24;

/** Serializes a cursor for the browse route's `?after=` search param.
 *  base64url of JSON — opaque to the browser, stable across reloads. */
export function encodeShootListCursor(cursor: ShootListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/** True only for the canonical UTC form produced by `cursorFromRow`
 *  (`toISOString()` output). Anything else — date-only strings, missing
 *  milliseconds, non-ISO text — is rejected so it can never be
 *  interpolated into the PostgREST `.or()` filter. */
function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

/** Parses a `?after=` cursor. Fail-closed: anything malformed (bad base64,
 *  non-object, wrong shape, non-canonical timestamp, non-UUID id) returns
 *  null so the route falls back to page 1 instead of erroring or trusting
 *  a tampered cursor. Both fields are later interpolated into raw
 *  PostgREST `.or()` syntax, so they are strictly validated here — never
 *  just shape-checked. */
export function decodeShootListCursor(raw: string | null | undefined): ShootListCursor | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as ShootListCursor).updatedAt === "string" &&
      typeof (parsed as ShootListCursor).id === "string" &&
      isCanonicalIsoTimestamp((parsed as ShootListCursor).updatedAt) &&
      isDatabaseUuid((parsed as ShootListCursor).id)
    ) {
      return { updatedAt: (parsed as ShootListCursor).updatedAt, id: (parsed as ShootListCursor).id };
    }
  } catch {
    // fall through to null
  }
  console.warn("shoot.decodeShootListCursor: malformed cursor rejected", { raw });
  return null;
}

type BrowseRow = {
  id: string;
  name: string | null;
  status: string | null;
  type: string | null;
  brand_id: string;
  dna_score: number | null;
  target_channels: string[] | null;
  updated_at: string;
  shot_count: number | null;
  asset_count: number | null;
};

/** Normalizes a row's updated_at to a canonical UTC ISO cursor value.
 *  Returns null when the timestamp is unparseable — such a row cannot be
 *  cursor-anchored, so it is skipped (with a warning) rather than silently
 *  breaking pagination. */
function cursorFromRow(row: BrowseRow): ShootListCursor | null {
  const updatedAt = new Date(row.updated_at);
  if (Number.isNaN(updatedAt.getTime())) {
    console.warn("shoot.listShootsForOrg: row has unparseable updated_at, skipping", {
      shootId: row.id,
      updatedAt: row.updated_at,
    });
    return null;
  }
  return { updatedAt: updatedAt.toISOString(), id: row.id };
}

/**
 * Browse list for the trusted org, keyset-paginated on
 * `shoot_portfolio_view` (updated_at desc, id asc).
 *
 * NOT the dashboard's SHOOT_LIMIT=6 read: this is the browse page's own
 * deterministic cursor pagination. `brandIds` is batched via
 * `runBrandIdBatches` (same 200-per-batch / concurrency-5 contract as the
 * dashboard) — each batch applies the same cursor filter + sort + limit,
 * and the merged rows are re-sorted and re-sliced, so the union of
 * per-batch pages always contains the true global page.
 *
 * `limit + 1` is fetched per batch so `nextCursor` is an honest
 * "more rows exist" answer: it is set only when the merged page is full.
 * A batch failure fails the whole call — never a partial page.
 */
export async function listShootsForOrg(
  supabase: SupabaseClient,
  brandIds: string[],
  options: { after?: ShootListCursor | null; limit?: number } = {},
): Promise<ShootListResult> {
  const limit = options.limit ?? SHOOT_BROWSE_PAGE_SIZE;
  if (limit < 1) return { ok: false };
  if (brandIds.length === 0) return { ok: true, shoots: [], nextCursor: null };
  const after = options.after ?? null;

  try {
    const batchResult = await runBrandIdBatches<BrowseRow[]>(brandIds, async (brandIdBatch) => {
      let query = supabase
        .from("shoot_portfolio_view")
        .select(
          "id,name,status,type,brand_id,dna_score,target_channels,updated_at,shot_count,asset_count",
        )
        .in("brand_id", brandIdBatch)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(limit + 1);
      if (after) {
        query = query.or(
          `updated_at.lt.${after.updatedAt},and(updated_at.eq.${after.updatedAt},id.gt.${after.id})`,
        );
      }
      const { data, error } = await query;
      if (error || !data) {
        console.error("shoot.listShootsForOrg: batch query failed", { error });
        return { ok: false };
      }
      return { ok: true, value: data as BrowseRow[] };
    });
    if (!batchResult.ok) return { ok: false };

    const rows = batchResult.values.flat();
    rows.sort((a, b) => {
      if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const lastRow = page[page.length - 1];
    const nextCursor = hasMore && lastRow ? cursorFromRow(lastRow) : null;

    return {
      ok: true,
      shoots: page.map((row) => ({
        id: row.id,
        name: row.name ?? "Untitled shoot",
        status: row.status,
        type: row.type,
        brandId: row.brand_id,
        dnaScore: row.dna_score ?? null,
        channel: row.target_channels?.[0] ?? null,
        updatedAt: row.updated_at,
        shotCount: row.shot_count ?? null,
        assetCount: row.asset_count ?? null,
      })),
      nextCursor,
    };
  } catch (err) {
    console.error("shoot.listShootsForOrg: threw", { err });
    return { ok: false };
  }
}

export type ShootPreauthResult = { ok: true } | { ok: false; reason: "not_found" | "query_failed" };

/**
 * FINAL authorization for a single shoot: the shoot must exist in
 * `shoot_portfolio_view` with a brand_id inside the trusted org's brand
 * set. Anything else — foreign org, deleted shoot, unknown id — is
 * `not_found` (the route renders 404, never a leak of the row's existence).
 *
 * Batched like the list: a single batch failing fails the whole check
 * (fail-closed — never authorize on a partial brand scan).
 */
export async function preauthorizeShootForOrg(
  supabase: SupabaseClient,
  shootId: string,
  brandIds: string[],
): Promise<ShootPreauthResult> {
  if (brandIds.length === 0) return { ok: false, reason: "not_found" };
  try {
    const batchResult = await runBrandIdBatches<boolean>(brandIds, async (brandIdBatch) => {
      const { data, error } = await supabase
        .from("shoot_portfolio_view")
        .select("id")
        .eq("id", shootId)
        .in("brand_id", brandIdBatch)
        .limit(1);
      if (error || !data) {
        console.error("shoot.preauthorizeShootForOrg: batch query failed", { shootId, error });
        return { ok: false };
      }
      return { ok: true, value: data.length > 0 };
    });
    if (!batchResult.ok) return { ok: false, reason: "query_failed" };
    return batchResult.values.some(Boolean) ? { ok: true } : { ok: false, reason: "not_found" };
  } catch (err) {
    console.error("shoot.preauthorizeShootForOrg: threw", { shootId, err });
    return { ok: false, reason: "query_failed" };
  }
}

/**
 * Runtime schema for `public.get_shoot_detail`'s json_build_object payload
 * (keys confirmed against the live function on nvdlhrodvevgwdsneplk,
 * 2026-09-06). `approvals`/`activity` are validated as object arrays only —
 * their tabs are placeholder shells in SHOOT-001; deep-typing them is
 * downstream work. Unknown keys are stripped, not rejected, so a future
 * additive RPC change doesn't break the contract.
 */
const shootDetailSchema = z.object({
  shoot: z.object({
    id: z.string(),
    name: z.string(),
    status: z.string().nullable(),
    brief: z.string().nullable(),
    target_channels: z.array(z.string()).nullable(),
    estimated_budget: z.number().nullable(),
    actual_cost: z.number().nullable(),
    currency: z.string().nullable(),
    budget_breakdown: z.unknown().nullable(),
    start_date: z.string().nullable(),
    end_date: z.string().nullable(),
    location: z.string().nullable(),
    dna_score: z.number().nullable(),
    mood_board_urls: z.array(z.string()).nullable(),
    cover_url: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    brand_id: z.string(),
  }),
  brand: z.object({
    id: z.string(),
    name: z.string(),
  }),
  deliverables: z.array(
    z.object({
      id: z.string(),
      channel: z.string().nullable(),
      format: z.string().nullable(),
      quantity: z.number().nullable(),
      status: z.string().nullable(),
    }),
  ),
  shots: z.array(
    z.object({
      id: z.string(),
      shot_number: z.number().nullable(),
      description: z.string().nullable(),
      style_notes: z.string().nullable(),
      status: z.string().nullable(),
    }),
  ),
  assets: z.array(
    z.object({
      id: z.string(),
      url: z.string().nullable(),
      cloudinary_id: z.string().nullable(),
      format: z.string().nullable(),
      resource_type: z.string().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      dna_score: z.number().nullable(),
      status: z.string().nullable(),
      created_at: z.string().nullable(),
    }),
  ),
  crew: z.array(
    z.object({
      id: z.string(),
      role: z.string().nullable(),
      confirmed: z.boolean().nullable(),
      notes: z.string().nullable(),
      internal_contact_id: z.string().nullable(),
      marketplace_vendor_id: z.string().nullable(),
    }),
  ),
  approvals: z.array(z.record(z.string(), z.unknown())),
  activity: z.array(z.record(z.string(), z.unknown())),
});

export type ShootDetail = z.infer<typeof shootDetailSchema>;

export type ShootDetailLoad =
  | { ok: true; status: "found"; data: ShootDetail }
  | { ok: false; status: "not_found" | "malformed" | "query_failed" };

function isPgNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P0002"
  );
}

/**
 * Hydrated read-only payload loader — NEVER the final authorization (see
 * `loadShootDetailForOrg`). Calls `public.get_shoot_detail` and
 * runtime-validates the JSON at this boundary: a malformed payload returns
 * `malformed` and never reaches the UI. The returned shoot id is also
 * cross-checked against the requested id (defense in depth against a
 * misbehaving RPC).
 */
export async function hydrateShootDetail(
  supabase: SupabaseClient,
  shootId: string,
): Promise<ShootDetailLoad> {
  try {
    const { data, error } = await supabase.rpc("get_shoot_detail", { p_shoot_id: shootId });
    if (error) {
      if (isPgNotFoundError(error)) return { ok: false, status: "not_found" };
      console.error("shoot.hydrateShootDetail: rpc failed", { shootId, error });
      return { ok: false, status: "query_failed" };
    }
    const parsed = shootDetailSchema.safeParse(data);
    if (!parsed.success) {
      console.error("shoot.hydrateShootDetail: malformed payload", {
        shootId,
        issues: parsed.error.issues,
      });
      return { ok: false, status: "malformed" };
    }
    if (parsed.data.shoot.id !== shootId) {
      console.error("shoot.hydrateShootDetail: payload shoot id mismatch", {
        shootId,
        returned: parsed.data.shoot.id,
      });
      return { ok: false, status: "malformed" };
    }
    return { ok: true, status: "found", data: parsed.data };
  } catch (err) {
    console.error("shoot.hydrateShootDetail: threw", { shootId, err });
    return { ok: false, status: "query_failed" };
  }
}

/**
 * Detail load for the trusted org: view preauth first (the final
 * authorization), then hydration. `not_found` covers both a foreign-org
 * shoot and a genuinely missing one — the route renders the same 404.
 *
 * The hydrated payload's `shoot.brand_id` is cross-checked against the
 * trusted brand set before it is returned: `get_shoot_detail` is
 * membership-union scoped, so this check is what keeps the rendered
 * payload bound to the ACTIVE org even if the shoot was reassigned to a
 * brand outside the trusted set between preauth and hydration.
 */
export async function loadShootDetailForOrg(
  supabase: SupabaseClient,
  shootId: string,
  brandIds: string[],
): Promise<ShootDetailLoad> {
  const preauth = await preauthorizeShootForOrg(supabase, shootId, brandIds);
  if (!preauth.ok) {
    return preauth.reason === "not_found"
      ? { ok: false, status: "not_found" }
      : { ok: false, status: "query_failed" };
  }
  const hydrated = await hydrateShootDetail(supabase, shootId);
  if (hydrated.status !== "found") return hydrated;
  if (!brandIds.includes(hydrated.data.shoot.brand_id)) {
    console.warn("shoot.loadShootDetailForOrg: hydrated brand outside trusted set", {
      shootId,
      brandId: hydrated.data.shoot.brand_id,
    });
    return { ok: false, status: "not_found" };
  }
  return hydrated;
}