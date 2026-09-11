// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("./brands-list.module.css", () => ({
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

import { BrandsListWorkspace } from "./brands-list-workspace";
import type { BrandListItem } from "@/lib/brand/get-brands";

afterEach(() => cleanup());

const BRAND: BrandListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Maison Solène",
  brandUrl: null,
  intakeStatus: "brand_created",
  approvedProfileAt: null,
};

describe("BrandsListWorkspace", () => {
  it("renders the header with the trusted-org count", () => {
    render(
      <BrandsListWorkspace result={{ ok: true, brands: [BRAND], hasMore: false }} count={7} />,
    );
    expect(screen.getByText("Brands")).toBeDefined();
    expect(screen.getByText("7 brands")).toBeDefined();
  });

  it("omits the count when the count read failed (honest, no fabricated number)", () => {
    render(
      <BrandsListWorkspace result={{ ok: true, brands: [BRAND], hasMore: false }} count={null} />,
    );
    expect(screen.queryByText(/brands$/)).toBeNull();
  });

  it("renders the error state when the list read fails", () => {
    render(<BrandsListWorkspace result={{ ok: false }} count={null} />);
    expect(screen.getByText(/Couldn't load your brands/)).toBeDefined();
  });

  it("renders the empty state with no brands", () => {
    render(<BrandsListWorkspace result={{ ok: true, brands: [], hasMore: false }} count={0} />);
    expect(screen.getByText("No brands yet")).toBeDefined();
  });

  it("renders the brand grid with cards", () => {
    render(
      <BrandsListWorkspace result={{ ok: true, brands: [BRAND], hasMore: false }} count={1} />,
    );
    expect(screen.getByTestId("brands-list")).toBeDefined();
    expect(screen.getByText("Maison Solène")).toBeDefined();
  });

  it("surfaces a hasMore hint instead of silently truncating", () => {
    render(
      <BrandsListWorkspace result={{ ok: true, brands: [BRAND], hasMore: true }} count={250} />,
    );
    expect(screen.getByText(/more exist/)).toBeDefined();
  });

  it("omits the hasMore hint when the full list fit", () => {
    render(
      <BrandsListWorkspace result={{ ok: true, brands: [BRAND], hasMore: false }} count={1} />,
    );
    expect(screen.queryByText(/more exist/)).toBeNull();
  });
});
