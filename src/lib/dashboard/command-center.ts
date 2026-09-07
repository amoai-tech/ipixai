import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardBrand = {
  id: string;
  name: string;
};

export type DashboardShoot = {
  id: string;
  name: string;
  status: string | null;
  /** Owning brand id. Shoots load org-wide (not scoped to one brand), so
   *  this is what lets the hero match a shoot to *its own* brand instead of
   *  showing another brand's most recent shoot under the wrong hero. */
  brandId: string;
  /** Real DNA score (0-100), when scored. Never fabricated. */
  dnaScore: number | null;
  /** First target channel, when set — used for the "IG · 4:5"-style meta
   *  line. No invented channel. */
  channel: string | null;
};

/**
 * DASH-MAIN-002: pure hero-greeting logic (COPY+CLEAN of Lumina's
 * buildHeroGreeting concept, ADAPTed — no fabricated fallback like Lumina's
 * "generate IG deliverables for your active campaign" when nothing real is
 * known). No approval-count branch: no real source exists yet, and the
 * owning task hasn't shipped it —
 * IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject
 * AI Plans Before Anything Is Saved
 * Add that branch back only once a real pending-approval count can be
 * supplied; a parameter every caller passes as `0` is speculative, not
 * currently-supported behavior.
 */
export function buildHeroGreeting(input: {
  brandName: string;
  recentShootName?: string | null;
}): { headline: string; subline: string } {
  const { brandName, recentShootName } = input;
  const headline = `You're working with ${brandName}.`;

  if (recentShootName) {
    return { headline, subline: `Continue planning ${recentShootName}.` };
  }
  return { headline, subline: "Ask the Production Planner what to work on next." };
}

/**
 * DASH-MAIN-002: shared hero-brand + recent-own-shoot resolution. Shoots
 * load org-wide (see DashboardShoot.brandId), so "recent" here means the
 * most-recently-updated shoot that actually belongs to the hero brand, not
 * just shoots[0]. Both CommandCenter's hero and OperatorPanel's rail/chat
 * welcome (via ReportWorkspaceStats) call this — kept in one place so the
 * two surfaces can't independently drift on what counts as "recent".
 */
export function resolveHeroContext(
  brands: DashboardBrand[] | undefined,
  shoots: DashboardShoot[] | undefined,
): { brand: DashboardBrand | undefined; recentShoot: DashboardShoot | undefined } {
  const brand = brands?.[0];
  const recentShoot = shoots?.find((shoot) => shoot.brandId === brand?.id);
  return { brand, recentShoot };
}

const BRAND_LIMIT = 6;
const SHOOT_LIMIT = 6;
// Page size for the org's own brand id list used to scope Shoots — not a
// display cap (that's BRAND_LIMIT). Paginated rather than a single capped
// read: silently truncating would under-scope Shoots for an org with more
// brands than one page, excluding real shoots from "Recent shoots" with no
// error surfaced.
const TRUSTED_BRAND_ID_PAGE_SIZE = 500;
// Sanity ceiling on total pages so a corrupt/unbounded result set can't spin
// this loop forever — 50 pages * 500 is far beyond any real org's brand
// count. Hitting it is treated as a failure, not a silent partial result.
const TRUSTED_BRAND_ID_MAX_PAGES = 50;

/**
 * DASH-MAIN-001: org-scoped brand read for the Command Center.
 *
 * `orgId` must already be the AUTH-002 trusted org (never a client-supplied
 * value) — RLS on `public.brands` is defense in depth, not the only guard.
 *
 * Typed with the real Supabase client (no generated `Database` type exists
 * in this repo yet, so `.from()` stays loosely typed regardless — that's an
 * acknowledged gap, not one this function should hide behind a shadow
 * interface). The one cast below is on the query *result* shape, not the
 * client.
 */
