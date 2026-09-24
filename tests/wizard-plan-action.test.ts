import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  composeShootPlan: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/mastra/tools/compose-shoot-plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/mastra/tools/compose-shoot-plan")>();
  return { ...actual, composeShootPlan: mocks.composeShootPlan };
});

import { composeShootPlanForWizard } from "@/app/app/shoots/new/actions";

afterEach(() => vi.clearAllMocks());

describe("composeShootPlanForWizard", () => {
  it("fails closed when there is no authenticated Supabase client", async () => {
    mocks.createClient.mockResolvedValue(null);

    const result = await composeShootPlanForWizard({ channels: ["instagram_feed"] });

    expect(result).toEqual({ ok: false, error: "Not authenticated — please sign in and try again." });
    expect(mocks.composeShootPlan).not.toHaveBeenCalled();
  });

  it("logs composition failures server-side without logging the submitted form payload", async () => {
    const error = new Error("compose failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "operator-1" } } }) },
    });
    mocks.composeShootPlan.mockRejectedValue(error);

    const result = await composeShootPlanForWizard({ channels: ["instagram_feed"], brief: "private brief" });

    expect(result).toEqual({ ok: false, error: "The production plan could not be composed. Please try again." });
    expect(consoleError).toHaveBeenCalledWith("[shoot-wizard] composeShootPlan failed", error);
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("private brief");
    consoleError.mockRestore();
  });

  it("rejects malformed canonical plan input before composition", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "operator-1" } } }) },
    });

    const result = await composeShootPlanForWizard({ channels: [] });

    expect(result).toEqual({ ok: false, error: "Some shoot inputs are invalid. Review the form and try again." });
    expect(mocks.composeShootPlan).not.toHaveBeenCalled();
  });
});
