import { beforeEach, describe, expect, it, vi } from "vitest";

// IPI-1093 · BRAND-INTEL-001 — Brand Detail review-card server actions.
// Only the wiring is under test here: does it gate on a missing session,
// does it forward exactly the caller-supplied draftHash unchanged (the
// exact-artifact contract), and does it scope requestToken to the call so
// the underlying tool sees the operator's real access token. The tools
// themselves (approveDraft/startBrandAnalysis) are already covered by
// tests/brand-intelligence-tools.test.ts — not re-tested here.

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createClient: vi.fn(),
  approveDraftExecute: vi.fn(),
  startBrandAnalysisExecute: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/mastra/tools/brand-intelligence", () => ({
  approveDraft: { execute: mocks.approveDraftExecute },
  startBrandAnalysis: { execute: mocks.startBrandAnalysisExecute },
}));

import { requestToken } from "@/lib/request-token";
import { decideBrandDraft, startBrandAnalysisAction } from "@/app/app/brands/[brandId]/actions";

const BRAND_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({
    auth: { getSession: mocks.getSession },
  });
});

describe("decideBrandDraft", () => {
  it("does not call the tool when there is no session (unauthenticated denied)", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    const result = await decideBrandDraft(BRAND_ID, "H1", true);

    expect(mocks.approveDraftExecute).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
    expect(result.message).toMatch(/not authenticated/i);
  });

  it("forwards the exact caller-supplied draftHash unchanged, scoped to the session's access token", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "op-token" } } });
    mocks.approveDraftExecute.mockImplementation(async () => {
      // The tool call must happen inside requestToken.run with this
      // session's token — assert the store from inside the mocked tool,
      // the same way the real tool reads it.
      expect(requestToken.getStore()).toBe("op-token");
      return { ok: true, approved: true, message: "Draft approved." };
    });

    const result = await decideBrandDraft(BRAND_ID, "H1-reviewed", true);

    expect(mocks.approveDraftExecute).toHaveBeenCalledWith(
      { brandId: BRAND_ID, draftHash: "H1-reviewed", approved: true },
      expect.anything(),
    );
    expect(result).toMatchObject({ ok: true, approved: true });
  });

  it("surfaces a thrown error as a failed result instead of crashing the action", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "op-token" } } });
    mocks.approveDraftExecute.mockRejectedValue(new Error("cross-tenant run binding"));

    const result = await decideBrandDraft(BRAND_ID, "H1", false);

    expect(result).toMatchObject({ ok: false });
    expect(result.message).toMatch(/cross-tenant run binding/);
  });
});

describe("startBrandAnalysisAction", () => {
  it("does not call the tool when there is no session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    const result = await startBrandAnalysisAction(BRAND_ID);

    expect(mocks.startBrandAnalysisExecute).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });

  it("starts analysis scoped to the session's access token", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "op-token" } } });
    mocks.startBrandAnalysisExecute.mockImplementation(async () => {
      expect(requestToken.getStore()).toBe("op-token");
      return { runId: "run-1", message: "Brand analysis started." };
    });

    const result = await startBrandAnalysisAction(BRAND_ID);

    expect(mocks.startBrandAnalysisExecute).toHaveBeenCalledWith({ brandId: BRAND_ID }, expect.anything());
    expect(result).toMatchObject({ ok: true, message: "Brand analysis started." });
  });
});
