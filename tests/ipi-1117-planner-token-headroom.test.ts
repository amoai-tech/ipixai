import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getPublicSupabaseConfig: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/env", () => ({ getPublicSupabaseConfig: mocks.getPublicSupabaseConfig }));

import { updateSession } from "@/lib/supabase/update-session";

const USER = "33333333-3333-4333-8333-333333333333";
const NOW = Math.floor(Date.now() / 1000);

function sessionClient(input: {
  exp: number;
  renewedExp?: number;
  renewedSub?: string;
  refreshError?: boolean;
}) {
  const getClaims = vi.fn()
    .mockResolvedValueOnce({ data: { claims: { sub: USER, exp: input.exp } }, error: null })
    .mockResolvedValue({ data: { claims: {
      sub: input.renewedSub ?? USER, exp: input.renewedExp ?? NOW + 3600,
    } }, error: null });
  const refreshSession = vi.fn();
  mocks.createServerClient.mockImplementation((
    _url: string,
    _key: string,
    config: { cookies: { setAll: (items: Array<{ name: string; value: string; options: object }>, headers: Record<string, string>) => void } },
  ) => {
    refreshSession.mockImplementation(async () => {
      if (input.refreshError) return { data: { session: null }, error: new Error("auth unavailable") };
      config.cookies.setAll([
        { name: "sb-ipix-auth", value: "new-session-for-test", options: { path: "/" } },
      ], { "Cache-Control": "private, no-store" });
      return { data: { session: { access_token: "new-token-for-test" } }, error: null };
    });
    return { auth: { getClaims, refreshSession } };
  });
  return { getClaims, refreshSession };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublicSupabaseConfig.mockReturnValue({ url: "https://example.supabase.co", publishableKey: "sb_publishable_dummy" });
});

describe("IPI-1117: Planner tokens must outlive the bounded Vercel invocation", () => {
  it("keeps a healthy token without rotating refresh cookies on every request", async () => {
    const auth = sessionClient({ exp: NOW + 1800 });
    const response = await updateSession(new NextRequest("https://www.ipix.co/api/copilotkit"));
    expect(response.status).toBe(200);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it("proactively refreshes nearly expired Planner JWTs and propagates browser cookies", async () => {
    const auth = sessionClient({ exp: NOW + 80 });
    const response = await updateSession(new NextRequest("https://www.ipix.co/api/copilotkit/agents"));
    expect(response.status).toBe(200);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(auth.getClaims).toHaveBeenCalledTimes(2);
    expect(response.cookies.get("sb-ipix-auth")?.value).toBe("new-session-for-test");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("fails closed when a near-expiry credential cannot be refreshed", async () => {
    const auth = sessionClient({ exp: NOW + 10, refreshError: true });
    const response = await updateSession(new NextRequest("https://www.ipix.co/api/copilotkit"));
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("fails closed if the refreshed token belongs to another user", async () => {
    const auth = sessionClient({ exp: NOW + 10, renewedSub: "44444444-4444-4444-8444-444444444444" });
    const response = await updateSession(new NextRequest("https://www.ipix.co/api/copilotkit"));
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(401);
  });

  it("does not alter unrelated route refresh behavior", async () => {
    const auth = sessionClient({ exp: NOW + 10 });
    const response = await updateSession(new NextRequest("https://www.ipix.co/app"));
    expect(response.status).toBe(200);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it("pins the route duration below the verified refreshed-token headroom", () => {
    const route = readFileSync(
      new URL("../src/app/api/copilotkit/[[...slug]]/route.ts", import.meta.url), "utf8",
    );
    expect(route).toMatch(/export const maxDuration = 300;/);
  });
});
