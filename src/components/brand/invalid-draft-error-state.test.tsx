// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * IPI-1093 · BRAND-INTEL-001 (task-verifier finding) — a malformed draft
 * previously had no recovery path ("please re-run the analysis" was a dead
 * end, since startBrandAnalysis's claim guard rejects draft_ready). Proves
 * the fix: the discard action calls decideBrandDraft with approved:false
 * and the exact draftHash, and only refreshes on success.
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

// ErrorState pulls in a CSS Module; PostCSS isn't configured for this test
// runner's Vite pipeline (same workaround error-state.test.tsx uses).
vi.mock("@/components/ui/error-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { InvalidDraftErrorState } from "./invalid-draft-error-state";

const BRAND_ID = "11111111-1111-1111-1111-111111111111";
const DRAFT_HASH = "malformed-draft-hash-H1";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("InvalidDraftErrorState", () => {
  it("discard calls decideBrandDraft(brandId, draftHash, false) and refreshes on success", async () => {
    mocks.decideBrandDraft.mockResolvedValue({ ok: true, approved: false, message: "Draft rejected." });

    render(<InvalidDraftErrorState brandId={BRAND_ID} draftHash={DRAFT_HASH} />);
    fireEvent.click(screen.getByRole("button", { name: /discard this draft/i }));

    await vi.waitFor(() => {
      expect(mocks.decideBrandDraft).toHaveBeenCalledWith(BRAND_ID, DRAFT_HASH, false);
    });
    await vi.waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("on failure (e.g. FORBIDDEN), shows the error and does not refresh", async () => {
    mocks.decideBrandDraft.mockResolvedValue({
      ok: false,
      approved: false,
      message: "You do not have permission to approve this brand's draft.",
    });

    render(<InvalidDraftErrorState brandId={BRAND_ID} draftHash={DRAFT_HASH} />);
    fireEvent.click(screen.getByRole("button", { name: /discard this draft/i }));

    await screen.findByText(/do not have permission/i);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
