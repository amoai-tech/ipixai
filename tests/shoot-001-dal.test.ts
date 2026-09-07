import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  decodeShootListCursor,
  encodeShootListCursor,
  hydrateShootDetail,
  listShootsForOrg,
  loadShootDetailForOrg,
  preauthorizeShootForOrg,
  SHOOT_BROWSE_PAGE_SIZE,
  timestampMicros,
} from "@/lib/shoot/get-shoot-detail";

const ORG_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ORG_B = "bbbbbbbb-0000-4000-8000-000000000002";
const BRAND_A1 = "cccccccc-0000-4000-8000-000000000001";
const BRAND_B1 = "dddddddd-0000-4000-8000-000000000002";
const SHOOT_A1 = "eeeeeeee-0000-4000-8000-000000000001";
const SHOOT_A2 = "eeeeeeee-0000-4000-8000-000000000002";
const SHOOT_B1 = "ffffffff-0000-4000-8000-000000000001";

type OrderCall = { column: string; opts: { ascending: boolean } };

type BrowseRowFixture = {
  id: string;
  name: string | null;
  status: string | null;
  type: string | null;
  dna_score: number | null;
  target_channels: string[] | null;
  updated_at: string;
  shot_count: number | null;
  asset_count: number | null;
};

function browseRow(overrides: Partial<BrowseRowFixture> & { id: string }): BrowseRowFixture {
  return {
    name: "Shoot",
    status: "planning",
    type: "studio_white",
    dna_score: null,
    target_channels: null,
    updated_at: "2026-09-01T10:00:00.000Z",
    shot_count: null,
    asset_count: null,
    ...overrides,
  };
}

/** Parses the composite keyset filter listShootsForOrg emits:
 *  `updated_at.lt.<ts>,and(updated_at.eq.<ts>,id.gt.<id>)` */
function parseCursorFilter(filter: string): { updatedAt: string; id: string } | null {
  const match = filter.match(
    /^updated_at\.lt\.(.+),and\(updated_at\.eq\.(.+),id\.gt\.(.+)\)$/,
  );
  if (!match) return null;
  return { updatedAt: match[1], id: match[3] };
}

/** Converts an ISO timestamp (Z or ±HH:MM offset, 0-6 fraction digits) to
 *  integer microseconds since the epoch — the precision Postgres
 *  `timestamptz` carries. The fake's cursor filter must compare numerically:
 *  lexically '.123400Z' < '.123Z', but numerically 123400µs > 123000µs.
 *  Uses the production `timestampMicros` (single implementation — the
 *  literal assertions below keep the tests an independent behavioral
 *  check). */
