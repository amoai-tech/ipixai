// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("./brands-list.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/status-chip.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/empty-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { BrandsSearchFilter } from "./brands-search-filter";
import type { BrandListItem } from "@/lib/brand/get-brands";

afterEach(() => cleanup());

const BRANDS: BrandListItem[] = [
  {
    id: "b1",
    name: "Maison Solène",
    brandUrl: "https://maisonsolene.example.com",
    intakeStatus: "draft_ready",
    approvedProfileAt: null,
  },
  {
    id: "b2",
    name: "Atelier Rive",
    brandUrl: null,
    intakeStatus: "failed",
    approvedProfileAt: null,
  },
  {
    id: "b3",
    name: "Nova Studio",
    brandUrl: null,
    intakeStatus: "brand_created",
    approvedProfileAt: "2026-09-10T00:00:00.000Z",
  },
];

describe("BrandsSearchFilter", () => {
  it("renders every brand by default (empty query, All filter)", () => {
    render(<BrandsSearchFilter brands={BRANDS} />);
    expect(screen.getByText("Maison Solène")).toBeDefined();
    expect(screen.getByText("Atelier Rive")).toBeDefined();
    expect(screen.getByText("Nova Studio")).toBeDefined();
  });

  it("narrows the grid as the operator types a search query", () => {
    render(<BrandsSearchFilter brands={BRANDS} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search brands" }), {
      target: { value: "Maison" },
    });
    expect(screen.getByText("Maison Solène")).toBeDefined();
    expect(screen.queryByText("Atelier Rive")).toBeNull();
    expect(screen.queryByText("Nova Studio")).toBeNull();
  });

  it("narrows the grid when a status filter chip is selected", () => {
    render(<BrandsSearchFilter brands={BRANDS} />);
    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    expect(screen.getByText("Nova Studio")).toBeDefined();
    expect(screen.queryByText("Maison Solène")).toBeNull();
    expect(screen.queryByText("Atelier Rive")).toBeNull();
  });

  it("marks the active filter chip with aria-pressed", () => {
    render(<BrandsSearchFilter brands={BRANDS} />);
    const failedChip = screen.getByRole("button", { name: "Failed" });
    expect(failedChip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(failedChip);
    expect(failedChip.getAttribute("aria-pressed")).toBe("true");
  });

  it("'ready' status is its own filter chip, distinct from 'analyzing'", () => {
    const brands: BrandListItem[] = [
      ...BRANDS,
      {
        id: "b4",
        name: "Ready Reserve",
        brandUrl: null,
        intakeStatus: "ready",
        approvedProfileAt: null,
      },
    ];
    render(<BrandsSearchFilter brands={brands} />);
    fireEvent.click(screen.getByRole("button", { name: "Ready" }));
    expect(screen.getByText("Ready Reserve")).toBeDefined();
    expect(screen.queryByText("Maison Solène")).toBeNull();
    expect(screen.queryByText("Atelier Rive")).toBeNull();
    expect(screen.queryByText("Nova Studio")).toBeNull();
  });

  it("sorts the grid by name via the sort control", () => {
    render(<BrandsSearchFilter brands={BRANDS} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Sort brands" }), {
      target: { value: "name-asc" },
    });
    const names = screen.getAllByRole("listitem").map((li) => li.textContent);
    const positions = ["Atelier Rive", "Maison Solène", "Nova Studio"].map((name) =>
      names.findIndex((text) => text?.includes(name)),
    );
    expect(positions).toEqual([...positions].toSorted((a, b) => a - b));
  });

  it("renders an honest no-match state instead of an empty grid", () => {
    render(<BrandsSearchFilter brands={BRANDS} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search brands" }), {
      target: { value: "no such brand" },
    });
    expect(screen.getByText("No matching brands")).toBeDefined();
    expect(screen.queryByTestId("brands-list")).toBeNull();
  });
});
