import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serviceClient: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.serviceClient,
}));

import { failAnalysis } from "@/mastra/workflows/brand-intelligence";

const BRAND_ID = "11111111-1111-4111-8111-111111111111";

function fakeAdmin() {
  return {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: mocks.updateEq })),
    })),
  };
}

async function failAfterCleanup() {
  throw await failAnalysis(
    BRAND_ID,
    "Durable crawl client unavailable",
    new Error("Service-role client unavailable"),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.serviceClient.mockReturnValue(fakeAdmin());
  mocks.updateEq.mockResolvedValue({ error: null });
});

describe("failAnalysis propagation contract", () => {
  it("records failed state and returns the error the caller intentionally throws", async () => {
    await expect(failAfterCleanup()).rejects.toThrow("Durable crawl client unavailable");
    expect(mocks.updateEq).toHaveBeenCalledWith("id", BRAND_ID);
  });

  it("surfaces a cleanup write failure instead of masking it", async () => {
    mocks.updateEq.mockResolvedValueOnce({ error: { message: "database unavailable" } });

    await expect(failAfterCleanup()).rejects.toThrow(
      /intake_status=failed was NOT recorded: database unavailable/,
    );
  });
});