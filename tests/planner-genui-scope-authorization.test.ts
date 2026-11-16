import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  brands: vi.fn(),
  shoot: vi.fn(),
}));
vi.mock("../src/lib/dashboard/command-center", () => ({
  loadTrustedBrandIds: (...args: unknown[]) => mocks.brands(...args),
}));
vi.mock("../src/lib/shoot/get-shoot-detail", () => ({
  preauthorizeShootForOrg: (...args: unknown[]) => mocks.shoot(...args),
}));
import { authorizePlannerGenUIScope } from "../src/lib/copilotkit/genui-activity-persist";

const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const brand = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const shoot = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function mockClient(brandFound = true) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: brandFound ? { id: brand } : null,
      error: null,
    }),
  };
  const client = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
  return { client, query };
}
describe("Planner GenUI scope server authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.brands.mockResolvedValue({ ok: true, brandIds: [brand] });
    mocks.shoot.mockResolvedValue({ ok: true });
  });

  it("allows workspace only for the already authenticated caller", async () => {
    const { client } = mockClient();
    expect(await authorizePlannerGenUIScope(client, "workspace", org)).toBe(true);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("denies a forged Brand even when its scope text copies the verified org", async () => {
    const { client } = mockClient(false);
    expect(await authorizePlannerGenUIScope(client, `brand:${org}:${brand}`, org)).toBe(false);
    expect(client.from).toHaveBeenCalledWith("brands");
  });

  it("validates a real Brand under the verified org", async () => {
    const { client, query } = mockClient();
    expect(await authorizePlannerGenUIScope(client, `brand:${org}:${brand}`, org)).toBe(true);
    expect(query.eq).toHaveBeenCalledWith("id", brand);
    expect(query.eq).toHaveBeenCalledWith("org_id", org);
  });

  it("rejects foreign org locators before any database call", async () => {
    const { client } = mockClient();
    expect(await authorizePlannerGenUIScope(client, `brand:other:${brand}`, org)).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("checks shoot against server trusted brand IDs and existing preauthorization", async () => {
    const { client } = mockClient();
    expect(await authorizePlannerGenUIScope(client, `shoot:${org}:${shoot}`, org)).toBe(true);
    expect(mocks.brands).toHaveBeenCalledWith(client, org);
    expect(mocks.shoot).toHaveBeenCalledWith(client, shoot, [brand]);
  });

  it("denies a shoot when preauthorization cannot prove ownership", async () => {
    mocks.shoot.mockResolvedValue({ ok: false, reason: "not_found" });
    const { client } = mockClient();
    expect(await authorizePlannerGenUIScope(client, `shoot:${org}:${shoot}`, org)).toBe(false);
  });

  it("fails closed when the authorization provider is unavailable", async () => {
    const { client } = mockClient();
    mocks.brands.mockRejectedValueOnce(new Error("database unavailable"));
    expect(await authorizePlannerGenUIScope(client, `shoot:${org}:${shoot}`, org)).toBe(false);
  });
});
