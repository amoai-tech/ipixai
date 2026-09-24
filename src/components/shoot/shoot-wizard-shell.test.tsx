// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("./shoot-wizard-shell.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mocks = vi.hoisted(() => ({ compose: vi.fn() }));

vi.mock("@/app/app/shoots/new/actions", () => ({
  composeShootPlanForWizard: mocks.compose,
}));

vi.mock("@/components/shoot/shoot-plan-review-session", () => ({
  ShootPlanReviewSession: ({ brandId, plan, onStartFailed }: { brandId: string; plan: Record<string, unknown>; onStartFailed?: () => void }) => (
    <div data-testid="mock-review-session">
      {brandId}:{String((plan.productRefs as Array<{ providerProductId: string }>)[0]?.providerProductId ?? "")}
      <button type="button" onClick={onStartFailed}>Simulate review failure</button>
    </div>
  ),
}));

import { ShootWizardShell } from "./shoot-wizard-shell";

const BRANDS = [
  { id: "brand-1", name: "Everlane" },
  { id: "brand-2", name: "Acme Studio" },
];

afterEach(() => cleanup());

describe("ShootWizardShell", () => {
  it("renders the six-step wizard with Basics active", () => {
    render(<ShootWizardShell brands={BRANDS} />);

    expect(screen.getByRole("heading", { name: "Basics" })).toBeDefined();
    expect(screen.getByText("Step 1 of 6")).toBeDefined();
    for (const label of ["Basics", "Brief", "Deliverables", "Shot List", "Budget", "Confirmation"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("blocks Continue until required Basics fields are complete", () => {
    render(<ShootWizardShell brands={BRANDS} />);
    const continueButton = screen.getByRole("button", { name: /Continue/ });
    expect(continueButton).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "brand-1" } });
    fireEvent.change(screen.getByLabelText("Shoot name"), { target: { value: "SS26 Campaign" } });
    fireEvent.click(screen.getByLabelText("IG Feed"));
    expect(continueButton).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "photo" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Studio 1" } });
    expect(continueButton).toHaveProperty("disabled", false);
  });

  it("collects the production details required by the canonical ShootPlan", () => {
    render(<ShootWizardShell brands={BRANDS} />);

    expect(screen.getByLabelText("Media type")).toBeDefined();
    expect(screen.getByLabelText("Location")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "brand-1" } });
    fireEvent.change(screen.getByLabelText("Shoot name"), { target: { value: "SS26 Campaign" } });
    fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "photo" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Studio 1" } });
    fireEvent.click(screen.getByLabelText("IG Feed"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(screen.getByLabelText("Objective")).toBeDefined();
    expect(screen.getByLabelText("Crew size")).toBeDefined();
    expect(screen.getByLabelText("Studio type")).toBeDefined();
    expect(screen.getByLabelText("Schedule start")).toBeDefined();
    expect(screen.getByLabelText("Schedule end")).toBeDefined();
  });

  it("carries exact ProductRef identity through the canonical plan and into the existing review owner", async () => {
    const productRef = {
      provider: "shopify",
      providerProductId: "prod-123",
      providerVariantId: "variant-456",
      title: "Black Dress",
    };
    const plan = {
      status: "complete",
      productRefs: [productRef],
      missingInputs: [],
      warnings: [],
      deliverablesResult: {
        status: "ok", assumptions: [], warnings: [], missingInputs: [], totalAssets: 1,
        deliverables: [{ channel: "instagram_feed", format: "4:5 JPG", formatSource: "test", quantity: 1, source: "test", assumed: true }],
      },
      shotListResult: {
        status: "ok", assumptions: [], warnings: [], missingInputs: [], totalShots: 1,
        shots: [{ shotNumber: 1, description: "Front hero", angle: "front", lighting: "soft", deliverableIds: ["d-0"], referenceId: "ref-1" }],
      },
      budgetResult: { status: "ok", assumptions: [], warnings: [], missingInputs: [], total: 2450, currency: "USD" },
    };
    mocks.compose.mockResolvedValueOnce({ ok: true, plan });

    render(<ShootWizardShell brands={BRANDS} productRefs={[productRef]} />);
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "brand-1" } });
    fireEvent.change(screen.getByLabelText("Shoot name"), { target: { value: "SS26 Campaign" } });
    fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "photo" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Studio 1" } });
    fireEvent.click(screen.getByLabelText("IG Feed"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill("Objective", "Launch the SS26 line");
    fill("Brief", "Clean premium campaign");
    fill("Lighting", "Soft daylight");
    fill("Set / background", "Warm neutral cyc");
    fill("Talent", "One model");
    fill("Crew description", "Lean ecommerce crew");
    fill("Crew size", "4");
    fill("Studio", "Studio 1");
    fill("Studio type", "rental");
    fill("Equipment", "Camera, lenses, lighting");
    fill("Schedule start", "2026-10-01");
    fill("Schedule end", "2026-10-01");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    await screen.findByTestId("wizard-deliverables");
    expect(mocks.compose).toHaveBeenCalledWith(expect.objectContaining({
      shootName: "SS26 Campaign",
      productRefs: [productRef],
      productNames: ["Black Dress"],
    }));
    expect(screen.getByText(/instagram_feed · 4:5 JPG × 1/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByTestId("wizard-shot-list")).toBeDefined();
    expect(screen.getByText(/reference ref-1/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByTestId("wizard-budget")).toBeDefined();
    expect(screen.getByText("USD 2450")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByTestId("wizard-product-refs").textContent).toContain("prod-123");
    expect(screen.getByTestId("wizard-product-refs").textContent).toContain("variant-456");

    fireEvent.click(screen.getByRole("button", { name: "Review exact plan" }));
    await waitFor(() => expect(screen.getByTestId("mock-review-session").textContent).toContain("brand-1:prod-123"));
  });

  it("discards an in-flight composition result after the operator edits the brief", async () => {
    let resolveCompose!: (value: unknown) => void;
    mocks.compose.mockReturnValueOnce(new Promise((resolve) => { resolveCompose = resolve; }));

    render(<ShootWizardShell brands={BRANDS} />);
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "brand-1" } });
    fireEvent.change(screen.getByLabelText("Shoot name"), { target: { value: "SS26 Campaign" } });
    fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "photo" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Studio 1" } });
    fireEvent.click(screen.getByLabelText("IG Feed"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill("Objective", "Launch"); fill("Brief", "Original brief"); fill("Lighting", "Soft");
    fill("Set / background", "Neutral"); fill("Talent", "Model"); fill("Crew description", "Crew");
    fill("Crew size", "4"); fill("Studio", "Studio 1"); fill("Studio type", "rental");
    fill("Equipment", "Camera"); fill("Schedule start", "2026-10-01"); fill("Schedule end", "2026-10-01");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    fill("Brief", "Changed while composing");
    await act(async () => {
      resolveCompose({ ok: true, plan: {
        status: "complete", productRefs: [], missingInputs: [], warnings: [],
        deliverablesResult: { status: "ok", deliverables: [], assumptions: [], warnings: [], missingInputs: [], totalAssets: 0 },
        shotListResult: null,
        budgetResult: { status: "ok", total: 100, currency: "USD", assumptions: [], warnings: [], missingInputs: [] },
      } });
    });

    expect(screen.getByRole("heading", { name: "Brief" })).toBeDefined();
    expect(screen.queryByTestId("wizard-deliverables")).toBeNull();
  });

  it("returns to an obvious retry action when review staging fails", async () => {
    const plan = {
      status: "complete", productRefs: [], missingInputs: [], warnings: [],
      deliverablesResult: { status: "ok", deliverables: [], assumptions: [], warnings: [], missingInputs: [], totalAssets: 0 },
      shotListResult: null,
      budgetResult: { status: "ok", total: 100, currency: "USD", assumptions: [], warnings: [], missingInputs: [] },
    };
    mocks.compose.mockResolvedValueOnce({ ok: true, plan });
    render(<ShootWizardShell brands={BRANDS} />);
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "brand-1" } });
    fireEvent.change(screen.getByLabelText("Shoot name"), { target: { value: "SS26 Campaign" } });
    fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "photo" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Studio 1" } });
    fireEvent.click(screen.getByLabelText("IG Feed"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill("Objective", "Launch"); fill("Brief", "Brief"); fill("Lighting", "Soft"); fill("Set / background", "Neutral");
    fill("Talent", "Model"); fill("Crew description", "Crew"); fill("Crew size", "4"); fill("Studio", "Studio 1");
    fill("Studio type", "rental"); fill("Equipment", "Camera"); fill("Schedule start", "2026-10-01"); fill("Schedule end", "2026-10-01");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await screen.findByTestId("wizard-deliverables");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review exact plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Simulate review failure" }));

    expect(screen.getByRole("button", { name: "Review exact plan" })).toBeDefined();
  });

  it("recovers when the client-side compose request rejects", async () => {
    mocks.compose.mockRejectedValueOnce(new Error("network failed"));
    render(<ShootWizardShell brands={BRANDS} />);
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "brand-1" } });
    fireEvent.change(screen.getByLabelText("Shoot name"), { target: { value: "SS26 Campaign" } });
    fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "photo" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Studio 1" } });
    fireEvent.click(screen.getByLabelText("IG Feed"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill("Objective", "Launch"); fill("Brief", "Brief"); fill("Lighting", "Soft"); fill("Set / background", "Neutral");
    fill("Talent", "Model"); fill("Crew description", "Crew"); fill("Crew size", "4"); fill("Studio", "Studio 1");
    fill("Studio type", "rental"); fill("Equipment", "Camera"); fill("Schedule start", "2026-10-01"); fill("Schedule end", "2026-10-01");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be composed"));
    expect(screen.getByRole("button", { name: /Continue/ })).toHaveProperty("disabled", false);
  });

  it("keeps a composed plan when productRefs are reallocated with identical content", async () => {
    const productRef = { provider: "shopify", providerProductId: "prod-123", providerVariantId: "variant-456", title: "Black Dress" };
    const plan = {
      status: "complete", productRefs: [productRef], missingInputs: [], warnings: [],
      deliverablesResult: { status: "ok", deliverables: [], assumptions: [], warnings: [], missingInputs: [], totalAssets: 0 },
      shotListResult: null,
      budgetResult: { status: "ok", total: 100, currency: "USD", assumptions: [], warnings: [], missingInputs: [] },
    };
    mocks.compose.mockResolvedValueOnce({ ok: true, plan });
    const view = render(<ShootWizardShell brands={BRANDS} productRefs={[productRef]} />);
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "brand-1" } });
    fireEvent.change(screen.getByLabelText("Shoot name"), { target: { value: "SS26 Campaign" } });
    fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "photo" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Studio 1" } });
    fireEvent.click(screen.getByLabelText("IG Feed"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill("Objective", "Launch"); fill("Brief", "Brief"); fill("Lighting", "Soft"); fill("Set / background", "Neutral"); fill("Talent", "Model");
    fill("Crew description", "Crew"); fill("Crew size", "4"); fill("Studio", "Studio 1"); fill("Studio type", "rental"); fill("Equipment", "Camera");
    fill("Schedule start", "2026-10-01"); fill("Schedule end", "2026-10-01");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await screen.findByTestId("wizard-deliverables");

    view.rerender(<ShootWizardShell brands={BRANDS} productRefs={[{ ...productRef }]} />);
    expect(screen.getByTestId("wizard-deliverables")).toBeDefined();
  });

  it("moves forward and back without any persistence side effect", () => {
    render(<ShootWizardShell brands={BRANDS} />);

    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "brand-1" } });
    fireEvent.change(screen.getByLabelText("Shoot name"), { target: { value: "SS26 Campaign" } });
    fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "photo" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Studio 1" } });
    fireEvent.click(screen.getByLabelText("IG Feed"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(screen.getByRole("heading", { name: "Brief" })).toBeDefined();
    expect(screen.getByText("Step 2 of 6")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByRole("heading", { name: "Basics" })).toBeDefined();
    expect(screen.getByDisplayValue("SS26 Campaign")).toBeDefined();
  });
});
