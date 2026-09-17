// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

import { ShotReferenceBrowser } from "./shot-reference-browser";

afterEach(() => {
  cleanup();
});

const CURRENT_ID = "11111111-1111-4111-8111-111111111111";
const COMPATIBLE_ID = "22222222-2222-4222-8222-222222222222";
const INCOMPATIBLE_ID = "33333333-3333-4333-8333-333333333333";

const PREVIEW_URL =
  "https://res.cloudinary.com/demo/image/authenticated/s--sig--/t_asset-masonry/v1789/ipix/reference-library/clothing_model_full_body_front.jpg";

/**
 * Explicit optional-field shape (rather than `Partial<T> & {...}`) so the
 * fixture stays a single, resolved object type.
 */
type EntryOverrides = {
  id: string;
  referenceKey: string;
  angle?: string;
  description?: string;
  channelFit?: string[];
  background?: string | null;
  category?: string | null;
  subcategory?: string | null;
  modelType?: string | null;
  tags?: string[] | null;
  hasPreview?: boolean;
};

function entry(overrides: EntryOverrides): ShotReferenceCatalogEntry {
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
    json: () => Promise.resolve({ url: PREVIEW_URL }),
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

  it("never shows the missing-preview message on a reference that has an approved image", async () => {
    renderBrowser();

    const cards = screen.getAllByTestId("reference-card");
    const currentCard = cards.find((card) => card.getAttribute("data-reference-id") === CURRENT_ID);
    if (!(currentCard instanceof HTMLElement)) {
      throw new Error("the current reference card is missing from the grid");
    }

    // Before the signed URL resolves the card must show a loading state, never
    // the "No approved image yet" message, because this reference has a preview.
    expect(within(currentCard).queryByTestId("reference-no-preview")).toBeNull();

    await waitFor(() => {
      expect(within(currentCard).getByTestId("reference-preview-image")).toBeTruthy();
    });

    expect(within(currentCard).queryByTestId("reference-no-preview")).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("returns the current reference id unchanged when the operator keeps it", () => {
    const { onSelect } = renderBrowser();

    fireEvent.click(screen.getByTestId("reference-keep"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(CURRENT_ID);
  });

  it("refuses to keep a reference that is absent from the trusted catalog", () => {
    const { onSelect } = renderBrowser({ currentReferenceId: "99999999-9999-4999-8999-999999999999" });

    expect(screen.getByTestId("reference-current-summary").textContent).toContain("not in the trusted catalog");

    const keep = screen.getByTestId("reference-keep");
    expect(keep instanceof HTMLButtonElement && keep.disabled).toBe(true);
    fireEvent.click(keep);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("gives each mounted browser a unique heading id", () => {
    render(
      <>
        <ShotReferenceBrowser
          currentReferenceId={CURRENT_ID}
          catalog={CATALOG}
          deliverableChannel="shopify"
          context={CONTEXT}
          onSelect={vi.fn()}
        />
        <ShotReferenceBrowser
          currentReferenceId={CURRENT_ID}
          catalog={CATALOG}
          deliverableChannel="shopify"
          context={CONTEXT}
          onSelect={vi.fn()}
        />
      </>,
    );

    const ids = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.id);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it("ignores a stale preview response that resolves after the card expands", async () => {
    const STALE_URL =
      "https://res.cloudinary.com/demo/image/authenticated/s--stale--/t_asset-masonry/v1/ipix/reference-library/stale.jpg";
    let resolveStaleJson: (value: { url: string }) => void = () => {};
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise<{ url: string }>((resolve) => {
            resolveStaleJson = resolve;
          }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ url: PREVIEW_URL }),
      });

    renderBrowser({ catalog: [CURRENT_ENTRY], currentReferenceId: CURRENT_ID });

    // The stale "card" preview response is still in flight when the card expands.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByTestId("reference-toggle-details"));

    await waitFor(() => {
      expect(screen.getByTestId("reference-preview-image").getAttribute("src")).toBe(PREVIEW_URL);
    });

    // Resolving the abandoned request must not overwrite the current preview.
    resolveStaleJson({ url: STALE_URL });

    await waitFor(() => {
      expect(screen.getByTestId("reference-preview-image").getAttribute("src")).toBe(PREVIEW_URL);
    });
    expect(screen.getByTestId("reference-preview-image").getAttribute("src")).not.toBe(STALE_URL);
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
    if (!beautyCard) throw new Error("the incompatible card is missing from the grid");

    const replaceButton = beautyCard.querySelector('[data-testid="reference-replace"]');
    if (!(replaceButton instanceof HTMLElement)) throw new Error("the incompatible card has no replace control");
    fireEvent.click(replaceButton);

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

    // eslint-disable-next-line xss/no-mixed-html -- reading rendered attributes in a test, not building HTML
    const renderedImg = screen.getAllByTestId("reference-preview-image")[0] as HTMLImageElement;
    expect(renderedImg.getAttribute("src")).toBe(PREVIEW_URL);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/references/${CURRENT_ID}/preview?preview=masonry`,
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("surfaces a 409 missing mapping as unavailable instead of rendering an image", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ reason: "missing_approved_media" }),
    });

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
    // eslint-disable-next-line xss/no-mixed-html -- asserting the rendered markup in a test, not building HTML
    const renderedMarkup = document.body.innerHTML;
    expect(renderedMarkup).not.toContain("asset_id");
  });
});
