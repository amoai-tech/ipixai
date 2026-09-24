// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);

const requireAppWorkspace = vi.hoisted(() => vi.fn());
const serverCreateClient = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("../src/lib/auth/app-shell", () => ({
  requireAppWorkspace,
}));

vi.mock("../src/lib/supabase/server", () => ({
  createClient: serverCreateClient,
}));

vi.mock("../src/components/onboarding/onboarding-form", () => ({
  OnboardingForm: ({ userId }: { userId: string }) =>
    createElement("div", { "data-testid": "onboarding-form" }, userId),
}));

import OnboardingPage from "../src/app/onboarding/page";

const operator = { id: "11111111-1111-4111-8111-111111111111", name: "qa@example.com" };

function clientWithOrgIds(orgIds: string[]) {
  return {
    from: () => ({
      select: () => ({
        eq: vi.fn().mockResolvedValue({
          data: orgIds.map((org_id) => ({ org_id })),
          error: null,
        }),
      }),
    }),
  };
}

beforeEach(() => {
  requireAppWorkspace.mockResolvedValue(operator);
});

afterEach(() => {
  cleanup();
  redirect.mockClear();
  requireAppWorkspace.mockReset();
  serverCreateClient.mockReset();
});

describe("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: boundary routes", () => {
  it("onboarding renders for a zero-org operator", async () => {
    serverCreateClient.mockReturnValue(clientWithOrgIds([]));
    const ui = await OnboardingPage();
    render(ui);
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByTestId("onboarding-form")).toBeDefined();
    // The authenticated operator id is passed through to the onboarding form.
    expect(screen.getByTestId("onboarding-form").textContent).toBe(operator.id);
  });

  it("IPI-1157 · AUTH-UX-001 — onboarding always renders a visible Sign out posting to /auth/sign-out", async () => {
    serverCreateClient.mockReturnValue(clientWithOrgIds([]));
    const ui = await OnboardingPage();
    const { container } = render(ui);
    const form = container.querySelector('form[action="/auth/sign-out"]');
    expect(form?.getAttribute("method")).toBe("post");
    const signOutButton = screen.getByRole("button", { name: "Sign out" });
    expect(signOutButton.closest("form")).toBe(form);
  });

  it("onboarding redirects a single-org operator to /app", async () => {
    serverCreateClient.mockReturnValue(
      clientWithOrgIds(["22222222-2222-4222-8222-222222222222"]),
    );
    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/app");
    expect(redirect).toHaveBeenCalledWith("/app");
  });

  it("IPI-1311 · AUTH-ORG-SINGLE-001 — onboarding fails closed to /login on a membership-conflict invariant violation", async () => {
    serverCreateClient.mockReturnValue(
      clientWithOrgIds([
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ]),
    );
    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("onboarding fails closed to /login on membership lookup failure", async () => {
    serverCreateClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: new Error("db") }),
        }),
      }),
    });
    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

});