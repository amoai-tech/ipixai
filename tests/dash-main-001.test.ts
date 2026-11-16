import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  buildHeroGreeting,
  countOrgShoots,
  loadOrgBrands,
  loadOrgShoots,
  loadTrustedBrandIds,
  loadUpcomingShoots,
} from "@/lib/dashboard/command-center";

const ORG_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ORG_B = "bbbbbbbb-0000-4000-8000-000000000002";
const BRAND_A1 = "cccccccc-0000-4000-8000-000000000001";
const BRAND_B1 = "dddddddd-0000-4000-8000-000000000002";

type OrderCall = { column: string; opts: { ascending: boolean } };

/** Mimics supabase-js chained builder, scoped by the `eq("org_id", …)` call.
 *  `order` is chainable (production calls `.order().order().limit()` for a
 *  deterministic created_at + id sort) and every call is recorded so tests
 *  can assert the exact sort contract, not just that ordering happened.
 *  Cast to `SupabaseClient` at the boundary — loadOrgBrands is typed with
 *  the real client, not a shadow interface, so the fake only needs to
 *  satisfy the shape actually called at runtime. */
function fakeSupabase(
  rowsByOrg: Record<string, { id: string; name: string | null }[]>,
  orderCalls: OrderCall[] = [],
) {
  const orderBuilder = (value: string) => ({
    order: (column: string, opts: { ascending: boolean }) => {
      orderCalls.push({ column, opts });
      return orderBuilder(value);
    },
    limit(n: number) {
      return Promise.resolve({
        data: (rowsByOrg[value] ?? []).slice(0, n),
        error: null,
      });
    },
  });
  const fake = {
    from(table: string) {
      expect(table).toBe("brands");
      return {
        select() {
          return {
            eq(column: string, value: string) {
              expect(column).toBe("org_id");
              return orderBuilder(value);
            },
          };
        },
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

/** Mimics the keyset-paginated `brands` read `loadTrustedBrandIds` makes
 *  (`select("id").eq("org_id", …).order("id", …)[.gt("id", afterId)].limit(n)`,
 *  called repeatedly — cursor re-anchored on the last id seen — until a page
 *  comes back shorter than the page size). `pageCalls`, when passed, records
 *  each page's cursor (`null` for the first page) so tests can assert the
 *  cursor actually advances instead of asserting a fixed offset range — a
 *  stale offset is exactly what makes `.range()` pagination unsafe against
 *  concurrent inserts/deletes. `orderCalls`, when passed, records the
 *  `.order()` call(s) so a test can assert deterministic ordering is
 *  actually requested. */
function fakeBrandIdsSupabase(
  rowsByOrg: Record<string, { id: string }[]>,
  pageCalls?: (string | null)[],
  orderCalls?: OrderCall[],
) {
  const fake = {
    from(table: string) {
      expect(table).toBe("brands");
      return {
        select() {
          return {
            eq(column: string, value: string) {
              expect(column).toBe("org_id");
              const rows = rowsByOrg[value] ?? [];
              const builder = (afterId: string | null) => ({
                order(column: string, opts: { ascending: boolean }) {
                  orderCalls?.push({ column, opts });
                  return builder(afterId);
                },
                gt(column: string, gtValue: string) {
                  expect(column).toBe("id");
                  return builder(gtValue);
                },
                limit(n: number) {
                  pageCalls?.push(afterId);
                  const startIndex =
                    afterId === null ? 0 : rows.findIndex((row) => row.id === afterId) + 1;
                  return Promise.resolve({
                    data: rows.slice(startIndex, startIndex + n),
                    error: null,
                  });
                },
              });
              return builder(null);
            },
          };
        },
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

/** Mimics the `shoot_portfolio_view` read `loadOrgShoots` makes, scoped by
 *  `.in("brand_id", brandIds)` rather than `.eq()`. */
type ShootRow = {
  id: string;
  name: string | null;
  status: string | null;
  cover_url?: string | null;
  dna_score?: number | null;
  target_channels?: string[] | null;
  updated_at?: string | null;
};

function fakeShootsSupabase(
  rowsByBrandId: Record<string, ShootRow[]>,
  orderCalls: OrderCall[] = [],
  selectCalls: string[] = [],
) {
  // Applies the accumulated .order() criteria before truncating to n — a
  // real DB sorts before LIMIT, and loadOrgShoots's batching fix depends
  // on each batch actually being sorted (it merges each batch's own top
  // SHOOT_LIMIT, so a fake that returns unsorted rows would make a
  // cross-batch merge test meaningless).
  const orderBuilder = (brandIds: string[], criteria: OrderCall[] = []) => ({
    order: (column: string, opts: { ascending: boolean }) => {
      const call = { column, opts };
      orderCalls.push(call);
      return orderBuilder(brandIds, [...criteria, call]);
    },
    limit(n: number) {
      // brand_id comes from the grouping key, same as the real
      // `.in("brand_id", brandIds)` read — individual ShootRow fixtures
      // don't need to repeat it.
      const rows = brandIds.flatMap((id) =>
        (rowsByBrandId[id] ?? []).map((row) => ({ ...row, brand_id: id })),
      );
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
      return Promise.resolve({ data: sorted.slice(0, n), error: null });
    },
  });
  const fake = {
    from(table: string) {
      expect(table).toBe("shoot_portfolio_view");
      return {
        select(columns: string) {
          selectCalls.push(columns);
          return {
            in(column: string, brandIds: string[]) {
              expect(column).toBe("brand_id");
              return orderBuilder(brandIds);
            },
          };
        },
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

describe("loadOrgBrands", () => {
  it("returns only the trusted org's brands, never another org's", async () => {
    const supabase = fakeSupabase({
      [ORG_A]: [{ id: "brand-a1", name: "Brand Alpha" }],
      [ORG_B]: [{ id: "brand-b1", name: "Brand Beta" }],
    });

    const resultA = await loadOrgBrands(supabase, ORG_A);
    expect(resultA).toEqual({
      ok: true,
      brands: [{ id: "brand-a1", name: "Brand Alpha" }],
    });

    const resultB = await loadOrgBrands(supabase, ORG_B);
    expect(resultB).toEqual({
      ok: true,
      brands: [{ id: "brand-b1", name: "Brand Beta" }],
    });

    if (resultA.ok) {
      expect(resultA.brands.map((b) => b.id)).not.toContain("brand-b1");
    }
  });

  it("orders by created_at descending then id ascending, in that exact order", async () => {
    const orderCalls: OrderCall[] = [];
    const supabase = fakeSupabase({ [ORG_A]: [{ id: "brand-a1", name: "Brand Alpha" }] }, orderCalls);

    await loadOrgBrands(supabase, ORG_A);

    // Fails if a sort clause is removed, reversed, or the two are swapped —
    // both the column/direction and the call order are asserted.
    expect(orderCalls).toEqual([
      { column: "created_at", opts: { ascending: false } },
      { column: "id", opts: { ascending: true } },
    ]);
  });

  it("caps results at 6 brands even when more are available", async () => {
    const sevenBrands = Array.from({ length: 7 }, (_, i) => ({
      id: `brand-a${i + 1}`,
      name: `Brand ${i + 1}`,
    }));
    const supabase = fakeSupabase({ [ORG_A]: sevenBrands });

    const result = await loadOrgBrands(supabase, ORG_A);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brands).toHaveLength(6);
      expect(result.brands.map((b) => b.id)).not.toContain("brand-a7");
    }
  });

  it("returns ok:false on a Supabase error instead of throwing or faking data", async () => {
    const errorBuilder = {
      order: () => errorBuilder,
      limit: () => Promise.resolve({ data: null, error: new Error("boom") }),
    };
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => errorBuilder,
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(loadOrgBrands(supabase, ORG_A)).resolves.toEqual({ ok: false });
  });

  it("returns ok:false instead of throwing when the client itself throws", async () => {
    const supabase = {
      from: () => {
        throw new Error("network down");
      },
    } as unknown as SupabaseClient;

    await expect(loadOrgBrands(supabase, ORG_A)).resolves.toEqual({ ok: false });
  });

  it("falls back to a placeholder name for a null brand name rather than rendering blank", async () => {
    const supabase = fakeSupabase({ [ORG_A]: [{ id: "brand-a1", name: null }] });
    const result = await loadOrgBrands(supabase, ORG_A);
    expect(result).toEqual({ ok: true, brands: [{ id: "brand-a1", name: "Untitled brand" }] });
  });
});

describe("loadTrustedBrandIds", () => {
  it("returns only the trusted org's brand ids, uncapped by the 6-brand display limit", async () => {
    const eightBrandIds = Array.from({ length: 8 }, (_, i) => ({ id: `brand-a${i + 1}` }));
    const supabase = fakeBrandIdsSupabase({ [ORG_A]: eightBrandIds, [ORG_B]: [{ id: "brand-b1" }] });

    const resultA = await loadTrustedBrandIds(supabase, ORG_A);
    expect(resultA.ok).toBe(true);
    if (resultA.ok) {
      expect(resultA.brandIds).toHaveLength(8);
      expect(resultA.brandIds).not.toContain("brand-b1");
    }
  });

  it("paginates past a single page (500) instead of silently truncating the scope", async () => {
    // 500 (page size) + 1 spans two pages — page 1 full, page 2 has exactly
    // the remainder. A single-`.limit()` read would drop this last id.
    const manyBrandIds = Array.from({ length: 501 }, (_, i) => ({ id: `brand-a${i + 1}` }));
    const pageCalls: (string | null)[] = [];
    const supabase = fakeBrandIdsSupabase({ [ORG_A]: manyBrandIds }, pageCalls);

    const result = await loadTrustedBrandIds(supabase, ORG_A);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brandIds).toHaveLength(501);
      expect(result.brandIds).toContain("brand-a501");
    }
    // Cursor for page 2 is the last id page 1 actually returned — not a
    // fixed offset, which is exactly what makes this safe against
    // concurrent inserts/deletes shifting the scan.
    expect(pageCalls).toEqual([null, "brand-a500"]);
  });

  it("orders by id — keyset pagination needs a stable sort to page against", async () => {
    const orderCalls: OrderCall[] = [];
    const supabase = fakeBrandIdsSupabase(
      { [ORG_A]: [{ id: "brand-a1" }] },
      undefined,
      orderCalls,
    );

    await loadTrustedBrandIds(supabase, ORG_A);

    expect(orderCalls).toEqual([{ column: "id", opts: { ascending: true } }]);
  });

  it("dedupes brand ids if a page ever overlaps the previous one anyway", async () => {
    // Keyset pagination (.gt("id", afterId)) is immune to the classic
    // offset-shift-on-mutation bug .range() has, but this proves the Set
    // dedupe is still a real safety net — not just decoration — if a
    // response ever overlaps regardless of the cursor (a misbehaving
    // backend, a retried request, etc.).
    let call = 0;
    const builder = (): { order: () => unknown; gt: () => unknown; limit: (n: number) => unknown } => ({
      order: () => builder(),
      gt: () => builder(),
      limit: (n: number) => {
        call += 1;
        if (call === 1) {
          return Promise.resolve({
            data: Array.from({ length: n }, (_, i) => ({ id: `brand-${i}` })),
            error: null,
          });
        }
        // Ignores the cursor and returns an id already seen on page 1.
        return Promise.resolve({ data: [{ id: "brand-499" }], error: null });
      },
    });
    const supabase = {
      from: () => ({ select: () => ({ eq: () => builder() }) }),
    } as unknown as SupabaseClient;

    const result = await loadTrustedBrandIds(supabase, ORG_A);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const occurrences = result.brandIds.filter((id) => id === "brand-499").length;
      expect(occurrences).toBe(1);
    }
  });

  it("refuses a partial scope instead of returning ok:true when the org exceeds the page-count ceiling", async () => {
    // Every page comes back completely full, forever — this must give up
    // and fail rather than loop indefinitely or hand back a truncated list.
    const builder = (): { order: () => unknown; gt: () => unknown; limit: (n: number) => unknown } => ({
      order: () => builder(),
      gt: () => builder(),
      limit: (n: number) =>
        Promise.resolve({
          data: Array.from({ length: n }, (_, i) => ({ id: `brand-${i}` })),
          error: null,
        }),
    });
    const supabase = {
      from: () => ({ select: () => ({ eq: () => builder() }) }),
    } as unknown as SupabaseClient;

    await expect(loadTrustedBrandIds(supabase, ORG_A)).resolves.toEqual({ ok: false });
  });

  it("returns ok:false on a Supabase error", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({ limit: () => Promise.resolve({ data: null, error: new Error("boom") }) }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(loadTrustedBrandIds(supabase, ORG_A)).resolves.toEqual({ ok: false });
  });
});

describe("loadOrgShoots", () => {
  it("returns ok:true with an empty list, no query, when there are no trusted brand ids", async () => {
    let called = false;
    const supabase = {
      from: () => {
        called = true;
        throw new Error("should not be called for an empty brandIds list");
      },
    } as unknown as SupabaseClient;

    const result = await loadOrgShoots(supabase, []);
    expect(result).toEqual({ ok: true, shoots: [] });
    expect(called).toBe(false);
  });

  const EMPTY_MEDIA = { dnaScore: null, channel: null };

  it("scopes shoots to only the given trusted brand ids, never another brand's", async () => {
    const supabase = fakeShootsSupabase({
      [BRAND_A1]: [{ id: "shoot-a1", name: "Shoot Alpha", status: "in_progress" }],
      [BRAND_B1]: [{ id: "shoot-b1", name: "Shoot Beta", status: "in_progress" }],
    });

    const result = await loadOrgShoots(supabase, [BRAND_A1]);
    expect(result).toEqual({
      ok: true,
      shoots: [
        { id: "shoot-a1", name: "Shoot Alpha", status: "in_progress", brandId: BRAND_A1, ...EMPTY_MEDIA },
      ],
    });
    if (result.ok) {
      expect(result.shoots.map((s) => s.id)).not.toContain("shoot-b1");
    }
  });

  it("maps real dna_score/target_channels through, without fabricating either", async () => {
    const supabase = fakeShootsSupabase({
      [BRAND_A1]: [
        {
          id: "shoot-a1",
          name: "Shoot Alpha",
          status: "active",
          dna_score: 91,
          target_channels: ["IG", "TikTok"],
        },
      ],
    });

    const result = await loadOrgShoots(supabase, [BRAND_A1]);
    expect(result).toEqual({
      ok: true,
      shoots: [
        {
          id: "shoot-a1",
          name: "Shoot Alpha",
          status: "active",
          brandId: BRAND_A1,
          dnaScore: 91,
          // First target channel only — the meta line shows one channel, not a list.
          channel: "IG",
        },
      ],
    });
  });

  it("does not select or map cover_url — no proven secure-delivery path for it yet", async () => {
    // Two boundaries, both asserted: the query itself must not ask for
    // cover_url (a leftover row column proves nothing about the real
    // select() string), and even if it somehow came back, the mapped
    // DashboardShoot must not surface it (see command-center.ts's doc
    // comment on loadOrgShoots — blocked on IPI-1112 · CLD-DELIVERY-001).
    // updated_at IS selected now (needed to re-sort merged batches — see
    // the "still selects/orders by updated_at" test below) but still
    // never exposed on the mapped result, asserted here too.
    const selectCalls: string[] = [];
    const supabase = fakeShootsSupabase(
      {
        [BRAND_A1]: [
          {
            id: "shoot-a1",
            name: "Shoot Alpha",
            status: "active",
            cover_url: "https://res.cloudinary.com/demo/image/upload/shoot-a1.jpg",
          },
        ],
      },
      undefined,
      selectCalls,
    );

    const result = await loadOrgShoots(supabase, [BRAND_A1]);

    expect(selectCalls).toHaveLength(1);
    expect(selectCalls[0]).not.toMatch(/\bcover_url\b/);
    expect(result).toEqual({
      ok: true,
      shoots: [
        { id: "shoot-a1", name: "Shoot Alpha", status: "active", brandId: BRAND_A1, ...EMPTY_MEDIA },
      ],
    });
    if (result.ok) {
      expect(result.shoots[0]).not.toHaveProperty("coverUrl");
      expect(result.shoots[0]).not.toHaveProperty("updatedAt");
    }
  });

  it("maps a shoot with no real media/score to nulls, never a fabricated placeholder", async () => {
    const supabase = fakeShootsSupabase({
      [BRAND_A1]: [{ id: "shoot-a1", name: "Shoot Alpha", status: "planning" }],
    });

    const result = await loadOrgShoots(supabase, [BRAND_A1]);
    expect(result).toEqual({
      ok: true,
      shoots: [
        { id: "shoot-a1", name: "Shoot Alpha", status: "planning", brandId: BRAND_A1, ...EMPTY_MEDIA },
      ],
    });
  });

  it("reads shoot_portfolio_view, not raw shoot.shoots", async () => {
    const supabase = fakeShootsSupabase({ [BRAND_A1]: [] });
    // fakeShootsSupabase itself asserts the table name; a wrong table would
    // throw inside from() before this resolves.
    await expect(loadOrgShoots(supabase, [BRAND_A1])).resolves.toEqual({ ok: true, shoots: [] });
  });

  it("orders by updated_at descending then id ascending, in that exact order", async () => {
    const orderCalls: OrderCall[] = [];
    const supabase = fakeShootsSupabase(
      { [BRAND_A1]: [{ id: "shoot-a1", name: "Shoot Alpha", status: null }] },
      orderCalls,
    );

    await loadOrgShoots(supabase, [BRAND_A1]);

    expect(orderCalls).toEqual([
      { column: "updated_at", opts: { ascending: false } },
      { column: "id", opts: { ascending: true } },
    ]);
  });

  it("caps results at 6 shoots even when more are available", async () => {
    const sevenShoots = Array.from({ length: 7 }, (_, i) => ({
      id: `shoot-a${i + 1}`,
      name: `Shoot ${i + 1}`,
      status: "in_progress",
    }));
    const supabase = fakeShootsSupabase({ [BRAND_A1]: sevenShoots });

    const result = await loadOrgShoots(supabase, [BRAND_A1]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shoots).toHaveLength(6);
      expect(result.shoots.map((s) => s.id)).not.toContain("shoot-a7");
    }
  });

  it("returns ok:false on a Supabase error instead of throwing or faking data", async () => {
    const errorBuilder = {
      order: () => errorBuilder,
      limit: () => Promise.resolve({ data: null, error: new Error("boom") }),
    };
    const supabase = {
      from: () => ({
        select: () => ({
          in: () => errorBuilder,
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(loadOrgShoots(supabase, [BRAND_A1])).resolves.toEqual({ ok: false });
  });

  it("returns ok:false instead of throwing when the client itself throws", async () => {
    const supabase = {
      from: () => {
        throw new Error("network down");
      },
    } as unknown as SupabaseClient;

    await expect(loadOrgShoots(supabase, [BRAND_A1])).resolves.toEqual({ ok: false });
  });

  it("falls back to a placeholder name for a null shoot name rather than rendering blank", async () => {
    const supabase = fakeShootsSupabase({ [BRAND_A1]: [{ id: "shoot-a1", name: null, status: null }] });
    const result = await loadOrgShoots(supabase, [BRAND_A1]);
    expect(result).toEqual({
      ok: true,
      shoots: [
        { id: "shoot-a1", name: "Untitled shoot", status: null, brandId: BRAND_A1, ...EMPTY_MEDIA },
      ],
    });
  });

  it("still orders by updated_at for sort, even though it's not in the mapped result", async () => {
    // updated_at is selected now (needed to re-sort merged batches) but
    // still ordered on server-side too, and never exposed on the mapped
    // result regardless of where it's read from.
    const orderCalls: OrderCall[] = [];
    const supabase = fakeShootsSupabase(
      { [BRAND_A1]: [{ id: "shoot-a1", name: "Shoot Alpha", status: null }] },
      orderCalls,
    );
    const result = await loadOrgShoots(supabase, [BRAND_A1]);
    expect(orderCalls[0]).toEqual({ column: "updated_at", opts: { ascending: false } });
    if (result.ok) {
      expect(result.shoots[0]).not.toHaveProperty("updatedAt");
    }
  });

  it("merges shoots across brand-id batches and returns the true top SHOOT_LIMIT by updated_at", async () => {
    // Enough brand ids to force multiple underlying batches (same
    // batching countOrgShoots uses, for the same URL-size reason), each
    // contributing one shoot with a distinct, increasing updated_at — the
    // most-recently-updated SHOOT_LIMIT shoots are deliberately the very
    // last ones generated, spilling into whichever batch runs last. A bug
    // that returned only the first batch's own top SHOOT_LIMIT (instead
    // of merging every batch before re-slicing) would return the wrong,
    // stale shoots entirely.
    const brandIds = Array.from({ length: 1000 }, (_, i) => `brand-${String(i).padStart(4, "0")}`);
    const rowsByBrandId: Record<string, ShootRow[]> = {};
    brandIds.forEach((id, i) => {
      rowsByBrandId[id] = [
        {
          id: `shoot-${String(i).padStart(4, "0")}`,
          name: `Shoot ${i}`,
          status: "active",
          updated_at: new Date(2020, 0, 1 + i).toISOString(),
        },
      ];
    });
    const supabase = fakeShootsSupabase(rowsByBrandId);

    const result = await loadOrgShoots(supabase, brandIds);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shoots.map((s) => s.id)).toEqual([
        "shoot-0999",
        "shoot-0998",
        "shoot-0997",
        "shoot-0996",
        "shoot-0995",
        "shoot-0994",
      ]);
    }
  });

  it("returns ok:false on a failure partway through a large brand-id list — never a partial result", async () => {
    const brandIds = Array.from({ length: 1000 }, (_, i) => `brand-${i}`);
    let queryCount = 0;
    const builderFor = (ids: string[]) => ({
      order: () => builderFor(ids),
      limit: () => {
        queryCount += 1;
        if (queryCount === 2) {
          return Promise.resolve({ data: null, error: new Error("boom") });
        }
        return Promise.resolve({
          data: ids.map((id) => ({
            id,
            name: id,
            status: "active",
            brand_id: id,
            dna_score: null,
            target_channels: null,
            updated_at: new Date().toISOString(),
          })),
          error: null,
        });
      },
    });
    const supabase = {
      from: () => ({
        select: () => ({
          in: (_column: string, ids: string[]) => builderFor(ids),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(loadOrgShoots(supabase, brandIds)).resolves.toEqual({ ok: false });
    expect(queryCount).toBeGreaterThan(1);
  });

  it("never returns a duplicate shoot when the brand-id list has a duplicate straddling a batch boundary", async () => {
    // 250 distinct ids (batch size is 200) plus one repeat of the very
    // first id, placed near the end — if the batching helper didn't
    // dedupe before chunking, "brand-0" would land in both batch 1
    // (ids 0-199) and batch 2 (ids 200-249, plus this repeat), and its
    // one real shoot would be fetched — and returned — twice.
    const brandIds = [...Array.from({ length: 250 }, (_, i) => `brand-${i}`), "brand-0"];
    const rowsByBrandId: Record<string, ShootRow[]> = {
      "brand-0": [{ id: "shoot-only", name: "Only Shoot", status: "active" }],
    };
    const supabase = fakeShootsSupabase(rowsByBrandId);

    const result = await loadOrgShoots(supabase, brandIds);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shoots.map((s) => s.id)).toEqual(["shoot-only"]);
    }
  });
});

/** Mimics the head-only shoot count read countOrgShoots makes against
 *  shoot_portfolio_view, scoped by brand id. Asserts observable behavior:
 *  which column the filter actually scopes on (brand_id is the real
 *  tenant/org-isolation boundary here — filtering on the wrong column is a
 *  real bug, not an implementation detail), which ids got queried (in
 *  aggregate, across however many underlying calls that takes), and the
 *  count each id contributes. Also asserts count:"exact" and head:true —
 *  not internal-shape noise, but the two options that make this a real,
 *  precise total rather than Postgres's approximate/estimated count or a
 *  full row fetch; either drifting would be a real regression this test
 *  should catch. Doesn't assert a specific batch count/size, so tuning
 *  BRAND_ID_FILTER_BATCH_SIZE or BATCH_CONCURRENCY doesn't break this. */
function fakeCountSupabase(countByBrandId: Record<string, number>, queriedIds: string[][] = []) {
  const fake = {
    from(table: string) {
      expect(table).toBe("shoot_portfolio_view");
      return {
        select(columns: string, opts: { count: string; head: boolean }) {
          expect(columns).toBe("id");
          expect(opts).toEqual({ count: "exact", head: true });
          return {
            in(column: string, brandIds: string[]) {
              expect(column).toBe("brand_id");
              queriedIds.push(brandIds);
              const count = brandIds.reduce((sum, id) => sum + (countByBrandId[id] ?? 0), 0);
              return Promise.resolve({ data: null, error: null, count });
            },
          };
        },
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

describe("countOrgShoots", () => {
  it("returns ok:true with count 0, no query, when there are no trusted brand ids", async () => {
    let called = false;
    const supabase = {
      from: () => {
        called = true;
        throw new Error("should not be called for an empty brandIds list");
      },
    } as unknown as SupabaseClient;

    await expect(countOrgShoots(supabase, [])).resolves.toEqual({ ok: true, count: 0 });
    expect(called).toBe(false);
  });

  it("counts only the given trusted brand ids' shoots, never another brand's", async () => {
    const queriedIds: string[][] = [];
    const supabase = fakeCountSupabase({ [BRAND_A1]: 3, [BRAND_B1]: 5 }, queriedIds);

    const result = await countOrgShoots(supabase, [BRAND_A1]);
    expect(result).toEqual({ ok: true, count: 3 });
    expect(queriedIds.flat()).toEqual([BRAND_A1]);
  });

  it("does not cap the count at SHOOT_LIMIT — this is the real total, unlike loadOrgShoots", async () => {
    const supabase = fakeCountSupabase({ [BRAND_A1]: 42 });
    await expect(countOrgShoots(supabase, [BRAND_A1])).resolves.toEqual({ ok: true, count: 42 });
  });

  it("splits a large brand-id list into safely bounded queries and sums their counts", async () => {
    // loadTrustedBrandIds is uncapped — real orgs can hand this thousands
    // of ids. A single filter carrying all of them risks exceeding
    // Supabase's request URL/header size limit. This proves the total
    // stays correct AND that no single underlying query carries an
    // unsafely large id list — without asserting the exact batch size
    // chosen, so tuning that constant doesn't break this test.
    const manyBrandIds = Array.from({ length: 1000 }, (_, i) => `brand-${i}`);
    const countByBrandId = Object.fromEntries(manyBrandIds.map((id) => [id, 1]));
    const queriedIds: string[][] = [];
    const supabase = fakeCountSupabase(countByBrandId, queriedIds);

    const result = await countOrgShoots(supabase, manyBrandIds);

    expect(result).toEqual({ ok: true, count: 1000 });
    expect(queriedIds.flat().sort()).toEqual([...manyBrandIds].sort());
    for (const idsInOneQuery of queriedIds) {
      expect(idsInOneQuery.length).toBeLessThanOrEqual(300);
    }
  });

  it("returns ok:false on a Supabase error instead of throwing or faking a count", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: null, error: new Error("boom"), count: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(countOrgShoots(supabase, [BRAND_A1])).resolves.toEqual({ ok: false });
  });

  it("returns ok:false on a null count with no error, not just on an explicit error", async () => {
    // Exercises the `count === null` guard on its own — a fixture that
    // always sets both error and count: null (above) would still pass if
    // that guard were ever removed and only the `error` check remained.
    const supabase = {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: null, error: null, count: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(countOrgShoots(supabase, [BRAND_A1])).resolves.toEqual({ ok: false });
  });

  it("returns ok:false on a failure partway through a large list — never a partial count", async () => {
    const manyBrandIds = Array.from({ length: 1000 }, (_, i) => `brand-${i}`);
    let queryCount = 0;
    const supabase = {
      from: () => ({
        select: () => ({
          in: (_column: string, ids: string[]) => {
            queryCount += 1;
            if (queryCount === 2) {
              return Promise.resolve({ data: null, error: new Error("boom"), count: null });
            }
            return Promise.resolve({ data: null, error: null, count: ids.length });
          },
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(countOrgShoots(supabase, manyBrandIds)).resolves.toEqual({ ok: false });
    // Proves this list really was split into more than one query — a
    // single-query implementation could never reach queryCount === 2.
    expect(queryCount).toBeGreaterThan(1);
  });

  it("returns ok:false instead of throwing when the client itself throws", async () => {
    const supabase = {
      from: () => {
        throw new Error("network down");
      },
    } as unknown as SupabaseClient;

    await expect(countOrgShoots(supabase, [BRAND_A1])).resolves.toEqual({ ok: false });
  });
});

describe("buildHeroGreeting", () => {
  it("headlines with the real brand name", () => {
    const { headline } = buildHeroGreeting({ brandName: "Majji" });
    expect(headline).toBe("You're working with Majji.");
  });

  it("references the real recent shoot name when present", () => {
    const { subline } = buildHeroGreeting({
      brandName: "Majji",
      recentShootName: "Spring Capsule",
    });
    expect(subline).toBe("Continue planning Spring Capsule.");
  });

  it("never fabricates a next action when nothing real is known", () => {
    const { subline } = buildHeroGreeting({ brandName: "Majji" });
    expect(subline).toBe("Ask the Production Planner what to work on next.");
  });
});

/** IPI-1451: fake for loadUpcomingShoots — applies the real .in/.gte/.order/.limit semantics. */
function fakeUpcomingSupabase(
  rowsByBrandId: Record<string, { id: string; name: string | null; start_date: string; location: string | null }[]>,
  fail = false,
) {
  return {
    from(table: string) {
      expect(table).toBe("shoot_portfolio_view");
      return {
        select: () => ({
          in: (_col: string, brandIds: string[]) => ({
            gte: (col: string, today: string) => {
              expect(col).toBe("start_date");
              const rows = brandIds
                .flatMap((id) => rowsByBrandId[id] ?? [])
                .filter((r) => r.start_date >= today)
                .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : a.id < b.id ? -1 : 1));
              const chain = {
                order: () => chain,
                limit: (n: number) =>
                  Promise.resolve(fail ? { data: null, error: { message: "boom" } } : { data: rows.slice(0, n), error: null }),
              };
              return chain;
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("loadUpcomingShoots", () => {
  const today = "2026-11-16";
  const rows = {
    [BRAND_A1]: [
      { id: "past", name: "Past", start_date: "2026-11-01", location: null },
      { id: "s3", name: "Holiday", start_date: "2026-12-03", location: "Studio B" },
      { id: "s1", name: "Today", start_date: "2026-11-16", location: "Miami" },
      { id: "s2", name: null, start_date: "2026-11-24", location: null },
      { id: "s4", name: "Later", start_date: "2027-01-10", location: null },
    ],
    [BRAND_B1]: [{ id: "other-org", name: "Org B shoot", start_date: "2026-11-17", location: null }],
  };

  it("returns only the trusted brands' future-dated shoots, soonest first, capped at 3", async () => {
    const result = await loadUpcomingShoots(fakeUpcomingSupabase(rows), [BRAND_A1], today);
    expect(result).toEqual({
      ok: true,
      shoots: [
        { id: "s1", name: "Today", startDate: "2026-11-16", location: "Miami" },
        { id: "s2", name: "Untitled shoot", startDate: "2026-11-24", location: null },
        { id: "s3", name: "Holiday", startDate: "2026-12-03", location: "Studio B" },
      ],
    });
  });

  it("short-circuits to empty with no trusted brands, and fails closed on a query error", async () => {
    expect(await loadUpcomingShoots(fakeUpcomingSupabase(rows), [], today)).toEqual({ ok: true, shoots: [] });
    expect(await loadUpcomingShoots(fakeUpcomingSupabase(rows, true), [BRAND_A1], today)).toEqual({ ok: false });
  });
});
