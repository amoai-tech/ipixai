// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("./shoots-list.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/status-chip.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/empty-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/error-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { ShootsListWorkspace } from "./shoots-list-workspace";

afterEach(() => cleanup());

const SHOOT = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Beach Editorial",
  status: "active",
  type: "lifestyle_beach",
  brandId: "22222222-2222-4222-8222-222222222222",
  dnaScore: null,
  channel: null,
  updatedAt: "2026-09-01T10:00:00.000Z",
  shotCount: null,
  assetCount: null,
};

const CURSOR = { updatedAt: "2026-09-01T10:00:00.000Z", id: SHOOT.id };

describe("ShootsListWorkspace", () => {
  it("renders the header with the trusted-org count", () => {
    render(
      <ShootsListWorkspace
        result={{ ok: true, shoots: [SHOOT], nextCursor: null }}
        count={42}
        nextCursor={null}
      />,
    );
    expect(screen.getByText("Shoots")).toBeDefined();
    expect(screen.getByText("42 shoots")).toBeDefined();
  });

  it("omits the count when the count read failed (honest, no fabricated number)", () => {
    render(
      <ShootsListWorkspace
        result={{ ok: true, shoots: [SHOOT], nextCursor: null }}
        count={null}
        nextCursor={null}
      />,
    );
    expect(screen.queryByText(/shoots$/)).toBeNull();
  });

  it("renders the error state when the list read fails", () => {
    render(
      <ShootsListWorkspace result={{ ok: false }} count={null} nextCursor={null} />,
    );
    expect(screen.getByText(/Couldn't load your shoots/)).toBeDefined();
  });

  it("renders the empty state with no shoots", () => {
    render(
      <ShootsListWorkspace
        result={{ ok: true, shoots: [], nextCursor: null }}
        count={0}
        nextCursor={null}
      />,
    );
    expect(screen.getByText("No shoots yet")).toBeDefined();
  });

  it("renders the shoot grid with cards", () => {
    render(
      <ShootsListWorkspace
        result={{ ok: true, shoots: [SHOOT], nextCursor: null }}
        count={1}
        nextCursor={null}
      />,
    );
    expect(screen.getByTestId("shoots-list")).toBeDefined();
    expect(screen.getByText("Beach Editorial")).toBeDefined();
  });

  it("renders a next-page link carrying the opaque cursor when more rows exist", () => {
    render(
      <ShootsListWorkspace
        result={{ ok: true, shoots: [SHOOT], nextCursor: CURSOR }}
        count={25}
        nextCursor={CURSOR}
      />,
    );
    const link = screen.getByRole("link", { name: "Next page" });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("/app/shoots?after=")).toBe(true);
    // The cursor must be opaque — never the raw JSON.
    expect(href).not.toContain("updatedAt");
    expect(href).not.toContain(SHOOT.id);
  });

  it("omits the next-page link on the last page", () => {
    render(
      <ShootsListWorkspace
        result={{ ok: true, shoots: [SHOOT], nextCursor: null }}
        count={1}
        nextCursor={null}
      />,
    );
    expect(screen.queryByRole("link", { name: "Next page" })).toBeNull();
  });
});