function fakeShootBrowseSupabase(
  rowsByBrandId: Record<string, BrowseRowFixture[]>,
  calls: { selects?: string[]; orders?: OrderCall[]; ors?: string[]; froms?: { count: number } } = {},
  failQueries = false,
) {
  const builder = (
    brandIds: string[],
    criteria: OrderCall[] = [],
    cursorFilter: string | null = null,
    limitN: number | null = null,
  ) => {
    const compute = () => {
      if (failQueries) return { data: null, error: new Error("boom") };
      let rows = brandIds.flatMap((id) =>
        (rowsByBrandId[id] ?? []).map((row) => ({ ...row, brand_id: id })),
      );
      if (cursorFilter) {
        const cursor = parseCursorFilter(cursorFilter);
        if (cursor) {
          const cursorMicros = timestampMicros(cursor.updatedAt);
          rows = rows.filter((row) => {
            const rowMicros = timestampMicros(row.updated_at);
            if (cursorMicros === null || rowMicros === null) return false;
            return (
              rowMicros < cursorMicros ||
              (rowMicros === cursorMicros && row.id > cursor.id)
            );
          });
        }
      }
      const sorted = [...rows].sort((a, b) => {
        for (const { column, opts } of criteria) {
          const av = (a as Record<string, unknown>)[column];
          const bv = (b as Record<string, unknown>)[column];
          if (av === bv) continue;
          const cmp = (av as string) < (bv as string) ? -1 : 1;
          return opts.ascending ? cmp : -cmp;
        }
        return 0;
      });
      return { data: limitN === null ? sorted : sorted.slice(0, limitN), error: null };
    };
    return {
      order(column: string, opts: { ascending: boolean }) {
        calls.orders?.push({ column, opts });
        return builder(brandIds, [...criteria, { column, opts }], cursorFilter, limitN);
      },
      or(filter: string) {
        calls.ors?.push(filter);
        return builder(brandIds, criteria, filter, limitN);
      },
      limit(n: number) {
        return builder(brandIds, criteria, cursorFilter, n);
      },
      then(resolve: (value: { data: unknown; error: unknown }) => void) {
        return Promise.resolve(compute()).then(resolve);
      },
    };
  };
  const fake = {
    from(table: string) {
      expect(table).toBe("shoot_portfolio_view");
      if (calls.froms !== undefined) calls.froms.count += 1;
      return {
        select(columns: string) {
          calls.selects?.push(columns);
          return {
            in(column: string, brandIds: string[]) {
              expect(column).toBe("brand_id");
              return builder(brandIds);
            },
          };
        },
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

/** Combined fake for the detail path: view preauth + get_shoot_detail rpc. */
function fakeDetailSupabase(options: {
  viewRowsByBrandId: Record<string, { id: string }[]>;
  rpcPayload?: unknown;
  rpcError?: unknown;
  viewError?: unknown;
  rpcCalls?: { count: number };
}) {
  const fake = {
    from(table: string) {
      expect(table).toBe("shoot_portfolio_view");
      return {
        select() {
          return {
            eq(column: string, value: string) {
              expect(column).toBe("id");
              return {
                in(column: string, brandIds: string[]) {
                  expect(column).toBe("brand_id");
                  return {
                    limit(n: number) {
                      if (options.viewError) {
                        return Promise.resolve({ data: null, error: options.viewError });
                      }
                      const rows = brandIds.flatMap((id) => options.viewRowsByBrandId[id] ?? []);
                      const found = rows.some((row) => row.id === value);
                      return Promise.resolve({
                        data: found ? [{ id: value }] : [],
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    rpc(fn: string, params: { p_shoot_id: string }) {
      expect(fn).toBe("get_shoot_detail");
      if (options.rpcCalls) options.rpcCalls.count += 1;
      void params;
      if (options.rpcError) return Promise.resolve({ data: null, error: options.rpcError });
      return Promise.resolve({ data: options.rpcPayload ?? null, error: null });
    },
  };
  return fake as unknown as SupabaseClient;
}

const validDetailPayload = {
  shoot: {
    id: SHOOT_A1,
    name: "Summer Beach Editorial",
    status: "planning",
    brief: "Bright, airy beach editorial",
    target_channels: ["instagram_feed", "tiktok"],
    estimated_budget: 12000,
    actual_cost: null,
    currency: "USD",
    budget_breakdown: null,
    start_date: "2026-09-20",
    end_date: "2026-09-22",
    location: "Malibu",
    dna_score: 82,
    mood_board_urls: ["https://example.com/mood1.jpg"],
    cover_url: "https://example.com/cover.jpg",
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-05T10:00:00.000Z",
    brand_id: BRAND_A1,
  },
  brand: { id: BRAND_A1, name: "Brand Alpha" },
  deliverables: [
    { id: "del-1", channel: "instagram_feed", format: "4:5", quantity: 6, status: "planned" },
  ],
  shots: [
    { id: "shot-1", shot_number: 1, description: "Hero shot", style_notes: "Golden hour", status: "captured" },
  ],
  assets: [
    {
      id: "asset-1",
      url: null,
      cloudinary_id: null,
      format: "jpg",
      resource_type: "image",
      width: 4000,
      height: 5000,
      dna_score: null,
      status: "draft",
      created_at: null,
    },
  ],
  crew: [
    {
      id: "crew-1",
      role: "photographer",
      confirmed: false,
      notes: null,
      internal_contact_id: null,
      marketplace_vendor_id: null,
    },
  ],
  approvals: [],
  activity: [],
};

describe("IPI-1067 · SHOOT-001 — listShootsForOrg", () => {
  it("returns only the trusted org's shoots, never another org's", async () => {
    const supabase = fakeShootBrowseSupabase({
      [BRAND_A1]: [browseRow({ id: SHOOT_A1, name: "Org A shoot" })],
      [BRAND_B1]: [browseRow({ id: SHOOT_B1, name: "Org B shoot" })],
    });

    const result = await listShootsForOrg(supabase, [BRAND_A1]);

    expect(result).toEqual({
      ok: true,
      shoots: [
        expect.objectContaining({ id: SHOOT_A1, name: "Org A shoot", brandId: BRAND_A1 }),
      ],
      nextCursor: null,
    });
    if (result.ok) {
      expect(result.shoots.map((s) => s.id)).not.toContain(SHOOT_B1);
    }
  });

  it("orders by updated_at descending then id ascending, in that exact order", async () => {
    const orders: OrderCall[] = [];
    const supabase = fakeShootBrowseSupabase(
      { [BRAND_A1]: [browseRow({ id: SHOOT_A1 })] },
      { orders },
    );

    await listShootsForOrg(supabase, [BRAND_A1]);

    expect(orders).toEqual([
      { column: "updated_at", opts: { ascending: false } },
      { column: "id", opts: { ascending: true } },
    ]);
  });

  it("selects the full browse column set including counts, never cover_url", async () => {
    const selects: string[] = [];
    const supabase = fakeShootBrowseSupabase(
      { [BRAND_A1]: [browseRow({ id: SHOOT_A1 })] },
      { selects },
    );

    await listShootsForOrg(supabase, [BRAND_A1]);

    expect(selects).toEqual([
      "id,name,status,type,brand_id,dna_score,target_channels,updated_at,shot_count,asset_count",
    ]);
    expect(selects[0]).not.toContain("cover_url");
  });

  it("returns an honest empty page for an org with no brands, without querying", async () => {
    const froms = { count: 0 };
    const supabase = fakeShootBrowseSupabase({}, { froms });

    const result = await listShootsForOrg(supabase, []);

    expect(result).toEqual({ ok: true, shoots: [], nextCursor: null });
    expect(froms.count).toBe(0);
  });

  it("keyset-paginates: full page returns a nextCursor, next page continues after it", async () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      browseRow({
        id: `eeeeeeee-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        name: `Shoot ${i + 1}`,
        updated_at: `2026-09-01T${String(10 + Math.floor(i / 6)).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    const ors: string[] = [];
    const supabase = fakeShootBrowseSupabase({ [BRAND_A1]: rows }, { ors });

    const page1 = await listShootsForOrg(supabase, [BRAND_A1]);

    expect(page1.ok).toBe(true);
    if (!page1.ok) return;
    expect(page1.shoots).toHaveLength(SHOOT_BROWSE_PAGE_SIZE);
    expect(page1.nextCursor).not.toBeNull();
    // Newest first: the first row is the latest updated_at (hour 14).
    expect(page1.shoots[0].updatedAt).toBe("2026-09-01T14:00:00.000Z");

    const page2 = await listShootsForOrg(supabase, [BRAND_A1], { after: page1.nextCursor });

    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.shoots).toHaveLength(6);
    expect(page2.nextCursor).toBeNull();
    // No overlap between pages.
    const page1Ids = new Set(page1.shoots.map((s) => s.id));
    expect(page2.shoots.every((s) => !page1Ids.has(s.id))).toBe(true);
    // The cursor filter was actually emitted with the page-1 cursor.
    expect(ors.length).toBeGreaterThan(0);
    const cursor = parseCursorFilter(ors[ors.length - 1]);
    expect(cursor).toEqual(page1.nextCursor);
  });

  it("paginates microsecond timestamps without skipping or duplicating rows", async () => {
    // 23 rows at 10:00:00.000Z + three rows sharing 12:00:00 with distinct
    // microsecond fractions — the exact precision Postgres timestamptz
    // carries. A cursor truncated to milliseconds ('.123Z') would skip the
    // '.123400Z' and '.123000Z' rows on page 2.
    const rows = [
      ...Array.from({ length: 23 }, (_, i) =>
        browseRow({
          id: `aaaaaaaa-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
          name: `Base ${i + 1}`,
          updated_at: "2026-09-08T10:00:00.000Z",
        }),
      ),
      browseRow({
        id: "bbbbbbbb-0000-4000-8000-000000000001",
        name: "Micro 456",
        updated_at: "2026-09-07T12:00:00.123456Z",
      }),
      browseRow({
        id: "bbbbbbbb-0000-4000-8000-000000000002",
        name: "Micro 400",
        updated_at: "2026-09-07T12:00:00.123400Z",
      }),
      browseRow({
        id: "bbbbbbbb-0000-4000-8000-000000000003",
        name: "Micro 000",
        updated_at: "2026-09-07T12:00:00.123000Z",
      }),
    ];
    const supabase = fakeShootBrowseSupabase({ [BRAND_A1]: rows });

    const page1 = await listShootsForOrg(supabase, [BRAND_A1]);

    expect(page1.ok).toBe(true);
    if (!page1.ok) return;
    expect(page1.shoots).toHaveLength(SHOOT_BROWSE_PAGE_SIZE);
    expect(page1.nextCursor).not.toBeNull();
    // The cursor preserves the exact microsecond string — never truncated.
    expect(page1.nextCursor?.updatedAt).toBe("2026-09-07T12:00:00.123456Z");

    const page2 = await listShootsForOrg(supabase, [BRAND_A1], { after: page1.nextCursor });

    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.shoots.map((s) => s.name)).toEqual(["Micro 400", "Micro 000"]);
    expect(page2.nextCursor).toBeNull();
    const page1Ids = new Set(page1.shoots.map((s) => s.id));
    expect(page2.shoots.every((s) => !page1Ids.has(s.id))).toBe(true);
  });

  it("returns nextCursor null when the page is short (no more rows)", async () => {
    const supabase = fakeShootBrowseSupabase({
      [BRAND_A1]: [browseRow({ id: SHOOT_A1 }), browseRow({ id: SHOOT_A2 })],
    });

    const result = await listShootsForOrg(supabase, [BRAND_A1]);

    expect(result).toEqual({
      ok: true,
      shoots: [expect.objectContaining({ id: SHOOT_A1 }), expect.objectContaining({ id: SHOOT_A2 })],
      nextCursor: null,
    });
  });

  it("fails closed when a batch query fails — never a partial page", async () => {
    const supabase = fakeShootBrowseSupabase(
      { [BRAND_A1]: [browseRow({ id: SHOOT_A1 })] },
      {},
      true,
    );

    const result = await listShootsForOrg(supabase, [BRAND_A1]);

    expect(result).toEqual({ ok: false });
  });

  it("merges cross-batch rows by timestamp instant, not string (mixed precision)", async () => {
    const secondBrand = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const supabase = fakeShootBrowseSupabase({
      [BRAND_A1]: [
        browseRow({ id: SHOOT_A1, name: "Micro 123", updated_at: "2026-09-07T12:00:00.123Z" }),
        browseRow({ id: SHOOT_A2, name: "Micro 100", updated_at: "2026-09-07T12:00:00.100Z" }),
      ],
      [secondBrand]: [
        browseRow({ id: SHOOT_B1, name: "Micro 123400", updated_at: "2026-09-07T12:00:00.123400Z" }),
      ],
    });

    const result = await listShootsForOrg(supabase, [BRAND_A1, secondBrand]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Lexically '.123400Z' < '.123Z', but 123400µs > 123000µs — the merge
    // must order by instant, or the cursor predicate skips rows forever.
    expect(result.shoots.map((s) => s.name)).toEqual(["Micro 123400", "Micro 123", "Micro 100"]);
  });

  it("orders years 0000-0099 before 0100 in the merged page (Date.UTC quirk)", async () => {
    const secondBrand = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const supabase = fakeShootBrowseSupabase({
      [BRAND_A1]: [browseRow({ id: SHOOT_A1, name: "Year 99", updated_at: "0099-01-01T00:00:00Z" })],
      [secondBrand]: [
        browseRow({ id: SHOOT_B1, name: "Year 100", updated_at: "0100-01-01T00:00:00Z" }),
      ],
    });

    const result = await listShootsForOrg(supabase, [BRAND_A1, secondBrand]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // PostgreSQL orders 0099 < 0100; Date.UTC would put 0099 after 0100.
    expect(result.shoots.map((s) => s.name)).toEqual(["Year 100", "Year 99"]);
  });

  it("keeps one-microsecond ordering for years 0000-0099 across batches (lossless merge key)", async () => {
    // Epoch microseconds for year 0099 exceed Number.MAX_SAFE_INTEGER, so a
    // number key would compare these two rows equal and fall back to the id
    // tie-break. The newer row carries the LARGER id (ffff… > eeee…), so the
    // lossy tie-break would reverse PostgreSQL order.
    const secondBrand = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const supabase = fakeShootBrowseSupabase({
      [BRAND_A1]: [
        browseRow({ id: SHOOT_B1, name: "Year 99 +1µs", updated_at: "0099-01-01T00:00:00.000001Z" }),
      ],
      [secondBrand]: [
        browseRow({ id: SHOOT_A1, name: "Year 99", updated_at: "0099-01-01T00:00:00.000000Z" }),
      ],
    });

    const result = await listShootsForOrg(supabase, [BRAND_A1, secondBrand]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shoots.map((s) => s.name)).toEqual(["Year 99 +1µs", "Year 99"]);
  });
});

describe("IPI-1067 · SHOOT-001 — preauthorizeShootForOrg", () => {
  it("authorizes a shoot owned by a trusted brand", async () => {
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }] },
    });

    const result = await preauthorizeShootForOrg(supabase, SHOOT_A1, [BRAND_A1]);

    expect(result).toEqual({ ok: true });
  });

  it("denies a foreign-org shoot (brand not in trusted set)", async () => {
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }], [BRAND_B1]: [{ id: SHOOT_B1 }] },
    });

    const result = await preauthorizeShootForOrg(supabase, SHOOT_B1, [BRAND_A1]);

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("denies an unknown shoot id", async () => {
    const supabase = fakeDetailSupabase({ viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }] } });

    const result = await preauthorizeShootForOrg(supabase, SHOOT_A2, [BRAND_A1]);

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("denies when the org has no brands", async () => {
    const supabase = fakeDetailSupabase({ viewRowsByBrandId: {} });

    const result = await preauthorizeShootForOrg(supabase, SHOOT_A1, []);

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("fails closed when the view query fails — never authorizes on a partial scan", async () => {
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }] },
      viewError: new Error("view boom"),
    });

    const result = await preauthorizeShootForOrg(supabase, SHOOT_A1, [BRAND_A1]);

    expect(result).toEqual({ ok: false, reason: "query_failed" });
  });
});

describe("IPI-1067 · SHOOT-001 — hydrateShootDetail", () => {
  it("returns the validated payload for a well-formed RPC response", async () => {
    const supabase = fakeDetailSupabase({ viewRowsByBrandId: {}, rpcPayload: validDetailPayload });

    const result = await hydrateShootDetail(supabase, SHOOT_A1);

    expect(result).toEqual({ ok: true, status: "found", data: validDetailPayload });
  });

  it("fails closed on a malformed payload — never reaches the UI", async () => {
    const malformed = { ...validDetailPayload, shoot: { ...validDetailPayload.shoot, name: 42 } };
    const supabase = fakeDetailSupabase({ viewRowsByBrandId: {}, rpcPayload: malformed });

    const result = await hydrateShootDetail(supabase, SHOOT_A1);

    expect(result).toEqual({ ok: false, status: "malformed" });
  });

  it("fails closed when the payload's shoot id does not match the requested id", async () => {
    const mismatched = {
      ...validDetailPayload,
      shoot: { ...validDetailPayload.shoot, id: SHOOT_A2 },
    };
    const supabase = fakeDetailSupabase({ viewRowsByBrandId: {}, rpcPayload: mismatched });

    const result = await hydrateShootDetail(supabase, SHOOT_A1);

    expect(result).toEqual({ ok: false, status: "malformed" });
  });

  it("maps the RPC not_found (P0002) to not_found", async () => {
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: {},
      rpcError: { code: "P0002", message: "not found" },
    });

    const result = await hydrateShootDetail(supabase, SHOOT_A1);

    expect(result).toEqual({ ok: false, status: "not_found" });
  });

  it("fails closed on any other RPC error", async () => {
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: {},
      rpcError: { code: "42501", message: "permission denied" },
    });

    const result = await hydrateShootDetail(supabase, SHOOT_A1);

    expect(result).toEqual({ ok: false, status: "query_failed" });
  });
});

describe("IPI-1067 · SHOOT-001 — loadShootDetailForOrg (public-contract-first)", () => {
  it("returns the hydrated detail for a trusted-org shoot", async () => {
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }] },
      rpcPayload: validDetailPayload,
    });

    const result = await loadShootDetailForOrg(supabase, SHOOT_A1, [BRAND_A1]);

    expect(result).toEqual({ ok: true, status: "found", data: validDetailPayload });
  });

  it("404s a foreign-org shoot BEFORE hydration — the RPC is never called", async () => {
    const rpcCalls = { count: 0 };
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }], [BRAND_B1]: [{ id: SHOOT_B1 }] },
      rpcPayload: validDetailPayload,
      rpcCalls,
    });

    const result = await loadShootDetailForOrg(supabase, SHOOT_B1, [BRAND_A1]);

    expect(result).toEqual({ ok: false, status: "not_found" });
    expect(rpcCalls.count).toBe(0);
  });

  it("404s an unknown shoot id before hydration", async () => {
    const rpcCalls = { count: 0 };
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }] },
      rpcPayload: validDetailPayload,
      rpcCalls,
    });

    const result = await loadShootDetailForOrg(supabase, SHOOT_A2, [BRAND_A1]);

    expect(result).toEqual({ ok: false, status: "not_found" });
    expect(rpcCalls.count).toBe(0);
  });

  it("404s when the org has no brands (empty trusted set)", async () => {
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }] },
      rpcPayload: validDetailPayload,
    });

    const result = await loadShootDetailForOrg(supabase, SHOOT_A1, []);

    expect(result).toEqual({ ok: false, status: "not_found" });
  });

  it("fails closed when the preauth view query fails — the RPC is never called", async () => {
    const rpcCalls = { count: 0 };
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }] },
      rpcPayload: validDetailPayload,
      viewError: new Error("view boom"),
      rpcCalls,
    });

    const result = await loadShootDetailForOrg(supabase, SHOOT_A1, [BRAND_A1]);

    expect(result).toEqual({ ok: false, status: "query_failed" });
    expect(rpcCalls.count).toBe(0);
  });

  it("404s when the hydrated payload's brand left the trusted set (TOCTOU defense)", async () => {
    const rpcCalls = { count: 0 };
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }] },
      rpcPayload: {
        ...validDetailPayload,
        shoot: { ...validDetailPayload.shoot, brand_id: BRAND_B1 },
        brand: { ...validDetailPayload.brand, id: BRAND_B1 },
      },
      rpcCalls,
    });

    const result = await loadShootDetailForOrg(supabase, SHOOT_A1, [BRAND_A1]);

    expect(result).toEqual({ ok: false, status: "not_found" });
    expect(rpcCalls.count).toBe(1);
  });

  it("fails closed when the hydrated payload's brand object contradicts the shoot's brand (malformed)", async () => {
    const rpcCalls = { count: 0 };
    const supabase = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }] },
      rpcPayload: {
        ...validDetailPayload,
        shoot: { ...validDetailPayload.shoot, brand_id: BRAND_B1 },
      },
      rpcCalls,
    });

    const result = await loadShootDetailForOrg(supabase, SHOOT_A1, [BRAND_A1]);

    expect(result).toEqual({ ok: false, status: "malformed" });
    expect(rpcCalls.count).toBe(1);
  });
});

describe("IPI-1067 · SHOOT-001 — tenant isolation across orgs", () => {
  it("Org A cannot list or open Org B shoots (two-org proof)", async () => {
    const browse = fakeShootBrowseSupabase({
      [BRAND_A1]: [browseRow({ id: SHOOT_A1, name: "Org A shoot" })],
      [BRAND_B1]: [browseRow({ id: SHOOT_B1, name: "Org B shoot" })],
    });

    const list = await listShootsForOrg(browse, [BRAND_A1]);
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.shoots.map((s) => s.id)).toEqual([SHOOT_A1]);
      expect(list.shoots.map((s) => s.id)).not.toContain(SHOOT_B1);
    }

    const detail = fakeDetailSupabase({
      viewRowsByBrandId: { [BRAND_A1]: [{ id: SHOOT_A1 }], [BRAND_B1]: [{ id: SHOOT_B1 }] },
      rpcPayload: validDetailPayload,
    });
    const opened = await loadShootDetailForOrg(detail, SHOOT_B1, [BRAND_A1]);
    expect(opened).toEqual({ ok: false, status: "not_found" });
  });
});
describe("IPI-1067 · SHOOT-001 — cursor serialization", () => {
  const CURSOR = { updatedAt: "2026-09-01T10:00:00.000Z", id: SHOOT_A1 };

  it("round-trips a cursor through encode/decode", () => {
    const encoded = encodeShootListCursor(CURSOR);
    expect(encoded).not.toContain("updatedAt");
    expect(encoded).not.toContain(SHOOT_A1);
    expect(decodeShootListCursor(encoded)).toEqual(CURSOR);
  });

  it("returns null for null/undefined/empty input", () => {
    expect(decodeShootListCursor(null)).toBeNull();
    expect(decodeShootListCursor(undefined)).toBeNull();
    expect(decodeShootListCursor("")).toBeNull();
  });

  it("fails closed on malformed input (bad base64, wrong shape)", () => {
    expect(decodeShootListCursor("not-base64!!")).toBeNull();
    expect(decodeShootListCursor("e30=")).toBeNull(); // "{}"
    expect(decodeShootListCursor(Buffer.from(JSON.stringify({ foo: 1 }), "utf8").toString("base64url"))).toBeNull();
    expect(
      decodeShootListCursor(
        Buffer.from(JSON.stringify({ updatedAt: 42, id: SHOOT_A1 }), "utf8").toString("base64url"),
      ),
    ).toBeNull();
  });

  it("rejects non-ISO timestamps and non-UUID ids before they reach the filter", () => {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
    // Date-only and non-ISO forms are not what cursorFromRow emits.
    expect(decodeShootListCursor(encode({ updatedAt: "2026-09-01", id: SHOOT_A1 }))).toBeNull();
    expect(decodeShootListCursor(encode({ updatedAt: "not-a-date", id: SHOOT_A1 }))).toBeNull();
    expect(
      decodeShootListCursor(encode({ updatedAt: "2026-09-01T10:00:00.000Z", id: "not-a-uuid" })),
    ).toBeNull();
  });

  it("rejects timestamps with impossible calendar dates (e.g. Feb 30)", () => {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
    // Date.parse normalizes these instead of returning NaN — the calendar
    // check must reject them or Postgres rejects the interpolated filter.
    expect(
      decodeShootListCursor(encode({ updatedAt: "2026-02-30T10:00:00Z", id: SHOOT_A1 })),
    ).toBeNull();
    expect(
      decodeShootListCursor(encode({ updatedAt: "2026-04-31T10:00:00Z", id: SHOOT_A1 })),
    ).toBeNull();
  });

  it("accepts valid calendar dates including leap-day", () => {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
    expect(
      decodeShootListCursor(encode({ updatedAt: "2026-02-28T10:00:00Z", id: SHOOT_A1 })),
    ).toEqual({ updatedAt: "2026-02-28T10:00:00Z", id: SHOOT_A1 });
    expect(
      decodeShootListCursor(encode({ updatedAt: "2024-02-29T10:00:00Z", id: SHOOT_A1 })),
    ).toEqual({ updatedAt: "2024-02-29T10:00:00Z", id: SHOOT_A1 });
  });

  it("accepts microsecond, offset, and zero-fraction ISO timestamps", () => {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
    // Postgres timestamptz precision (1-6 fraction digits) and the
    // zero-fraction form PostgREST emits must all round-trip.
    expect(
      decodeShootListCursor(
        encode({ updatedAt: "2026-09-07T12:00:00.123456Z", id: SHOOT_A1 }),
      ),
    ).toEqual({ updatedAt: "2026-09-07T12:00:00.123456Z", id: SHOOT_A1 });
    expect(
      decodeShootListCursor(
        encode({ updatedAt: "2026-09-07T12:00:00.123456+00:00", id: SHOOT_A1 }),
      ),
    ).toEqual({ updatedAt: "2026-09-07T12:00:00.123456+00:00", id: SHOOT_A1 });
    expect(
      decodeShootListCursor(encode({ updatedAt: "2026-09-01T10:00:00Z", id: SHOOT_A1 })),
    ).toEqual({ updatedAt: "2026-09-01T10:00:00Z", id: SHOOT_A1 });
  });

  it("timestampMicros is microsecond-faithful across precision and offsets", () => {
    expect(
      timestampMicros("2026-09-07T12:00:00.123456Z")! -
        timestampMicros("2026-09-07T12:00:00.123000Z")!,
    ).toBe(BigInt(456));
    expect(
      timestampMicros("2026-09-07T12:00:00.123Z")! -
        timestampMicros("2026-09-07T12:00:00.123000Z")!,
    ).toBe(BigInt(0));
    expect(timestampMicros("2026-09-07T12:00:00.123456+00:00")).toBe(
      timestampMicros("2026-09-07T12:00:00.123456Z"),
    );
    expect(timestampMicros("2026-09-07T12:00:00.000000+02:00")).toBe(
      timestampMicros("2026-09-07T10:00:00.000000Z"),
    );
  });

  it("orders years 0000-0099 before 0100 (Date.UTC 0-99 quirk)", () => {
    // Date.UTC(99, 0, 1) is 1999 — the days-from-civil comparator must
    // agree with PostgreSQL, where 0099 < 0100.
    expect(timestampMicros("0099-01-01T00:00:00Z")!).toBeLessThan(
      timestampMicros("0100-01-01T00:00:00Z")!,
    );
    expect(timestampMicros("0000-01-01T00:00:00Z")!).toBeLessThan(
      timestampMicros("0099-01-01T00:00:00Z")!,
    );
  });

  it("keeps one-microsecond ordering for years 0000-0099 (lossless merge key)", () => {
    // Epoch microseconds for year 0099 exceed Number.MAX_SAFE_INTEGER, so a
    // number key would compare these two instants equal and the merge sort
    // would fall back to the id tie-break, reversing PostgreSQL order.
    expect(timestampMicros("0099-01-01T00:00:00.000001Z")!).toBeGreaterThan(
      timestampMicros("0099-01-01T00:00:00.000000Z")!,
    );
  });
});
