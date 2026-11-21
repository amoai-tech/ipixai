// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

import { ShootPlanReview } from "./shoot-plan-review";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  navigation.push.mockReset();
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

const SIDE_ID = "44444444-4444-4444-8444-444444444444";
const THIRD_ID = "55555555-5555-4555-8555-555555555555";

const MULTI_CATALOG = [
  entry({ id: CURRENT_ID, referenceKey: "clothing_model_full_body_front" }),
  entry({
    id: SIDE_ID,
    referenceKey: "clothing_model_full_body_side",
    angle: "Full body side",
  }),
  entry({
    id: THIRD_ID,
    referenceKey: "clothing_model_full_body_back",
    angle: "Full body back",
  }),
];

/**
 * `ShootPlanSchema.referencesUsed` is an array and `composeShootPlan` derives it
 * positionally from `shotListResult.shots`, so a plan may review more than one
 * reference — including the same reference id used by two shots.
 */
function multiPlan(references: { id: string; angle: string }[], shotIds: string[]) {
  return {
    objective: { value: "Launch the spring capsule", status: "confirmed" },
    channels: ["shopify"],
    referencesUsed: references,
    shotListResult: {
      shots: shotIds.map((referenceId, index) => ({
        shotNumber: index + 1,
        description: `Shot ${index + 1}`,
        angle: references[index]?.angle ?? "Full body front",
        referenceId,
      })),
    },
  };
}

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

function revisionCalls() {
  return fetchMock.mock.calls.filter((call) =>
    String(call[0]).includes("/revision"),
  );
}

/** The exact plan body the operator staged in the last /revision request. */
function stagedPlan(): Record<string, unknown> {
  const [call] = revisionCalls();
  const body = JSON.parse(String((call[1] as RequestInit).body)) as {
    plan: Record<string, unknown>;
  };
  return body.plan;
}

/**
 * Replace the reference currently in review with `targetId`: expand the target
 * card, then click its Replace button. The browser renders one card per catalog
 * entry, so the card is targeted by its reference id.
 */
