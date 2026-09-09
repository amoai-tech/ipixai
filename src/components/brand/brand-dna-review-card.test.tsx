// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * IPI-1093 · BRAND-INTEL-001 — proves the actual consequential wiring: a
 * click on Approve/Reject calls the server action with the exact
 * `approved` boolean and the exact `draftHash` prop, unmodified. Neither
 * tests/get-brand-detail.test.ts nor tests/select-view.test.ts nor
 * tests/brand-detail-actions.test.ts cover this — they prove the state
 * selection is correct and the server action's own logic is correct, but
 * not that this component actually wires a click to the right call with
 * the right arguments. A swapped `approved: true`/`false` in the button
 * handlers would be a real HITL-safety bug that none of those would catch.
 */

const mocks = vi.hoisted(() => ({
  decideBrandDraft: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/app/brands/[brandId]/actions", () => ({
  decideBrandDraft: mocks.decideBrandDraft,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

// StatusChip pulls in a CSS Module; PostCSS isn't configured for this test
// runner's Vite pipeline (same workaround status-chip.test.tsx uses).
vi.mock("@/components/ui/status-chip.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

// StartAnalysisButton pulls in the same actions module + useRouter; stub it
// out so this test stays scoped to the review card's own Approve/Reject wiring.
vi.mock("@/components/brand/start-analysis-button", () => ({
  StartAnalysisButton: () => null,
}));

import { BrandDNAReviewCard } from "./brand-dna-review-card";
import type { BrandProfile } from "@/lib/brand/brand-profile-contract";

const DRAFT = {
  schemaVersion: 2,
  name: "Acme",
  tagline: { value: "T", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  category: { value: "C", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  targetAudience: { value: "A", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  visualIdentity: { colors: ["#fff"], mood: "m" },
  sourceUrl: "https://acme.co",
  scores: { visual: 80, audience: 70, consistency: 60, commerce_readiness: 50 },
} as unknown as BrandProfile;

const BRAND_ID = "11111111-1111-1111-1111-111111111111";
const DRAFT_HASH = "exact-reviewed-hash-H1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.decideBrandDraft.mockResolvedValue({ ok: true, approved: true, message: "Draft approved." });
});

afterEach(() => cleanup());

describe("BrandDNAReviewCard", () => {
  it("Approve calls decideBrandDraft with approved:true and the exact unmodified draftHash prop", async () => {
    render(
      <BrandDNAReviewCard brandId={BRAND_ID} draft={DRAFT} draftHash={DRAFT_HASH} draftScores={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await vi.waitFor(() => {
      expect(mocks.decideBrandDraft).toHaveBeenCalledTimes(1);
    });
    expect(mocks.decideBrandDraft).toHaveBeenCalledWith(BRAND_ID, DRAFT_HASH, true);
  });

  it("CRITICAL: Reject calls decideBrandDraft with approved:false, not true — a swapped boolean here would silently approve what the operator meant to reject", async () => {
    render(
      <BrandDNAReviewCard brandId={BRAND_ID} draft={DRAFT} draftHash={DRAFT_HASH} draftScores={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await vi.waitFor(() => {
      expect(mocks.decideBrandDraft).toHaveBeenCalledTimes(1);
    });
    expect(mocks.decideBrandDraft).toHaveBeenCalledWith(BRAND_ID, DRAFT_HASH, false);
  });

  it("displays the exact draftHash it was given, never a recomputed one — no client-side hashing of draft content occurs", async () => {
    render(
      <BrandDNAReviewCard brandId={BRAND_ID} draft={DRAFT} draftHash={DRAFT_HASH} draftScores={[]} />,
    );

    // The card truncates for display but the value must be a literal
    // substring of the exact prop, not a derived/recomputed digest.
    expect(screen.getByText(new RegExp(DRAFT_HASH.slice(0, 16)))).toBeDefined();
  });

  it("on a fail-closed decision (e.g. STALE_DRAFT), does NOT refresh the page — the card stays in place so the operator sees why", async () => {
    mocks.decideBrandDraft.mockResolvedValue({
      ok: false,
      approved: true,
      message: "Draft changed since review — please re-review before deciding.",
    });

    render(
      <BrandDNAReviewCard brandId={BRAND_ID} draft={DRAFT} draftHash={DRAFT_HASH} draftScores={[]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await screen.findByText(/re-review before deciding/i);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("on a committed decision (ok:true), refreshes the page to re-read durable truth", async () => {
    render(
      <BrandDNAReviewCard brandId={BRAND_ID} draft={DRAFT} draftHash={DRAFT_HASH} draftScores={[]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await vi.waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
  });
});