export async function loadOrgBrands(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ ok: true; brands: DashboardBrand[] } | { ok: false }> {
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("id,name")
      .eq("org_id", orgId)
      // `id` is a stable tie-breaker so brands sharing a created_at
      // timestamp return in a deterministic order across requests.
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(BRAND_LIMIT);
    if (error || !data) {
      console.error("dashboard.loadOrgBrands: query failed", { orgId, error });
      return { ok: false };
    }
    const rows = data as { id: string; name: string | null }[];
    return {
      ok: true,
      brands: rows.map((row) => ({ id: row.id, name: row.name ?? "Untitled brand" })),
    };
  } catch (err) {
    console.error("dashboard.loadOrgBrands: threw", { orgId, err });
    return { ok: false };
  }
}

/**
 * DASH-MAIN-001: every trusted-org brand id (uncapped, unlike the display
 * list `loadOrgBrands` returns), so Shoots can be scoped to the org's full
 * brand set — not just the 6 cards shown on the dashboard.
 *
 * Paginates in pages of `TRUSTED_BRAND_ID_PAGE_SIZE` rather than a single
 * `.limit()` read: a single capped read silently drops brands beyond the
 * cap, and `loadOrgShoots` would then under-scope Shoots for that org with
 * no error surfaced. Returns `ok: false` — never a partial list — if the
 * org's brand count exceeds what `TRUSTED_BRAND_ID_MAX_PAGES` pages can
 * hold; that ceiling exists only to bound the loop, not as a soft cap.
 *
 * Keyset (cursor) pagination, not offset-based `.range(from, to)`: even
 * with a stable `.order("id")`, an offset shifts if a row is inserted or
 * deleted between page fetches — a brand could be silently skipped, and
 * the `Set` dedupe below can't restore a row that was never fetched.
 * `.gt("id", afterId)` re-anchors each page on the last id actually seen,
 * which is immune to that. The dedupe stays as defense in depth for an id
 * that somehow comes back on two pages anyway (e.g. an unexpectedly
 * overlapping response) — double-counted by countOrgShoots and
 * double-fetched (then, after loadOrgShoots's cross-batch sort,
 * potentially duplicated) by loadOrgShoots otherwise.
 */
export async function loadTrustedBrandIds(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ ok: true; brandIds: string[] } | { ok: false }> {
  const brandIds: string[] = [];
  let afterId: string | null = null;
  try {
    for (let page = 0; page < TRUSTED_BRAND_ID_MAX_PAGES; page++) {
      const { data, error } = await (afterId === null
        ? supabase
            .from("brands")
            .select("id")
            .eq("org_id", orgId)
            .order("id", { ascending: true })
            .limit(TRUSTED_BRAND_ID_PAGE_SIZE)
        : supabase
            .from("brands")
            .select("id")
            .eq("org_id", orgId)
            .order("id", { ascending: true })
            .gt("id", afterId)
            .limit(TRUSTED_BRAND_ID_PAGE_SIZE));
      if (error || !data) {
        console.error("dashboard.loadTrustedBrandIds: query failed", { orgId, page, error });
        return { ok: false };
      }
      const rows = data as { id: string }[];
      brandIds.push(...rows.map((row) => row.id));
      if (rows.length < TRUSTED_BRAND_ID_PAGE_SIZE) {
        return { ok: true, brandIds: [...new Set(brandIds)] };
      }
      afterId = rows[rows.length - 1].id;
    }
    console.error("dashboard.loadTrustedBrandIds: exceeded max pages, refusing a partial scope", {
      orgId,
      pages: TRUSTED_BRAND_ID_MAX_PAGES,
    });
    return { ok: false };
  } catch (err) {
    console.error("dashboard.loadTrustedBrandIds: threw", { orgId, err });
    return { ok: false };
  }
}

