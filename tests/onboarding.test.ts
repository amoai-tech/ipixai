import { describe, expect, it, vi } from "vitest";

import {
  asOnboardingIdempotencyKey,
  asOnboardingSessionId,
  asOnboardingUserId,
  getOrCreateOnboardingIdempotencyKey,
  getOrCreateOnboardingSession,
  hasMaterializedOnboardingSession,
  materializeOnboarding,
  parseDraftAnswers,
  serializeDraftAnswers,
  updateOnboardingSessionDraft,
  validateUrl,
} from "@/lib/onboarding";

describe("validateUrl (IPI-1089 — website optional for tenancy)", () => {
  it("accepts blank (optional)", () => {
    expect(validateUrl("")).toBeNull();
    expect(validateUrl("   ")).toBeNull();
  });

  it("accepts http(s) URLs", () => {
    expect(validateUrl("https://maisonnoir.com")).toBeNull();
    expect(validateUrl("http://maisonnoir.com")).toBeNull();
  });

  it("rejects malformed and non-http(s) URLs", () => {
    expect(validateUrl("not-a-url")).not.toBeNull();
    expect(validateUrl("maisonnoir")).not.toBeNull();
    expect(validateUrl("ftp://maisonnoir.com")).not.toBeNull();
    expect(validateUrl("https://exa mple.com")).not.toBeNull();
  });
});

describe("getOrCreateOnboardingIdempotencyKey", () => {
  it("creates a stable per-user key", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const a = getOrCreateOnboardingIdempotencyKey(asOnboardingUserId("user-1"), storage);
    const b = getOrCreateOnboardingIdempotencyKey(asOnboardingUserId("user-1"), storage);
    expect(a).toBe(b);
    const c = getOrCreateOnboardingIdempotencyKey(asOnboardingUserId("user-2"), storage);
    expect(c).not.toBe(a);
  });

  it("throws without a user id", () => {
    expect(() =>
      getOrCreateOnboardingIdempotencyKey(asOnboardingUserId(""), {} as Storage),
    ).toThrow();
  });

  it("mints distinct keys across separate storage contexts (DB index is the guard)", () => {
    const storeA = new Map<string, string>();
    const storeB = new Map<string, string>();
    const storageA = {
      getItem: (k: string) => storeA.get(k) ?? null,
      setItem: (k: string, v: string) => void storeA.set(k, v),
    };
    const storageB = {
      getItem: (k: string) => storeB.get(k) ?? null,
      setItem: (k: string, v: string) => void storeB.set(k, v),
    };
    const keyA = getOrCreateOnboardingIdempotencyKey(asOnboardingUserId("user-1"), storageA);
    const keyB = getOrCreateOnboardingIdempotencyKey(asOnboardingUserId("user-1"), storageB);
    expect(keyA).not.toBe(keyB);
  });
});

describe("session draft round-trip", () => {
  it("serializes and parses brandName + websiteUrl", () => {
    const raw = serializeDraftAnswers({ brandName: "Maison Noir", websiteUrl: "https://maisonnoir.com" });
    expect(parseDraftAnswers(raw)).toEqual({
      brandName: "Maison Noir",
      websiteUrl: "https://maisonnoir.com",
    });
  });

  it("falls back to empty draft for junk", () => {
    expect(parseDraftAnswers(null)).toEqual({ brandName: "", websiteUrl: "" });
    expect(parseDraftAnswers({ brandName: 42 })).toEqual({ brandName: "", websiteUrl: "" });
  });
});

// IPI-1263 · ONBOARD-COMPAT-001 — draft_answers on live rows can carry keys
// this app version doesn't understand (an earlier onboarding iteration's
// fields, or a future IPI-1260/IPI-1264 lean field). These must never be
// silently dropped by a parse → serialize round trip.
describe("session draft round-trip — legacy/unknown key preservation (IPI-1263)", () => {
  it("preserves unknown legacy keys unchanged through parse then serialize", () => {
    const legacyRaw = {
      brandName: "Maison Noir",
      websiteUrl: "https://maisonnoir.com",
      instagramHandle: "@maisonnoir",
      industry: "fashion",
      goal: "grow-online",
    };
    const parsed = parseDraftAnswers(legacyRaw);
    expect(parsed).toMatchObject({
      brandName: "Maison Noir",
      websiteUrl: "https://maisonnoir.com",
      instagramHandle: "@maisonnoir",
      industry: "fashion",
      goal: "grow-online",
    });
    expect(serializeDraftAnswers(parsed)).toEqual(legacyRaw);
  });

  it("normalizes known fields while leaving unknown keys byte-for-byte unchanged", () => {
    const raw = { brandName: 42, websiteUrl: null, listed: { shopify: true }, grow: "ads" };
    const parsed = parseDraftAnswers(raw);
    expect(parsed).toMatchObject({ brandName: "", websiteUrl: "", listed: { shopify: true }, grow: "ads" });
    expect(serializeDraftAnswers(parsed)).toEqual({
      brandName: "",
      websiteUrl: "",
      listed: { shopify: true },
      grow: "ads",
    });
  });

  it("round-trips a draft with no unknown keys exactly as before (no regression)", () => {
    const raw = { brandName: "Maison Noir", websiteUrl: "" };
    expect(serializeDraftAnswers(parseDraftAnswers(raw))).toEqual(raw);
  });
});

