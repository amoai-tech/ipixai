// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

import { ShootPlanReview } from "./shoot-plan-review";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const APPROVAL_ID = "33333333-3333-4333-8333-333333333333";
const BRAND_ID = "22222222-2222-4222-8222-222222222222";
const PLAN_HASH = "hash-abc";
const REVISION = 3;

const CURRENT_ID = "11111111-1111-4111-8111-111111111111";
const COMPATIBLE_ID = "22222222-2222-4222-8222-222222222222";

const PREVIEW_URL =
  "https://res.cloudinary.com/demo/image/authenticated/s--sig--/t_asset-masonry/v1789/ipix/reference-library/clothing_model_full_body_front.jpg";

function entry(
  overrides: Partial<ShotReferenceCatalogEntry> & { id: string; referenceKey: string },
): ShotReferenceCatalogEntry {
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

const CATALOG = [
  entry({ id: CURRENT_ID, referenceKey: "clothing_model_full_body_front" }),
  entry({
    id: COMPATIBLE_ID,
    referenceKey: "clothing_model_full_body_side",
    angle: "Full body side",
  }),
];

const PLAN = {
  objective: { value: "Launch the spring capsule", status: "confirmed" },
  channels: ["shopify"],
  location: { value: "Studio A", status: "assumed" },
  referencesUsed: [{ id: CURRENT_ID, angle: "Full body front" }],
  shotListResult: {
    shots: [
      {
        shotNumber: 1,
        description: "Hero front",
        angle: "Full body front",
        referenceId: CURRENT_ID,
      },
    ],
  },
  missingInputs: ["Budget ceiling"],
};

const IDENTITY = {
  approvalId: APPROVAL_ID,
  brandId: BRAND_ID,
  revision: REVISION,
  planHash: PLAN_HASH,
};

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

function renderReview(props: Record<string, unknown> = {}) {
  return render(
    <ShootPlanReview
      identity={IDENTITY}
      plan={PLAN}
      catalog={CATALOG}
      deliverableChannel="shopify"
      {...props}
    />,
  );
}

function decisionCalls() {
  return fetchMock.mock.calls.filter((call) =>
    String(call[0]).includes("/decision"),
  );
}

/**
 * Replace the current reference with the compatible one: expand the compatible
 * card, then click its Replace button. The browser renders one card per catalog
 * entry, so the card is targeted by its reference id.
 */
async function replaceReference() {
  const card = document.querySelector(
    `[data-testid="reference-card"][data-reference-id="${COMPATIBLE_ID}"]`,
  );
  if (!card) throw new Error("compatible reference card not found");
  fireEvent.click(within(card as HTMLElement).getByTestId("reference-toggle-details"));
  await waitFor(() =>
    expect(within(card as HTMLElement).getByTestId("reference-replace")).toBeTruthy(),
  );
  fireEvent.click(within(card as HTMLElement).getByTestId("reference-replace"));
}

describe("ShootPlanReview — canonical plan", () => {
  it("renders the objective, revision and missing inputs", () => {
    renderReview();

    expect(screen.getByTestId("shoot-plan-review")).toBeTruthy();
    expect(screen.getByTestId("review-objective").textContent).toContain(
      "Launch the spring capsule",
    );
    expect(screen.getByTestId("review-revision").textContent).toContain(`Revision ${REVISION}`);
    expect(screen.getByTestId("review-missing-inputs").textContent).toContain("Budget ceiling");
  });

  it("renders the production and shot sections", () => {
    renderReview();

    expect(screen.getByTestId("review-section-production").textContent).toContain("Studio A");
    expect(screen.getByTestId("review-section-shots").textContent).toContain("Hero front");
  });

  it("mounts the trusted reference browser", () => {
    renderReview();

    expect(screen.getByTestId("shot-reference-browser")).toBeTruthy();
  });
});

describe("ShootPlanReview — keep and replace", () => {
  it("does not write anything when the operator keeps the current reference", () => {
    renderReview();

    expect(screen.queryByTestId("review-edited")).toBeNull();
    expect(decisionCalls()).toHaveLength(0);
  });

  it("changes only local review state when a reference is replaced", async () => {
    renderReview();

    await replaceReference();

    await waitFor(() => expect(screen.getByTestId("review-edited")).toBeTruthy());
    expect(decisionCalls()).toHaveLength(0);
  });

  it("refuses to record a decision while an edit is unstaged", async () => {
    renderReview();

    await replaceReference();
    await waitFor(() => expect(screen.getByTestId("review-edited")).toBeTruthy());

    fireEvent.click(screen.getByTestId("review-approved"));

    await waitFor(() =>
      expect(screen.getByTestId("review-error").textContent).toContain(
        "Stage this edit as a new revision",
      ),
    );
    expect(decisionCalls()).toHaveLength(0);
  });

  it("stages an edit as a new revision and reports the superseded revision", async () => {
    const onRevised = vi.fn();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/revision")) {
        return {
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              approvalId: APPROVAL_ID,
              brandId: BRAND_ID,
              revision: REVISION + 1,
              planHash: "hash-new",
              supersededRevision: REVISION,
            }),
        };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) };
    });

    renderReview({ onRevised });

    await replaceReference();
    await waitFor(() => expect(screen.getByTestId("review-edited")).toBeTruthy());

    fireEvent.click(screen.getByTestId("review-save-revision"));

    await waitFor(() =>
      expect(screen.getByTestId("review-revision").textContent).toContain(
        `superseded revision ${REVISION}`,
      ),
    );
    expect(screen.getByTestId("shoot-plan-review").getAttribute("data-revision")).toBe(
      String(REVISION + 1),
    );
    expect(onRevised).toHaveBeenCalledTimes(1);
  });
});

