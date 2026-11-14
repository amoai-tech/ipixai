import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/components/operator-panel/genui-fixture-harness", () => ({
  GenUIFixtureHarness: () => null,
}));
vi.mock("@/lib/planner/seed-routes", () => ({
  plannerSeedRoutesEnabled: () => false,
}));

import GenUIFixturePage from "../src/app/genui-fixture/page";

describe("GenUI fixture route gate", () => {
  it("calls notFound when the seed-route gate is disabled", () => {
    expect(() => GenUIFixturePage()).toThrow("NEXT_NOT_FOUND");
  });
});
