// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";

import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

/**
 * IPI-1084 · APPROVAL-001 — the CopilotKit HITL host contract.
 *
 * The catalog is module-cached, so the failure/retry ordering in this file is
 * deliberate: the retry test runs first, while the cache is still cold, and
 * proves a transient failure is not cached for the rest of the page session.
 */

const copilot = vi.hoisted(() => ({
  config: null as null | { render: (props: unknown) => unknown },
}));

vi.mock("@copilotkit/react-core/v2", () => ({
  useHumanInTheLoop: (config: { render: (props: unknown) => unknown }) => {
    copilot.config = config;
  },
}));

import { ShootPlanReviewHitl } from "./shoot-plan-review-hitl";

const APPROVAL_ID = "33333333-3333-4333-8333-333333333333";
const BRAND_ID = "22222222-2222-4222-8222-222222222222";
const REFERENCE_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_HASH = "hash-abc";
const REVISION = 3;
const PREVIEW_URL =
  "https://res.cloudinary.com/demo/image/authenticated/s--sig--/t_asset-masonry/v1789/ipix/reference-library/clothing_model_full_body_front.jpg";

const PLAN = {
  objective: { value: "Launch the spring capsule", status: "confirmed" },
  channels: ["shopify"],
  referencesUsed: [{ id: REFERENCE_ID, angle: "Full body front" }],
};

const CATALOG: ShotReferenceCatalogEntry[] = [
  {
    id: REFERENCE_ID,
    referenceKey: "clothing_model_full_body_front",
    angle: "Full body front",
    description: "Full body front on a seamless studio backdrop",
    channelFit: ["shopify_pdp"],
    background: "studio",
    category: "clothing",
    subcategory: "model",
    modelType: "female",
    tags: [],
    hasPreview: true,
  },
];

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

const START_BODY = {
  runId: "run-abc",
  approvalId: APPROVAL_ID,
  brandId: BRAND_ID,
  revision: REVISION,
  planHash: PLAN_HASH,
};

const DECISION_BODY = {
  ok: true,
  identity: { approvalId: APPROVAL_ID, revision: REVISION, planHash: PLAN_HASH, status: "approved" },
  replayed: false,
  resumeState: "resumed",
  message: "Plan approved.",
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  copilot.config = null;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Mounts the HITL registration and the Executing render-prop output. */
function renderFlow(): { respond: ReturnType<typeof vi.fn> } {
  const respond = vi.fn();
  render(<ShootPlanReviewHitl />);
  const config = copilot.config;
  if (!config) throw new Error("useHumanInTheLoop was not registered");
  render(
    config.render({
      status: "executing",
      args: { brandId: BRAND_ID, plan: PLAN },
      respond,
      toolCallId: "tool-call-1",
    }) as ReactElement,
  );
  return { respond };
}

describe("ShootPlanReviewHitl — reference catalog", () => {
  it("retries the catalog after a failed first load", async () => {
    let catalogAttempts = 0;
    fetchMock.mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("/api/plans/references")) {
        catalogAttempts += 1;
        if (catalogAttempts === 1) throw new Error("network down");
        return jsonResponse({ references: CATALOG });
      }
      if (href.includes("/api/plans/reviews")) return jsonResponse(START_BODY, 201);
      return jsonResponse({ url: PREVIEW_URL });
    });

    renderFlow();

    // First review: the catalog request failed, so the operator still gets the
    // plan review surface — just without the reference browser.
    await waitFor(() => expect(screen.getByTestId("shoot-plan-review")).toBeTruthy());
    expect(screen.queryByTestId("shot-reference-browser")).toBeNull();
    expect(catalogAttempts).toBe(1);

    cleanup();

    // A later review retries without a page reload, because the failure was not
    // cached.
    renderFlow();

    await waitFor(() => expect(screen.getByTestId("shot-reference-browser")).toBeTruthy());
    expect(catalogAttempts).toBe(2);
  });

  it("does not respond before the operator decides", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("/api/plans/references")) return jsonResponse({ references: CATALOG });
      if (href.includes("/api/plans/reviews")) return jsonResponse(START_BODY, 201);
      return jsonResponse({ url: PREVIEW_URL });
    });

    const { respond } = renderFlow();

    await waitFor(() => expect(screen.getByTestId("shoot-plan-review")).toBeTruthy());
    expect(respond).not.toHaveBeenCalled();
  });

  it("responds once with the recorded decision", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("/api/plans/references")) return jsonResponse({ references: CATALOG });
      if (href.includes("/api/plans/reviews")) return jsonResponse(START_BODY, 201);
      if (href.includes("/decision")) return jsonResponse(DECISION_BODY, 200);
      return jsonResponse({ url: PREVIEW_URL });
    });

    const { respond } = renderFlow();

    await waitFor(() => expect(screen.getByTestId("shoot-plan-review")).toBeTruthy());
    fireEvent.click(screen.getByTestId("review-approved"));

    await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
    expect(respond).toHaveBeenCalledWith({
      ok: true,
      decision: "approved",
      resumeState: "resumed",
    });
  });

  it("responds with a typed failure so the agent can retry the start", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("/api/plans/references")) return jsonResponse({ references: CATALOG });
      if (href.includes("/api/plans/reviews")) return jsonResponse({ reason: "forbidden" }, 403);
      return jsonResponse({ url: PREVIEW_URL });
    });

    const { respond } = renderFlow();

    await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
    expect(respond).toHaveBeenCalledWith({ ok: false, error: "review_start_failed" });
    expect(screen.getByTestId("shoot-plan-review-failed")).toBeTruthy();
  });
});