async function replaceReference(targetId: string = COMPATIBLE_ID) {
  const card = document.querySelector(
    `[data-testid="reference-card"][data-reference-id="${targetId}"]`,
  );
  if (!card) throw new Error(`reference card not found for ${targetId}`);
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

describe("ShootPlanReview — multiple references", () => {
  function stageResponse() {
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
  }

  it("reviews each reference on its own and replaces only the selected one", async () => {
    stageResponse();
    renderReview({
      plan: multiPlan(
        [
          { id: CURRENT_ID, angle: "Full body front" },
          { id: SIDE_ID, angle: "Full body side" },
        ],
        [CURRENT_ID, SIDE_ID],
      ),
      catalog: MULTI_CATALOG,
    });

    expect(screen.getByTestId("review-reference-active").textContent).toContain(
      "Reviewing reference 1 of 2",
    );

    fireEvent.click(screen.getByTestId("review-reference-select-1"));
    await waitFor(() =>
      expect(screen.getByTestId("review-reference-active").textContent).toContain(
        "Reviewing reference 2 of 2",
      ),
    );

    await replaceReference(THIRD_ID);
    await waitFor(() => expect(screen.getByTestId("review-edited")).toBeTruthy());
    fireEvent.click(screen.getByTestId("review-save-revision"));
    await waitFor(() => expect(revisionCalls()).toHaveLength(1));

    const plan = stagedPlan();
    expect(plan.referencesUsed).toEqual([
      { id: CURRENT_ID, angle: "Full body front" },
      { id: THIRD_ID, angle: "Full body side" },
    ]);
    const shots = (plan.shotListResult as { shots: { referenceId: string }[] }).shots;
    expect(shots[0].referenceId).toBe(CURRENT_ID);
    expect(shots[1].referenceId).toBe(THIRD_ID);
  });

  it("replaces only the selected entry when two references share one id", async () => {
    stageResponse();
    // A value-based replace would rewrite both entries here.
    renderReview({
      plan: multiPlan(
        [
          { id: CURRENT_ID, angle: "Full body front" },
          { id: CURRENT_ID, angle: "Full body back" },
        ],
        [CURRENT_ID, CURRENT_ID],
      ),
      catalog: MULTI_CATALOG,
    });

    fireEvent.click(screen.getByTestId("review-reference-select-1"));
    await waitFor(() =>
      expect(screen.getByTestId("review-reference-active").textContent).toContain(
        "Reviewing reference 2 of 2",
      ),
    );

    await replaceReference(THIRD_ID);
    await waitFor(() => expect(screen.getByTestId("review-edited")).toBeTruthy());
    fireEvent.click(screen.getByTestId("review-save-revision"));
    await waitFor(() => expect(revisionCalls()).toHaveLength(1));

    const plan = stagedPlan();
    expect(plan.referencesUsed).toEqual([
      { id: CURRENT_ID, angle: "Full body front" },
      { id: THIRD_ID, angle: "Full body back" },
    ]);
    const shots = (plan.shotListResult as { shots: { referenceId: string }[] }).shots;
    expect(shots[0].referenceId).toBe(CURRENT_ID);
    expect(shots[1].referenceId).toBe(THIRD_ID);
  });

  it("hides the picker for a single-reference plan", () => {
    renderReview();

    expect(screen.queryByTestId("review-reference-select-0")).toBeNull();
    expect(screen.getByTestId("review-reference-active").textContent).toContain(
      "Reviewing reference 1 of 1",
    );
  });
});

describe("ShootPlanReview — explicit approve and save", () => {
  const SHOOT_ID = "66666666-6666-4666-8666-666666666666";
  const decision = { ok: true, status: 200, json: () => Promise.resolve({
    ok: true, resumeState: "resumed", message: "recorded",
  }) };

  it("sends only the exact approved ID to the existing save-once API, then opens the Shoot", async () => {
    const onSettled = vi.fn().mockResolvedValue(undefined);
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/decision")) return decision;
      if (url === "/api/shoots/save") return {
        ok: true, status: 200,
        json: () => Promise.resolve({ ok: true, shootId: SHOOT_ID, replayed: false }),
      };
      return { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) };
    });

    renderReview({ onSettled });
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/shoots/save")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/app/shoots/" + SHOOT_ID));
    const saves = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/shoots/save");
    expect(saves).toHaveLength(1);
    expect(JSON.parse(String((saves[0][1] as RequestInit).body))).toEqual({ approvalId: APPROVAL_ID });
    const decisions = decisionCalls();
    expect(decisions).toHaveLength(1);
    expect(JSON.parse(String((decisions[0][1] as RequestInit).body))).toEqual({
      revision: REVISION, planHash: PLAN_HASH, decision: "approved", note: null,
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("does not save or resume if approval was rejected by the server", async () => {
    const onSettled = vi.fn();
    fetchMock.mockImplementation(async (url: string) => url.includes("/decision")
      ? { ok: false, status: 409, json: () => Promise.resolve({ reason: "stale_revision" }) }
      : { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) });
    renderReview({ onSettled });
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() => expect(screen.getByTestId("review-error")).toBeTruthy());
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/shoots/save")).toHaveLength(0);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("keeps the review open on save failure; retry uses the same approval identity", async () => {
    const onSettled = vi.fn();
    let saves = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/decision")) return decision;
      if (url === "/api/shoots/save") {
        saves++;
        return saves === 1
          ? { ok: false, status: 503, json: () => Promise.resolve({ error: "save_failed" }) }
          : { ok: true, status: 200, json: () => Promise.resolve({ ok: true, shootId: SHOOT_ID, replayed: true }) };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) };
    });
    renderReview({ onSettled });
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() => expect(screen.getByTestId("review-error").textContent).toContain("not confirmed saved"));
    expect(onSettled).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/app/shoots/" + SHOOT_ID));
    const requests = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/shoots/save");
    expect(requests).toHaveLength(2);
    expect(requests.map(([, init]) => JSON.parse(String((init as RequestInit).body)))).toEqual([
      { approvalId: APPROVAL_ID }, { approvalId: APPROVAL_ID },
    ]);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      reason: "save_failed", status: 503,
      message: "save service could not confirm", guidance: "retry Approve & save",
    },
    {
      reason: "forbidden", status: 403,
      message: "do not have permission", guidance: "Contact a brand owner",
    },
    {
      reason: "not_approved", status: 409,
      message: "plan is not approved", guidance: "Check its approval status",
    },
    {
      reason: "superseded_revision", status: 409,
      message: "newer plan revision exists", guidance: "approve the latest version",
    },
    {
      reason: "hash_mismatch", status: 409,
      message: "does not match", guidance: "Reload and review",
    },
    {
      reason: "invalid_plan", status: 400,
      message: "plan is invalid", guidance: "Reload and review",
    },
  ])("shows actionable $reason instead of a generic save failure", async ({
    reason, status, message, guidance,
  }) => {
    const onSettled = vi.fn();
    fetchMock.mockImplementation(async (url: string) => url.includes("/decision") ? decision :
      url === "/api/shoots/save"
        ? { ok: false, status, json: () => Promise.resolve({ error: "error", reason }) }
        : { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) });
    renderReview({ onSettled });
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() =>
      expect(screen.getByTestId("review-error").textContent).toContain(message),
    );
    expect(screen.getByTestId("review-error").textContent).toContain(guidance);
    expect(onSettled).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("handles an unauthorized error without a reason and never exposes unknown server text", async () => {
    const onSettled = vi.fn();
    fetchMock.mockImplementation(async (url: string) => url.includes("/decision") ? decision :
      url === "/api/shoots/save"
        ? { ok: false, status: 401, json: () => Promise.resolve({ error: "unauthorized" }) }
        : { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) });
    renderReview({ onSettled });
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() =>
      expect(screen.getByTestId("review-error").textContent).toContain("Sign in again"),
    );
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("does not display unknown or sensitive error details returned by the save API", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("/decision") ? decision :
      url === "/api/shoots/save"
        ? {
            ok: false, status: 503,
            json: () => Promise.resolve({ error: "private-server-debug-info", reason: "internal_secret_123" }),
          }
        : { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) });
    renderReview();
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() =>
      expect(screen.getByTestId("review-error").textContent).toContain("save service could not confirm"),
    );
    expect(screen.getByTestId("review-error").textContent).not.toContain("private-server-debug-info");
    expect(screen.getByTestId("review-error").textContent).not.toContain("internal_secret_123");
  });

  it("does not claim the approval failed if the save network request throws after approval", async () => {
    const onSettled = vi.fn();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/decision")) return decision;
      if (url === "/api/shoots/save") throw new TypeError("Failed to fetch");
      return { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) };
    });
    renderReview({ onSettled });
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() => {
      const error = screen.getByTestId("review-error").textContent ?? "";
      expect(error).toContain("not confirmed saved");
      expect(error).toContain("retry Approve & save");
      expect(error).not.toContain("decision could not be recorded");
    });
    expect(onSettled).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("reports a saved Shoot even when Planner resume fails, with a working detail link", async () => {
    const onSettled = vi.fn().mockRejectedValue(new Error("Planner run unavailable"));
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/decision")) return decision;
      if (url === "/api/shoots/save") return {
        ok: true, status: 200,
        json: () => Promise.resolve({ ok: true, shootId: SHOOT_ID, replayed: false }),
      };
      return { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) };
    });
    renderReview({ onSettled });
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() => expect(screen.getByTestId("saved-shoot-link").getAttribute("href"))
      .toBe("/app/shoots/" + SHOOT_ID));
    expect(screen.getByTestId("review-error").textContent)
      .toContain("Shoot saved, but Planner could not resume");
    expect(navigation.push).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/shoots/save")).toHaveLength(1);
  });

  it("rejects an invalid returned Shoot ID instead of navigating to an untrusted URL", async () => {
    const onSettled = vi.fn();
    fetchMock.mockImplementation(async (url: string) => url.includes("/decision") ? decision :
      url === "/api/shoots/save"
        ? { ok: true, status: 200, json: () => Promise.resolve({ ok: true, shootId: "https://evil.invalid" }) }
        : { ok: true, status: 200, json: () => Promise.resolve({ url: PREVIEW_URL }) });
    renderReview({ onSettled });
    fireEvent.click(screen.getByTestId("review-approve-and-save"));
    await waitFor(() => expect(screen.getByTestId("review-error")).toBeTruthy());
    expect(navigation.push).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });
});

describe("ShootPlanReview — decisions", () => {
  it("labels every decision button from the exhaustive lookup", () => {
    renderReview();

    expect(screen.getByTestId("review-approved").textContent).toBe("Approve plan");
    expect(screen.getByTestId("review-rejected").textContent).toBe("Reject plan");
    expect(screen.getByTestId("review-changes-requested").textContent).toBe("Request changes");
    expect(screen.getByTestId("review-cancelled").textContent).toBe("Cancel review");
  });

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
