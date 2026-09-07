// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("./shoot-detail.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/status-chip.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/empty-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import { ShootDetailWorkspace } from "./shoot-detail-workspace";

afterEach(() => cleanup());

const DETAIL: ShootDetail = {
  shoot: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Beach Editorial",
    status: "active",
    brief: "Golden-hour lifestyle editorial for the summer capsule.",
    target_channels: ["instagram_feed", "tiktok"],
    estimated_budget: 12500,
    actual_cost: null,
    currency: "USD",
    budget_breakdown: null,
    start_date: "2026-09-12T00:00:00.000Z",
    end_date: "2026-09-14T00:00:00.000Z",
    location: "Malibu",
    dna_score: 82,
    mood_board_urls: [],
    cover_url: null,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-02T10:00:00.000Z",
    brand_id: "22222222-2222-4222-8222-222222222222",
  },
  brand: { id: "22222222-2222-4222-8222-222222222222", name: "Brand Alpha" },
  deliverables: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      channel: "instagram_feed",
      format: "9:16",
      quantity: 12,
      status: "planned",
    },
  ],
  shots: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      shot_number: 1,
      description: "Hero shot at golden hour",
      style_notes: "Wide lens, natural light",
      status: "captured",
    },
  ],
  assets: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      url: null,
      cloudinary_id: "cld:asset:1",
      format: "jpg",
      resource_type: "image",
      width: 4000,
      height: 3000,
      dna_score: null,
      status: "ready",
      created_at: "2026-09-03T10:00:00.000Z",
    },
  ],
  crew: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      role: "Photographer",
      confirmed: true,
      notes: null,
      internal_contact_id: null,
      marketplace_vendor_id: null,
    },
  ],
  approvals: [],
  activity: [],
};

describe("ShootDetailWorkspace", () => {
  it("renders the shoot name, status chip, and brand subheading", () => {
    render(<ShootDetailWorkspace detail={DETAIL} />);
    expect(screen.getByText("Beach Editorial")).toBeDefined();
    // "Active" also appears in hidden tab panels (shot/deliverable chips) —
    // the header chip is the first match.
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText(/Brand Alpha/)).toBeDefined();
  });

  it("links back to the shoots list", () => {
    render(<ShootDetailWorkspace detail={DETAIL} />);
    const back = screen.getByRole("link", { name: /Shoots/ });
    expect(back.getAttribute("href")).toBe("/app/shoots");
  });

  it("renders all nine lifecycle tabs", () => {
    render(<ShootDetailWorkspace detail={DETAIL} />);
    for (const label of [
      "Overview",
      "Shots",
      "Assets",
      "Team",
      "Schedule",
      "Budget",
      "Deliverables",
      "Approvals",
      "Activity",
    ]) {
      expect(screen.getByRole("tab", { name: label })).toBeDefined();
    }
  });

  it("shows the overview tab by default with brief and key facts", () => {
    render(<ShootDetailWorkspace detail={DETAIL} />);
    const overview = within(screen.getByTestId("shoot-tab-panel-overview"));
    expect(overview.getByText("Golden-hour lifestyle editorial for the summer capsule.")).toBeDefined();
    expect(overview.getByText("Malibu")).toBeDefined();
    expect(overview.getByText("$12,500")).toBeDefined();
    expect(overview.getByText("IG · TikTok")).toBeDefined();
  });

  it("renders the shots tab with shot rows and child-status labels", () => {
    render(<ShootDetailWorkspace detail={DETAIL} />);
    const shotsTab = screen.getByRole("tab", { name: "Shots" });
    fireEvent.click(shotsTab);
    expect(shotsTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("shoot-tab-panel-shots").hasAttribute("hidden")).toBe(false);
    expect(screen.getByText("Shot 1")).toBeDefined();
    expect(screen.getByText("Hero shot at golden hour")).toBeDefined();
    expect(screen.getByText("Captured")).toBeDefined();
  });

  it("renders the assets tab as count + placeholder note, never raw URLs", () => {
    render(<ShootDetailWorkspace detail={DETAIL} />);
    screen.getByRole("tab", { name: "Assets" }).click();
    expect(screen.getByText("1 asset")).toBeDefined();
    expect(screen.getByText(/IPI-1112/)).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders the team tab with crew rows", () => {
    render(<ShootDetailWorkspace detail={DETAIL} />);
    screen.getByRole("tab", { name: "Team" }).click();
    expect(screen.getByText("Photographer")).toBeDefined();
    expect(screen.getByText("Confirmed")).toBeDefined();
  });

  it("renders the deliverables tab with deliverable rows and child-status labels", () => {
    render(<ShootDetailWorkspace detail={DETAIL} />);
    const deliverablesTab = screen.getByRole("tab", { name: "Deliverables" });
    fireEvent.click(deliverablesTab);
    expect(deliverablesTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("shoot-tab-panel-deliverables").hasAttribute("hidden")).toBe(false);
    expect(screen.getByText("IG")).toBeDefined();
    expect(screen.getByText(/9:16/)).toBeDefined();
    expect(screen.getByText("Planned")).toBeDefined();
  });

  it("renders approvals and activity as placeholder shells", () => {
    render(<ShootDetailWorkspace detail={DETAIL} />);
    screen.getByRole("tab", { name: "Approvals" }).click();
    expect(
      within(screen.getByTestId("shoot-tab-panel-approvals")).getByText(/placeholder shell/),
    ).toBeDefined();
    screen.getByRole("tab", { name: "Activity" }).click();
    expect(
      within(screen.getByTestId("shoot-tab-panel-activity")).getByText(/placeholder shell/),
    ).toBeDefined();
  });

  it("renders a normal shell for a zero-shot shoot (empty sections, no fake controls)", () => {
    const zeroShot: ShootDetail = {
      ...DETAIL,
      shots: [],
      deliverables: [],
      crew: [],
      assets: [],
      shoot: { ...DETAIL.shoot, brief: null, dna_score: null },
    };
    render(<ShootDetailWorkspace detail={zeroShot} />);
    expect(screen.getByText("Beach Editorial")).toBeDefined();
    screen.getByRole("tab", { name: "Shots" }).click();
    expect(screen.getByText("No shot list yet")).toBeDefined();
    screen.getByRole("tab", { name: "Team" }).click();
    expect(screen.getByText("No crew yet")).toBeDefined();
    screen.getByRole("tab", { name: "Assets" }).click();
    expect(screen.getByText("No assets yet")).toBeDefined();
  });
});