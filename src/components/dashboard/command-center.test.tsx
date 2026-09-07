// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// Mock every CSS module the tree imports (CommandCenter + composed atoms).
vi.mock("./command-center.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/empty-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/error-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { CommandCenter } from "./command-center";

afterEach(() => cleanup());

const BRANDS_OK = { ok: true as const, brands: [{ id: "brand-1", name: "Brand Alpha" }] };
const BRANDS_EMPTY = { ok: true as const, brands: [] };
const BRANDS_FAILED = { ok: false as const };

const SHOOTS_OK = {
  ok: true as const,
  shoots: [
    {
      id: "shoot-1",
      name: "Shoot One",
      status: "in_progress",
      brandId: "brand-1",
      dnaScore: null,
      channel: null,
    },
  ],
};
const SHOOTS_EMPTY = { ok: true as const, shoots: [] };
const SHOOTS_FAILED = { ok: false as const };

describe("CommandCenter", () => {
  it("renders a Planner quick link to /app/plans", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    const link = screen.getByRole("link", { name: "Open Plans" });
    expect(link.getAttribute("href")).toBe("/app/plans");
  });

  it("renders Brands and Shoots quick links with distinct accessible names", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    expect(screen.getByRole("link", { name: "Open Brands" }).getAttribute("href")).toBe("/app/brands");
    expect(screen.getByRole("link", { name: "Open Shoots" }).getAttribute("href")).toBe("/app/shoots");
  });

  it("keeps quick links usable when the brands read fails", () => {
    render(<CommandCenter brandsResult={BRANDS_FAILED} shootsResult={SHOOTS_OK} />);
    expect(screen.getByText(/Couldn't load your brands/)).toBeDefined();
    // Quick links are static and must not disappear with the failed section.
    expect(screen.getByRole("link", { name: "Open Brands" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Open Shoots" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Open Plans" })).toBeDefined();
  });

  it("shows the empty state with no brands", () => {
    render(<CommandCenter brandsResult={BRANDS_EMPTY} shootsResult={SHOOTS_OK} />);
    expect(screen.getByText("No brands yet")).toBeDefined();
  });

  it("links each brand card to /app/brands", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    // "Brand Alpha" also appears in the hero card — scope to the list.
    const list = screen.getByTestId("command-center-brand-list");
    const anchor = within(list).getByText("Brand Alpha").closest("a");
    expect(anchor?.getAttribute("href")).toBe("/app/brands");
  });

  it("shows the empty state with no shoots", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_EMPTY} />);
    expect(screen.getByText("No shoots yet")).toBeDefined();
  });

  it("links each shoot card to its own /app/shoots/:id detail page", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    const anchor = screen.getByText("Shoot One").closest("a");
    expect(anchor?.getAttribute("href")).toBe("/app/shoots/shoot-1");
  });

  it("keeps the brands section intact when the shoots read fails independently", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_FAILED} />);
    expect(screen.getByText(/Couldn't load your shoots/)).toBeDefined();
    // Brands section is unaffected by the shoots read failing.
    expect(within(screen.getByTestId("command-center-brand-list")).getByText("Brand Alpha")).toBeDefined();
  });

  it("keeps the shoots section intact when the brands read fails independently", () => {
    render(<CommandCenter brandsResult={BRANDS_FAILED} shootsResult={SHOOTS_OK} />);
    expect(screen.getByText(/Couldn't load your brands/)).toBeDefined();
    // Shoots section is unaffected by the brands read failing.
    expect(screen.getByText("Shoot One")).toBeDefined();
  });

  it("shows a hero card for the first real brand, with no fabricated cover image", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    expect(screen.getByTestId("command-center-hero")).toBeDefined();
    expect(screen.getAllByText("Brand Alpha").length).toBeGreaterThan(0);
    // No <img> in the hero — it renders an initial avatar, not a stock photo.
    expect(screen.getByTestId("command-center-hero").querySelector("img")).toBeNull();
  });

  it("renders no hero card when there are no brands", () => {
    render(<CommandCenter brandsResult={BRANDS_EMPTY} shootsResult={SHOOTS_OK} />);
    expect(screen.queryByTestId("command-center-hero")).toBeNull();
  });

  it("renders the honest placeholder when no authorized preview exists for a shoot", () => {
    // Even a shoot with a real DNA score and channel gets the honest
    // placeholder when it has no entry in recentWorkPreviews — cover_url
    // itself is never rendered directly (see the .recentThumb comment).
    // channel is a real shoot.channel enum value here (not the display
    // label) — the tile must map it through channelLabel(), same as
    // ShootCard/deliverables-tab do elsewhere.
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-2",
          name: "Shoot Two",
          status: "active",
          brandId: "brand-1",
          dnaScore: 91,
          channel: "instagram_feed",
        },
      ],
    };
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={shoots} />);
    const tile = screen.getByText("Shoot Two").closest("a");
    expect(tile?.querySelector("img")).toBeNull();
    expect(screen.getByText("91")).toBeDefined();
    expect(screen.getByText("IG")).toBeDefined();
  });

  it("appends a real aspect-ratio label only when channelSpecs actually has one", () => {
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-10",
          name: "Shoot Ten",
          status: "active",
          brandId: "brand-1",
          dnaScore: null,
          channel: "instagram_feed",
        },
      ],
    };
    const channelSpecs = new Map([
      ["instagram_feed", { aspectRatioLabel: "4:5", acceptedFormat: "JPG", backgroundRequired: null }],
    ]);
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={shoots} channelSpecs={channelSpecs} />);
    expect(screen.getByText("IG · 4:5")).toBeDefined();
  });

  it("never fabricates an aspect ratio for a channel channelSpecs doesn't cover", () => {
    // "website" is a real shoot.channel value the image_specs reference
    // tables don't map (see channel-specs.ts) — the meta line must fall
    // back to the channel label alone, never a guessed ratio.
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-11",
          name: "Shoot Eleven",
          status: "active",
          brandId: "brand-1",
          dnaScore: null,
          channel: "website",
        },
      ],
    };
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={shoots} channelSpecs={new Map()} />);
    expect(screen.getByText("Website")).toBeDefined();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it("renders the real signed image when an authorized preview exists for a shoot", () => {
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-6",
          name: "Shoot Six",
          status: "active",
          brandId: "brand-1",
          dnaScore: null,
          channel: null,
        },
      ],
    };
    const recentWorkPreviews = new Map([["shoot-6", "https://res.cloudinary.com/signed-preview"]]);
    render(
      <CommandCenter
        brandsResult={BRANDS_OK}
        shootsResult={shoots}
        recentWorkPreviews={recentWorkPreviews}
      />,
    );
    const tile = screen.getByText("Shoot Six").closest("a");
    const img = tile?.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://res.cloudinary.com/signed-preview");
  });

  it("renders the title exactly once, inside the image region, when a real image exists", () => {
    // Unit-testable proxy for "overlaid on the image, not duplicated below
    // it" — jsdom doesn't compute real layout/position, so the actual
    // visual placement (Lumina parity) is verified separately by browser
    // screenshot, not asserted here. What this test can and does prove:
    // the title text appears exactly once (no separate below-thumb copy),
    // and it's contained within the same region as the media, not a
    // sibling of it.
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-8",
          name: "Shoot Eight",
          status: "active",
          brandId: "brand-1",
          dnaScore: null,
          channel: null,
        },
      ],
    };
    const recentWorkPreviews = new Map([["shoot-8", "https://res.cloudinary.com/signed-preview"]]);
    render(
      <CommandCenter
        brandsResult={BRANDS_OK}
        shootsResult={shoots}
        recentWorkPreviews={recentWorkPreviews}
      />,
    );
    expect(screen.getAllByText("Shoot Eight")).toHaveLength(1);
    expect(screen.getByText("Shoot Eight").closest(".recentThumb")).not.toBeNull();
  });

  it("renders the title outside the image region when no authorized preview exists", () => {
    // Same unit-testable proxy as above, inverted: for the placeholder
    // path the title is not part of the media region (CSS modules are
    // mocked to their literal key string in this test file).
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    expect(screen.getByText("Shoot One").closest(".recentThumb")).toBeNull();
  });

  it("recovers to the honest placeholder and below-thumb title when the signed image fails to load", () => {
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-9",
          name: "Shoot Nine",
          status: "active",
          brandId: "brand-1",
          dnaScore: null,
          channel: null,
        },
      ],
    };
    const recentWorkPreviews = new Map([["shoot-9", "https://res.cloudinary.com/now-broken"]]);
    render(
      <CommandCenter
        brandsResult={BRANDS_OK}
        shootsResult={shoots}
        recentWorkPreviews={recentWorkPreviews}
      />,
    );
    const tile = screen.getByText("Shoot Nine").closest("a");
    const img = tile?.querySelector("img");
    expect(img).not.toBeNull();

    fireEvent.error(img as HTMLImageElement);

    // Same shape as "no preview at all": no <img>, honest placeholder,
    // title moves out of the (now placeholder) media region.
    expect(tile?.querySelector("img")).toBeNull();
    expect(screen.getByText("Shoot Nine").closest(".recentThumb")).toBeNull();
  });

  it("does not render an image for a shoot missing from recentWorkPreviews even when others have one", () => {
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-7",
          name: "Shoot Seven",
          status: "active",
          brandId: "brand-1",
          dnaScore: null,
          channel: null,
        },
      ],
    };
    const recentWorkPreviews = new Map([["some-other-shoot", "https://res.cloudinary.com/signed-preview"]]);
    render(
      <CommandCenter
        brandsResult={BRANDS_OK}
        shootsResult={shoots}
        recentWorkPreviews={recentWorkPreviews}
      />,
    );
    const tile = screen.getByText("Shoot Seven").closest("a");
    expect(tile?.querySelector("img")).toBeNull();
  });

  it("shows a DNA score of exactly 0 rather than treating it as unscored", () => {
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-3",
          name: "Shoot Three",
          status: "planning",
          brandId: "brand-1",
          dnaScore: 0,
          channel: null,
        },
      ],
    };
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={shoots} />);
    expect(screen.getByText("0")).toBeDefined();
    expect(screen.getByLabelText("DNA score: 0")).toBeDefined();
  });

  it("never fabricates a DNA score or channel when the shoot has none", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    const tile = screen.getByText("Shoot One").closest("a");
    // No numeric badge and no meta line for this null-score, null-channel shoot.
    expect(tile?.textContent).toBe("Shoot One");
  });

  it("says the workspace is ready only when both reads actually succeeded", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    expect(screen.getByText("Workspace ready")).toBeDefined();
    expect(screen.getByText("Data loaded for this session.")).toBeDefined();
  });

  it("does not claim the workspace is ready when a read failed (mixed success)", () => {
    render(<CommandCenter brandsResult={BRANDS_FAILED} shootsResult={SHOOTS_OK} />);
    // Same bug either direction — assert both, not just one result failing.
    expect(screen.queryByText("Workspace ready")).toBeNull();
    expect(screen.queryByText("Data loaded for this session.")).toBeNull();
    expect(screen.getByText("Workspace loaded")).toBeDefined();
  });

  it("does not claim the workspace is ready when the other read failed either", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_FAILED} />);
    expect(screen.queryByText("Workspace ready")).toBeNull();
    expect(screen.getByText("Workspace loaded")).toBeDefined();
  });

  it("shows the Production Planner label and a real-data greeting in the hero", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    const hero = screen.getByTestId("command-center-hero");
    expect(within(hero).getByText("Production Planner")).toBeDefined();
    expect(within(hero).getByText("You're working with Brand Alpha.")).toBeDefined();
    // No real shoot/approval data in SHOOTS_OK's single null-score shoot's
    // name isn't referenced (name is "Shoot One", not used as the subline
    // source here) — falls through to the honest no-data subline.
  });

  it("hero subline references the most recent real shoot when one exists", () => {
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-4",
          name: "Spring Capsule",
          status: "active",
          brandId: "brand-1",
          dnaScore: null,
          channel: null,
        },
      ],
    };
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={shoots} />);
    expect(
      within(screen.getByTestId("command-center-hero")).getByText("Continue planning Spring Capsule."),
    ).toBeDefined();
  });

  it("never references another brand's shoot in the hero subline", () => {
    // heroBrand is BRANDS_OK's "brand-1"; this shoot belongs to a different
    // brand entirely, so the hero must not claim it as "recent work" here.
    const shoots = {
      ok: true as const,
      shoots: [
        {
          id: "shoot-5",
          name: "Other Brand's Shoot",
          status: "active",
          brandId: "brand-2",
          dnaScore: null,
          channel: null,
        },
      ],
    };
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={shoots} />);
    expect(
      within(screen.getByTestId("command-center-hero")).getByText(
        "Ask the Production Planner what to work on next.",
      ),
    ).toBeDefined();
  });

  it("hero subline never fabricates a next action when there is no real shoot", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_EMPTY} />);
    expect(
      within(screen.getByTestId("command-center-hero")).getByText(
        "Ask the Production Planner what to work on next.",
      ),
    ).toBeDefined();
  });

  it("shows only the capability-gated Plan a shoot chip, not the unverified Lumina chips", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    const chip = screen.getByRole("link", { name: "Plan a shoot" });
    expect(chip.getAttribute("href")).toBe("/app/plans");
    // Generate deliverables / Review approvals have no real capability/route
    // yet — no generation route exists, and the real approval source hasn't
    // shipped:
    // IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject
    // AI Plans Before Anything Is Saved
    // Both must stay hidden.
    expect(screen.queryByText("Generate deliverables")).toBeNull();
    expect(screen.queryByText("Review approvals")).toBeNull();
  });

  it("renders the Recent work header with a View all link to /app/shoots", () => {
    render(<CommandCenter brandsResult={BRANDS_OK} shootsResult={SHOOTS_OK} />);
    expect(screen.getByRole("heading", { name: "Recent work" })).toBeDefined();
    const viewAll = screen.getByRole("link", { name: "View all" });
    expect(viewAll.getAttribute("href")).toBe("/app/shoots");
  });
});
