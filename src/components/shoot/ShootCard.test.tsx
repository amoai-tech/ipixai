// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("./shoots-list.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/status-chip.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { ShootCard } from "./ShootCard";

afterEach(() => cleanup());

const SHOOT = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Beach Editorial",
  status: "active",
  type: "lifestyle_beach",
  brandId: "22222222-2222-4222-8222-222222222222",
  dnaScore: 82,
  channel: "instagram_feed",
  updatedAt: "2026-09-01T10:00:00.000Z",
  shotCount: 12,
  assetCount: 3,
};

describe("ShootCard", () => {
  it("links the whole card directly to the shoot detail route", () => {
    render(<ShootCard shoot={SHOOT} />);
    const anchor = screen.getByText("Beach Editorial").closest("a");
    expect(anchor?.getAttribute("href")).toBe(`/app/shoots/${SHOOT.id}`);
  });

  it("renders the status chip with the resolved label", () => {
    render(<ShootCard shoot={SHOOT} />);
    expect(screen.getByText("Active")).toBeDefined();
  });

  it("renders the DNA badge with the rounded score", () => {
    render(<ShootCard shoot={SHOOT} />);
    const badge = screen.getByLabelText("DNA score: 82");
    expect(badge.textContent).toBe("82");
  });

  it("renders channel and counts in the meta line", () => {
    render(<ShootCard shoot={SHOOT} />);
    expect(screen.getByText("IG")).toBeDefined();
    expect(screen.getByText("12 shots")).toBeDefined();
    expect(screen.getByText("3 assets")).toBeDefined();
  });

  it("omits the DNA badge when the score is null", () => {
    render(<ShootCard shoot={{ ...SHOOT, dnaScore: null }} />);
    expect(screen.queryByLabelText(/DNA score/)).toBeNull();
  });

  it("omits counts when they are null", () => {
    render(<ShootCard shoot={{ ...SHOOT, shotCount: null, assetCount: null }} />);
    expect(screen.queryByText(/shots/)).toBeNull();
    expect(screen.queryByText(/assets/)).toBeNull();
  });

  it("never renders a cover image — honest placeholder only", () => {
    render(<ShootCard shoot={SHOOT} />);
    expect(screen.queryByRole("img")).toBeNull();
    const card = screen.getByText("Beach Editorial").closest("li");
    expect(within(card!).queryByTestId("shoot-card-cover")).toBeNull();
  });
});