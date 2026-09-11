// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

const getVerifiedOperatorFromCookies = vi.hoisted(() => vi.fn());
const serverCreateClient = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect,
  notFound,
  usePathname: () => "/app",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => createElement("a", { href, ...props }, children),
}));

vi.mock("../src/components/operator-panel/operator-panel.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

// @copilotkit/react-core/v2's package entry pulls in its own bundled CSS,
// which this repo's plain-node Vitest config (no CSS transform) can't load.
// Stubbed here — these tests assert route/layout wiring, not CopilotKit's
// internals (see operator-panel.test.tsx for the same stub).
vi.mock("@copilotkit/react-core/v2", () => ({
  CopilotKit: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  CopilotChat: () => createElement("div", { "data-testid": "copilot-chat-stub" }),
}));

vi.mock("../src/components/ui/empty-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

vi.mock("../src/app/planner-app", () => ({
  PlannerApp: () =>
    createElement(
      "div",
      { "data-testid": "planner-app" },
      createElement("h1", null, "Planner"),
      createElement("p", null, "Planner surface content"),
    ),
}));

vi.mock("../src/lib/auth/copilot-hooks", () => ({
  getVerifiedOperatorFromCookies,
}));

vi.mock("../src/lib/supabase/server", () => ({
  createClient: serverCreateClient,
}));

import AppSectionPage from "../src/app/app/[section]/page";
import AppLayout from "../src/app/app/layout";
import PlannerPage from "../src/app/planner/page";
import {
  requireAppWorkspace,
  requireResolvedAppWorkspace,
} from "../src/lib/auth/app-shell";

const operator = { id: "11111111-1111-4111-8111-111111111111", name: "qa@example.com" };

function clientWithOrgIds(orgIds: string[], error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: vi.fn().mockResolvedValue({
          data: orgIds.map((org_id) => ({ org_id })),
          error,
        }),
      }),
    }),
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  redirect.mockClear();
  notFound.mockClear();
  getVerifiedOperatorFromCookies.mockReset();
  serverCreateClient.mockReset();
});

describe("requireAppWorkspace", () => {
  it("redirects signed-out operators to login @T0dd76dd8", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(null);
    await expect(requireAppWorkspace()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("returns the signed-in operator @T0893ae76", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    await expect(requireAppWorkspace()).resolves.toEqual(operator);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("requireResolvedAppWorkspace", () => {
  it("admits a single-org operator @Te831eff9", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockResolvedValue(
      clientWithOrgIds(["22222222-2222-4222-8222-222222222222"]),
    );
    await expect(requireResolvedAppWorkspace()).resolves.toEqual(operator);
  });

  it("uses caller-provided workspace dependencies @T49c63b2b", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    await expect(
      requireResolvedAppWorkspace({
        getServerClient: async () => ({} as never),
        listOrgIds: async () => ({
          ok: true as const,
          orgIds: ["22222222-2222-4222-8222-222222222222"],
        }),
      }),
    ).resolves.toEqual(operator);
    expect(serverCreateClient).not.toHaveBeenCalled();
  });

  it("redirects a zero-org operator before the app shell mounts @T61eedddf", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockResolvedValue(clientWithOrgIds([]));
    await expect(requireResolvedAppWorkspace()).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("redirects a multi-org operator before the app shell mounts @T44e4342f", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockResolvedValue(
      clientWithOrgIds([
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ]),
    );
    await expect(requireResolvedAppWorkspace()).rejects.toThrow("REDIRECT:/org-selection");
  });

  it("fails closed when the membership lookup fails @Tbd7fb4bc", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockResolvedValue(clientWithOrgIds([], new Error("db")));
    await expect(requireResolvedAppWorkspace()).rejects.toThrow("REDIRECT:/login");
  });

  it("fails closed when the server Supabase client is unavailable @T5fa205e9", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockResolvedValue(null);
    await expect(requireResolvedAppWorkspace()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("APP-001 route split", () => {
  it("signed-in /app layout exposes the operator workspace around children @T518c1adf", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockResolvedValue(
      clientWithOrgIds(["22222222-2222-4222-8222-222222222222"]),
    );
    const ui = await AppLayout({
      children: createElement("p", null, "Workspace body"),
    });
    render(ui);
    expect(screen.getByTestId("operator-panel")).toBeDefined();
    expect(screen.getByText("Workspace body")).toBeDefined();
  });

  it("signed-in /planner does not expose the operator workspace @Tca04d226", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    const ui = await PlannerPage();
    render(ui);
    // The Planner surface renders its own content (representative fixture)…
    expect(screen.getByTestId("planner-app")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Planner" })).toBeDefined();
    // …and the operator workspace shell is not wrapped around /planner.
    expect(screen.queryByTestId("operator-panel")).toBeNull();
  });

  it("signed-out /planner redirects to login @T32b89593", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(null);
    await expect(PlannerPage()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("unknown /app/[section] calls notFound @T26f01279", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockResolvedValue(
      clientWithOrgIds(["22222222-2222-4222-8222-222222222222"]),
    );
    await expect(
      AppSectionPage({ params: Promise.resolve({ section: "not-a-real-section" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  // IPI-1068 · BRAND-001 — "brands" was removed from the [section]
  // placeholder map now that src/app/app/brands/page.tsx (a static route,
  // which Next.js always prefers over this dynamic catch-all) owns
  // /app/brands for real. This regression-guards against the catch-all
  // ever serving a stale placeholder for brands again if that static route
  // were ever removed.
  it("[section] no longer serves brands — that's now a dedicated static route @T0e99541e", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockResolvedValue(
      clientWithOrgIds(["22222222-2222-4222-8222-222222222222"]),
    );
    await expect(
      AppSectionPage({ params: Promise.resolve({ section: "brands" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("redirects a zero-org operator from an app section before rendering it @T94ae7c7c", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockResolvedValue(clientWithOrgIds([]));
    await expect(
      AppSectionPage({ params: Promise.resolve({ section: "brands" }) }),
    ).rejects.toThrow("REDIRECT:/onboarding");
  });
});