function mockSupabase(): any {
  const calls: { table: string; op: string }[] = [];
  const supabase = {
    calls,
    from: vi.fn(() => supabase),
    select: vi.fn(() => supabase),
    eq: vi.fn(() => supabase),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(() => supabase),
    update: vi.fn(() => supabase),
    rpc: vi.fn(),
  };
  return supabase;
}

describe("getOrCreateOnboardingSession", () => {
  it("returns an existing draft", async () => {
    const supabase = mockSupabase();
    const session = {
      id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      idempotency_key: "key-1",
      status: "draft",
      current_screen: 1,
      draft_answers: {},
      organization_id: null,
      brand_id: null,
    };
    supabase.maybeSingle.mockResolvedValue({ data: session, error: null });
    const result = await getOrCreateOnboardingSession(
      supabase as never,
      asOnboardingUserId(session.user_id),
      asOnboardingIdempotencyKey("key-1"),
    );
    expect(result).toEqual(session);
  });

  it("only selects the caller's own session (user_id filter)", async () => {
    const supabase = mockSupabase();
    const session = {
      id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      idempotency_key: "key-1",
      status: "draft",
      current_screen: 1,
      draft_answers: {},
      organization_id: null,
      brand_id: null,
    };
    supabase.maybeSingle.mockResolvedValue({ data: session, error: null });
    const result = await getOrCreateOnboardingSession(
      supabase as never,
      asOnboardingUserId(session.user_id),
      asOnboardingIdempotencyKey("key-1"),
    );
    expect(result).toEqual(session);
    expect(supabase.eq).toHaveBeenCalledWith("user_id", session.user_id);
    expect(supabase.eq).toHaveBeenCalledWith("idempotency_key", "key-1");
  });

  it("inserts a fresh draft when none exists", async () => {
    const supabase = mockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    supabase.single.mockResolvedValue({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        user_id: "22222222-2222-2222-2222-222222222222",
        idempotency_key: "key-1",
        status: "draft",
        current_screen: 1,
        draft_answers: {},
        organization_id: null,
        brand_id: null,
      },
      error: null,
    });
    const result = await getOrCreateOnboardingSession(
      supabase as never,
      asOnboardingUserId("22222222-2222-2222-2222-222222222222"),
      asOnboardingIdempotencyKey("key-1"),
    );
    expect(result.status).toBe("draft");
    expect(supabase.insert).toHaveBeenCalled();
  });

  it("recovers from a concurrent insert (23505) by re-selecting", async () => {
    const supabase = mockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    const existing = {
      id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      idempotency_key: "key-1",
      status: "draft",
      current_screen: 1,
      draft_answers: {},
      organization_id: null,
      brand_id: null,
    };
    supabase.single
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key" } })
      .mockResolvedValueOnce({ data: existing, error: null });
    const result = await getOrCreateOnboardingSession(
      supabase as never,
      asOnboardingUserId(existing.user_id),
      asOnboardingIdempotencyKey("key-1"),
    );
    expect(result).toEqual(existing);
  });
});

describe("updateOnboardingSessionDraft", () => {
  it("updates draft_answers on the session row", async () => {
    const supabase = mockSupabase();
    supabase.update.mockReturnValue(supabase);
    supabase.eq.mockReturnValue(supabase);
    supabase.single.mockResolvedValue({ data: { id: "session-1" }, error: null });
    await updateOnboardingSessionDraft(supabase as never, asOnboardingSessionId("session-1"), {
      draft_answers: { brandName: "Maison Noir" },
    });
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ draft_answers: { brandName: "Maison Noir" } }),
    );
    expect(supabase.eq).toHaveBeenCalledWith("id", "session-1");
  });

  it("only persists sessions still in draft state", async () => {
    const supabase = mockSupabase();
    supabase.update.mockReturnValue(supabase);
    supabase.eq.mockReturnValue(supabase);
    supabase.single.mockResolvedValue({ data: { id: "session-1" }, error: null });
    await updateOnboardingSessionDraft(supabase as never, asOnboardingSessionId("session-1"), {
      draft_answers: { brandName: "Maison Noir" },
    });
    expect(supabase.eq).toHaveBeenCalledWith("status", "draft");
  });

  it("rejects when the session is no longer in draft state", async () => {
    const supabase = mockSupabase();
    supabase.update.mockReturnValue(supabase);
    supabase.eq.mockReturnValue(supabase);
    supabase.single.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "The result contains 0 rows" },
    });
    await expect(
      updateOnboardingSessionDraft(supabase as never, asOnboardingSessionId("session-1"), {
        draft_answers: { brandName: "Maison Noir" },
      }),
    ).rejects.toThrow("no longer in draft state");
  });
});