// loadTrustedBrandIds is uncapped (up to TRUSTED_BRAND_ID_MAX_PAGES *
// TRUSTED_BRAND_ID_PAGE_SIZE = 25,000 ids for one org) — a single
// `.in("brand_id", brandIds)` filter with all of them risks exceeding
// Supabase's request URL/header size limit (~16KB). 200 UUIDs is ~7.4KB
// URL-encoded, comfortably under that with headroom for the rest of the
// request. Shared by loadOrgShoots and countOrgShoots, the two brand_id-
// filtered reads that can receive this uncapped list.
const BRAND_ID_FILTER_BATCH_SIZE = 200;
// A worst-case org (25,000 ids) is 125 batches — issuing those one at a
// time in series would be 125 sequential round trips. A small fixed
// concurrency keeps that bounded without a new dependency (p-queue is
// only a transitive install here, not a declared one) or unbounded
// fan-out that could overwhelm the connection pool.
const BATCH_CONCURRENCY = 5;

/**
 * Runs `run` once per BRAND_ID_FILTER_BATCH_SIZE-sized chunk of `ids`, up
 * to BATCH_CONCURRENCY chunks in flight at a time, and returns every
 * chunk's value in original order. Any chunk failing (network throw or an
 * explicit ok:false from `run`) fails the whole call — never a partial
 * result silently combined with the chunks that did succeed. Already-
 * dispatched chunks in the same concurrency group still run to completion
 * (they're plain reads with no side effect to cancel); no further groups
 * are started once a failure is seen.
 *
 * Deduped via Set before chunking — defense in depth on top of
 * loadTrustedBrandIds's own dedupe. A duplicate id that happened to land
 * in two different chunks would otherwise fetch (and double-count, or
 * after loadOrgShoots's cross-batch sort, duplicate) the same underlying
 * rows twice; a duplicate within the *same* chunk is already harmless
 * (SQL `IN (x, x)` doesn't return `x`'s rows twice), so this is specifically
 * about the cross-chunk case.
 */
export async function runBrandIdBatches<T>(
  ids: string[],
  run: (batch: string[]) => Promise<{ ok: true; value: T } | { ok: false }>,
): Promise<{ ok: true; values: T[] } | { ok: false }> {
  const dedupedIds = [...new Set(ids)];
  const batches: string[][] = [];
  for (let i = 0; i < dedupedIds.length; i += BRAND_ID_FILTER_BATCH_SIZE) {
    batches.push(dedupedIds.slice(i, i + BRAND_ID_FILTER_BATCH_SIZE));
  }
  const values: T[] = [];
  for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
    const group = batches.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.all(group.map(run));
    for (const result of results) {
      if (!result.ok) return { ok: false };
      values.push(result.value);
    }
  }
  return { ok: true, values };
}

/**
 * DASH-MAIN-001: recent-shoots read for the Command Center.
 *
 * Reads `public.shoot_portfolio_view` (security_invoker=true, PostgREST-
 * exposed), NOT raw `shoot.shoots` — that table's RLS is membership-union
 * (every org the caller belongs to), not active-org scoped, so relying on
 * it alone would leak a multi-org user's other orgs' shoots. The explicit
 * `.in("brand_id", trustedBrandIds)` filter — brand ids already scoped to
 * the trusted org via `loadTrustedBrandIds` — is the real isolation
 * boundary here; view RLS is defense in depth.
 *
 * `brandIds` empty (org has no brands yet) short-circuits to an honest
 * empty result without a query — an `.in()` with an empty array is either
 * a wasted round-trip or a backend-specific edge case, not the same thing
 * as "org has brands but no shoots".
 *
 * `brandIds` is batched the same way as countOrgShoots (see
 * BRAND_ID_FILTER_BATCH_SIZE) — each batch is independently ordered and
 * limited to SHOOT_LIMIT server-side (the true top SHOOT_LIMIT across all
 * trusted brands is always contained in the union of each batch's own top
 * SHOOT_LIMIT, sorted the same way), then the merged rows are re-sorted by
 * the same updated_at/id contract and re-sliced to SHOOT_LIMIT. A single
 * batch failing returns ok:false for the whole call — never a partial
 * result silently passed off as complete. Behavior for the common case
 * (brandIds.length <= BRAND_ID_FILTER_BATCH_SIZE, one batch) is unchanged.
 *
 * `updated_at` is now selected (needed to re-sort merged batches) but
 * still never exposed on the returned DashboardShoot — same as
 * `cover_url` below, it's an internal-only column.
 *
 * Deliberately NOT selecting `cover_url`: the view resolves it from
 * `shoot.shoots.mood_board_urls[1]`, a plain URL with no bridge to this
 * app's one proven secure-delivery contract (signed `type: authenticated`
 * Cloudinary assets via `cloudinary_assets` + get-authorized-asset-preview.ts
 * — mood_board_urls entries aren't tracked in that mirror table at all).
 * Rendering it directly would be an unproven, possibly-broken, possibly
 * cross-org-leakable path. Wire this once
 * IPI-1112 · CLD-DELIVERY-001 — Serve Org-Safe Cloudinary Previews with
 * Named Transforms ships a real signed-preview route for it; until then the
 * UI shows an honest no-image placeholder for every shoot, same as when a
 * real cover genuinely doesn't exist.
 */
