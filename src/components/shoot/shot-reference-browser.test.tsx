// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

import { ShotReferenceBrowser } from "./shot-reference-browser";

afterEach(() => cleanup());

const CURRENT_ID = "11111111-1111-4111-8111-111111111111";
const COMPATIBLE_ID = "22222222-2222-4222-8222-222222222222";
const INCOMPATIBLE_ID = "33333333-3333-4333-8333-333333333333";

const PREVIEW_URL =
  "https://res.cloudinary.com/demo/image/authenticated/s--sig--/t_asset-masonry/v1789/ipix/reference-library/clothing_model_full_body_front.jpg";

function entry(overrides: Partial<ShotReferenceCatalogEntry> & { id: string; referenceKey: string }): ShotReferenceCatalogEntry {
  return {
    angle: "Full body front",
    description: "Full body front on a seamless studio backdrop",
    channelFit: ["shopify_pdp"],
    background: "studio",
    category: "clothing",
    subcategory: "model",
    modelType: "female",
    tags: [],
    hasPreview: true,
    ...overrides,
  };
}

const CURRENT_ENTRY = entry({ id: CURRENT_ID, referenceKey: "clothing_model_full_body_front" });
const COMPATIBLE_ENTRY = entry({
  id: COMPATIBLE_ID,
  referenceKey: "clothing_model_full_body_side",
  angle: "Full body side",
});
const INCOMPATIBLE_ENTRY = entry({
  id: INCOMPATIBLE_ID,
  referenceKey: "beauty_product_45_hero",
  category: "beauty",
  subcategory: "product",
  modelType: "none",
  angle: "45\u00b0 hero",
  hasPreview: false,
});

const CATALOG = [CURRENT_ENTRY, COMPATIBLE_ENTRY, INCOMPATIBLE_ENTRY];

const CONTEXT = { productCategory: "clothing", modelType: "female" };

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ url: PREVIEW_URL }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderBrowser(props: Partial<ComponentProps<typeof ShotReferenceBrowser>> = {}) {
  const onSelect = vi.fn();
  render(
    <ShotReferenceBrowser
      currentReferenceId={CURRENT_ID}
      catalog={CATALOG}
      deliverableChannel="shopify"
      context={CONTEXT}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect };
}

describe("ShotReferenceBrowser", () => {
  it("renders a visual grid of trusted reference cards", () => {
    renderBrowser();

    const grid = screen.getByTestId("reference-grid");
    expect(grid.getAttribute("role")).toBe("list");
    expect(screen.getAllByTestId("reference-card")).toHaveLength(3);
    expect(screen.getByTestId("reference-current-badge").textContent).toContain("Current reference");
  });

  it("returns the current reference id unchanged when the operator keeps it", () => {
    const { onSelect } = renderBrowser();

    fireEvent.click(screen.getByTestId("reference-keep"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(CURRENT_ID);
  });

  it("returns only the trusted reference id when replacing with a compatible reference", () => {
    const { onSelect } = renderBrowser();

    const replaceButtons = screen.getAllByTestId("reference-replace");
    fireEvent.click(replaceButtons[0]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(COMPATIBLE_ID);
    expect(screen.queryByTestId("reference-blocked")).toBeNull();
  });

  it("blocks an incompatible replacement with an explanation and emits nothing", () => {
    const { onSelect } = renderBrowser();

    // The beauty/product card is incompatible with the clothing deliverable.
    const cards = screen.getAllByTestId("reference-card");
    const beautyCard = cards.find((card) => card.getAttribute("data-reference-id") === INCOMPATIBLE_ID);
    expect(beautyCard).toBeTruthy();

    const replaceButton = beautyCard!.querySelector('[data-testid="reference-replace"]');
    expect(replaceButton).toBeTruthy();
    fireEvent.click(replaceButton!);

    expect(onSelect).not.toHaveBeenCalled();
    const alert = screen.getByTestId("reference-blocked");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toContain("Cannot replace");
    expect(alert.textContent).toContain("different product category");
  });

  it("fails closed for a reference with no approved image and never requests a preview", () => {
    renderBrowser({ catalog: [INCOMPATIBLE_ENTRY], currentReferenceId: INCOMPATIBLE_ID });

    expect(screen.getByTestId("reference-no-preview").textContent).toContain("No approved image yet");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the exact-version signed preview for a reference that has an approved image", async () => {
    renderBrowser();

    await waitFor(() => {
      expect(screen.getAllByTestId("reference-preview-image").length).toBeGreaterThan(0);
    });

    const image = screen.getAllByTestId("reference-preview-image")[0] as HTMLImageElement;
    expect(image.getAttribute("src")).toBe(PREVIEW_URL);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/references/${CURRENT_ID}/preview?preview=masonry`,
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("surfaces a 409 missing mapping as unavailable instead of rendering an image", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ reason: "missing_approved_media" }) });

    renderBrowser({ catalog: [CURRENT_ENTRY], currentReferenceId: CURRENT_ID });

    await waitFor(() => {
      expect(screen.getByTestId("reference-preview-unavailable").textContent).toContain("Preview unavailable");
    });
    expect(screen.queryByTestId("reference-preview-image")).toBeNull();
  });

  it("filters the grid by category", () => {
    renderBrowser();

    fireEvent.change(screen.getByTestId("reference-filter-category"), { target: { value: "beauty" } });

    const cards = screen.getAllByTestId("reference-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("data-reference-id")).toBe(INCOMPATIBLE_ID);
  });

  it("reports an empty catalog instead of inventing references", () => {
    renderBrowser({ catalog: [] });

    expect(screen.getByTestId("reference-empty").textContent).toContain("No trusted references");
    expect(screen.queryByTestId("reference-grid")).toBeNull();
  });

  it("reveals trusted metadata in the detail view", () => {
    renderBrowser();

    const toggleButtons = screen.getAllByTestId("reference-toggle-details");
    expect(toggleButtons[0].getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggleButtons[0]);

    const details = screen.getByTestId("reference-details");
    expect(details.textContent).toContain("Full body front");
    expect(details.textContent).toContain("clothing");
    expect(details.textContent).toContain("clothing_model_full_body_front");
    expect(toggleButtons[0].getAttribute("aria-expanded")).toBe("true");
  });

  it("never exposes raw Cloudinary provider identity to the client", () => {
    renderBrowser();

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("cloudinary_asset_id");
    expect(text).not.toContain("public_id");
    expect(document.body.innerHTML).not.toContain("asset_id");
  });
});