describe("hasMaterializedOnboardingSession", () => {
  it("returns true when the user already completed onboarding", async () => {
    const supabase = mockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: { id: "session-1" }, error: null });
    const result = await hasMaterializedOnboardingSession(
      supabase as never,
      asOnboardingUserId("user-1"),
    );
    expect(result).toBe(true);
    expect(supabase.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(supabase.eq).toHaveBeenCalledWith("status", "materialized");
  });

  it("returns false for a user who never completed onboarding", async () => {
    const supabase = mockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await hasMaterializedOnboardingSession(
      supabase as never,
      asOnboardingUserId("user-1"),
    );
    expect(result).toBe(false);
  });

  it("throws when the materialized-session lookup fails", async () => {
    const supabase = mockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: null, error: { message: "db down" } });
    await expect(
      hasMaterializedOnboardingSession(supabase as never, asOnboardingUserId("user-1")),
    ).rejects.toThrow("db down");
  });
});

describe("materializeOnboarding", () => {
  it("calls the existing RPC with trimmed name and null url when blank", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({
      data: {
        organization_id: "33333333-3333-3333-3333-333333333333",
        brand_id: "44444444-4444-4444-4444-444444444444",
      },
      error: null,
    });
    const result = await materializeOnboarding(
      supabase as never,
      { brandName: "  Maison Noir  ", websiteUrl: "" },
      { idempotencyKey: asOnboardingIdempotencyKey("key-1") },
    );
    expect(supabase.rpc).toHaveBeenCalledWith("materialize_onboarding_session", {
      p_idempotency_key: "key-1",
      p_brand_name: "Maison Noir",
      p_brand_url: null,
    });
    expect(result).toEqual({
      orgId: "33333333-3333-3333-3333-333333333333",
      brandId: "44444444-4444-4444-4444-444444444444",
    });
  });

  it("passes a supplied URL through", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({
      data: {
        organization_id: "33333333-3333-3333-3333-333333333333",
        brand_id: "44444444-4444-4444-4444-444444444444",
      },
      error: null,
    });
    await materializeOnboarding(
      supabase as never,
      { brandName: "Maison Noir", websiteUrl: "https://maisonnoir.com" },
      { idempotencyKey: asOnboardingIdempotencyKey("key-1") },
    );
    expect(supabase.rpc).toHaveBeenCalledWith("materialize_onboarding_session", {
      p_idempotency_key: "key-1",
      p_brand_name: "Maison Noir",
      p_brand_url: "https://maisonnoir.com",
    });
  });

  it("throws on RPC error", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "unauthorized" } });
    await expect(
      materializeOnboarding(
        supabase as never,
        { brandName: "Maison Noir", websiteUrl: "" },
        { idempotencyKey: asOnboardingIdempotencyKey("key-1") },
      ),
    ).rejects.toThrow("unauthorized");
  });

  it("fails closed when the RPC returns an incomplete payload", async () => {
    const missingBrandId = mockSupabase();
    missingBrandId.rpc.mockResolvedValue({
      data: { organization_id: "33333333-3333-3333-3333-333333333333" },
      error: null,
    });
    await expect(
      materializeOnboarding(
        missingBrandId as never,
        { brandName: "Maison Noir", websiteUrl: "" },
        { idempotencyKey: asOnboardingIdempotencyKey("key-1") },
      ),
    ).rejects.toThrow("unexpected payload");

    const missingOrgId = mockSupabase();
    missingOrgId.rpc.mockResolvedValue({
      data: { brand_id: "44444444-4444-4444-4444-444444444444" },
      error: null,
    });
    await expect(
      materializeOnboarding(
        missingOrgId as never,
        { brandName: "Maison Noir", websiteUrl: "" },
        { idempotencyKey: asOnboardingIdempotencyKey("key-1") },
      ),
    ).rejects.toThrow("unexpected payload");
  });
});