export async function loadOrgShoots(
  supabase: SupabaseClient,
  brandIds: string[],
): Promise<{ ok: true; shoots: DashboardShoot[] } | { ok: false }> {
  if (brandIds.length === 0) {
    return { ok: true, shoots: [] };
  }
  type Row = {
    id: string;
    name: string | null;
    status: string | null;
    brand_id: string;
    dna_score: number | null;
    target_channels: string[] | null;
    updated_at: string;
  };
  try {
    const batchResult = await runBrandIdBatches<Row[]>(brandIds, async (brandIdBatch) => {
      const { data, error } = await supabase
        .from("shoot_portfolio_view")
        .select("id,name,status,brand_id,dna_score,target_channels,updated_at")
        .in("brand_id", brandIdBatch)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(SHOOT_LIMIT);
      if (error || !data) {
        console.error("dashboard.loadOrgShoots: batch query failed", { error });
        return { ok: false };
      }
      return { ok: true, value: data as Row[] };
    });
    if (!batchResult.ok) return { ok: false };
    const rows = batchResult.values.flat();
    // Same deterministic-order contract as loadOrgBrands, re-applied across
    // the merged batches: most-recently-updated first, id as a stable
    // tie-breaker.
    rows.sort((a, b) => {
      if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return {
      ok: true,
      shoots: rows.slice(0, SHOOT_LIMIT).map((row) => ({
        id: row.id,
        name: row.name ?? "Untitled shoot",
        status: row.status,
        brandId: row.brand_id,
        dnaScore: row.dna_score ?? null,
        channel: row.target_channels?.[0] ?? null,
      })),
    };
  } catch (err) {
    console.error("dashboard.loadOrgShoots: threw", { err });
    return { ok: false };
  }
}

/**
 * DASH-MAIN-002: exact org-wide shoot total for the Intelligence rail's
 * derived workspace state. loadOrgShoots's own `shoots` array is capped at
 * SHOOT_LIMIT for the dashboard's display list — reusing its length here
 * would silently under-report the real total for any org past that cap, so
 * this is a separate head-only count query instead (no row data
 * transferred, index-backed via the same brand_id filter).
 *
 * A single batch failing anywhere returns ok:false for the whole call —
 * never a partial/undercounted total silently passed off as complete.
 */
export async function countOrgShoots(
  supabase: SupabaseClient,
  brandIds: string[],
): Promise<{ ok: true; count: number } | { ok: false }> {
  if (brandIds.length === 0) {
    return { ok: true, count: 0 };
  }
  try {
    const batchResult = await runBrandIdBatches<number>(brandIds, async (brandIdBatch) => {
      const { count, error } = await supabase
        .from("shoot_portfolio_view")
        .select("id", { count: "exact", head: true })
        .in("brand_id", brandIdBatch);
      if (error || count === null) {
        console.error("dashboard.countOrgShoots: batch query failed", { error });
        return { ok: false };
      }
      return { ok: true, value: count };
    });
    if (!batchResult.ok) return { ok: false };
    return { ok: true, count: batchResult.values.reduce((sum, c) => sum + c, 0) };
  } catch (err) {
    console.error("dashboard.countOrgShoots: threw", { err });
    return { ok: false };
  }
}