describe("ShootPlanReview — decisions", () => {
  it.each([
    ["approved", "review-approved"],
    ["rejected", "review-rejected"],
    ["changes_requested", "review-changes-requested"],
    ["cancelled", "review-cancelled"],
  ])("records the %s decision and settles the review", async (decision, testId) => {
    const onSettled = vi.fn();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/decision")) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: true,
              identity: { ...IDENTITY, status: decision },
              replayed: false,
              resumeState: "resumed",
              message: "recorded",
            }),
        };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) };
    });

    renderReview({ onSettled });

    fireEvent.click(screen.getByTestId(testId));

    await waitFor(() => expect(screen.getByTestId("review-outcome")).toBeTruthy());
    expect(screen.getByTestId("review-outcome").textContent).toContain(`${decision} recorded.`);
    expect(onSettled).toHaveBeenCalledTimes(1);
    const [call] = decisionCalls();
    const body = JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body.decision).toBe(decision);
    expect(body.revision).toBe(REVISION);
    expect(body.planHash).toBe(PLAN_HASH);
  });

  it("surfaces a typed failure without settling the review", async () => {
    const onSettled = vi.fn();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/decision")) {
        return {
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: "error", reason: "stale_revision" }),
        };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) };
    });

    renderReview({ onSettled });

    fireEvent.click(screen.getByTestId("review-approved"));

    await waitFor(() => expect(screen.getByTestId("review-error")).toBeTruthy());
    expect(screen.getByTestId("review-error").textContent).toContain("reload the current revision");
    expect(onSettled).not.toHaveBeenCalled();
    expect(screen.queryByTestId("review-outcome")).toBeNull();
  });

  it("reports a recorded decision that has not resumed yet", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/decision")) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: true,
              identity: { ...IDENTITY, status: "approved" },
              replayed: false,
              resumeState: "resume_failed",
              message: "recorded",
            }),
        };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) };
    });

    renderReview();

    fireEvent.click(screen.getByTestId("review-approved"));

    await waitFor(() => expect(screen.getByTestId("review-outcome")).toBeTruthy());
    expect(screen.getByTestId("review-outcome").textContent).toContain("has not resumed yet");
  });
});
