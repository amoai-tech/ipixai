// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("./brands-list.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("../ui/status-chip.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { BrandCard } from "./BrandCard";
import type { BrandListItem } from "@/lib/brand/get-brands";

afterEach(() => cleanup());

const BRAND: BrandListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Maison Solène",
  brandUrl: "https://maisonsolene.example.com/shop",
  intakeStatus: "draft_ready",
  approvedProfileAt: null,
};

describe("BrandCard", () => {
  it("links the whole card directly to the brand detail route", () => {
    render(<BrandCard brand={BRAND} />);
    const anchor = screen.getByText("Maison Solène").closest("a");
    expect(anchor?.getAttribute("href")).toBe(`/app/brands/${BRAND.id}`);
  });

  it("renders the status chip with the resolved label", () => {
    render(<BrandCard brand={BRAND} />);
    expect(screen.getByText("Draft ready for review")).toBeDefined();
  });

  it("prefers Approved when approvedProfileAt is set, regardless of intake_status", () => {
    render(<BrandCard brand={{ ...BRAND, approvedProfileAt: "2026-09-10T00:00:00.000Z" }} />);
    expect(screen.getByText("Approved")).toBeDefined();
  });

  it("renders the hostname extracted from brand_url", () => {
    render(<BrandCard brand={BRAND} />);
    expect(screen.getByText("maisonsolene.example.com")).toBeDefined();
  });

  it("omits the hostname line when brand_url is null", () => {
    render(<BrandCard brand={{ ...BRAND, brandUrl: null }} />);
    expect(screen.queryByText(/\.example\.com/)).toBeNull();
  });

  it("never renders a cover image — honest placeholder only", () => {
    render(<BrandCard brand={BRAND} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
