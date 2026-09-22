import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getVerifiedOperatorForRequest: vi.fn(),
  createClientFromRequest: vi.fn(),
  saveApprovedShoot: vi.fn(),
  rpcCallFromClient: vi.fn(() => vi.fn()),
}));

vi.mock("../src/lib/auth/operator-auth", () => ({
  getVerifiedOperatorForRequest: mocks.getVerifiedOperatorForRequest,
}));
vi.mock("../src/lib/supabase/server", () => ({
  createClientFromRequest: mocks.createClientFromRequest,
}));
vi.mock("../src/lib/shoot/save-approved-shoot", () => ({
  saveApprovedShoot: mocks.saveApprovedShoot,
}));
vi.mock("../src/lib/supabase/rpc-adapter", () => ({
  rpcCallFromClient: mocks.rpcCallFromClient,
}));

import { POST } from "../src/app/api/shoots/save/route";

const APPROVAL_ID = "33333333-3333-4333-8333-333333333333";
const SHOOT_ID = "44444444-4444-4444-8444-444444444444";

function request(body: unknown): Request {
  return new Request("http://localhost/api/shoots/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
  mocks.createClientFromRequest.mockReturnValue({ rpc: vi.fn() });
});

describe("POST /api/shoots/save", () => {
  it("requires an authenticated operator and session client", async () => {
    mocks.getVerifiedOperatorForRequest.mockResolvedValue(null);
    expect((await POST(request({ approvalId: APPROVAL_ID }))).status).toBe(401);
    expect(mocks.saveApprovedShoot).not.toHaveBeenCalled();

    mocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.createClientFromRequest.mockReturnValue(null);
    expect((await POST(request({ approvalId: APPROVAL_ID }))).status).toBe(401);
    expect(mocks.saveApprovedShoot).not.toHaveBeenCalled();
  });

  it("rejects malformed or extra browser authority before the RPC", async () => {
    expect((await POST(request({ approvalId: "not-a-uuid" }))).status).toBe(400);
    expect((await POST(request({ approvalId: APPROVAL_ID, orgId: "spoof" }))).status).toBe(400);
    expect(mocks.saveApprovedShoot).not.toHaveBeenCalled();
  });

  it.each([
    ["INVALID_PLAN", 400],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["NOT_APPROVED", 409],
    ["HASH_MISMATCH", 409],
    ["SUPERSEDED_REVISION", 409],
    ["SAVE_FAILED", 503],
  ] as const)("maps %s to HTTP %i", async (code, status) => {
    mocks.saveApprovedShoot.mockResolvedValue({ ok: false, code });
    const response = await POST(request({ approvalId: APPROVAL_ID }));
    expect(response.status).toBe(status);
  });

  it("returns the canonical shootId on success", async () => {
    mocks.saveApprovedShoot.mockResolvedValue({ ok: true, shootId: SHOOT_ID, replayed: false });
    const response = await POST(request({ approvalId: APPROVAL_ID }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, shootId: SHOOT_ID, replayed: false });
    expect(mocks.saveApprovedShoot).toHaveBeenCalledWith(APPROVAL_ID, expect.any(Object));
  });
});
