// @vitest-environment jsdom
import { createElement, useEffect, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const getVerifiedOperatorFromCookies = vi.hoisted(() => vi.fn());

const signInWithPassword = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => vi.fn());
const getClaims = vi.hoisted(() => vi.fn());
const signInWithOAuth = vi.hoisted(() => vi.fn());

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_OAUTH_ENABLED = "true";
});

vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

const lastNextProp = vi.hoisted(() => ({ value: null as string | null }));

vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<React.ComponentType<{ next: string | null }>>,
  ) => {
    const DynamicLoginForm = (props: { next: string | null }) => {
      const [Comp, setComp] = useState<React.ComponentType<{ next: string | null }> | null>(null);
      useEffect(() => {
        lastNextProp.value = props.next;
        loader().then((m) => setComp(() => m));
      }, [props.next]);
      return Comp ? createElement(Comp, props) : null;
    };
    return DynamicLoginForm;
  },
}));

vi.mock("../src/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
      signUp,
      getClaims,
      signInWithOAuth,
    },
  }),
}));

const orgMembersQuery = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    data: [{ org_id: "22222222-2222-4222-8222-222222222222" }],
    error: null,
  }),
);

const serverCreateClient = vi.hoisted(() => vi.fn());
const serverCreateClientFromRequest = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/supabase/server", () => ({
  createClient: serverCreateClient,
  createClientFromRequest: serverCreateClientFromRequest,
}));

vi.mock("../src/components/auth/auth-form.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

vi.mock("../src/lib/auth/operator-auth", () => ({
  getVerifiedOperatorFromCookies,
}));

import type { NextRequest } from "next/server";
import { GET } from "../src/app/auth/callback/route";
import { LoginForm } from "../src/app/(marketing)/login/login-form";
import LoginPage from "../src/app/(marketing)/login/page";

const operator = { id: "11111111-1111-4111-8111-111111111111", name: "qa@example.com" };

function defaultServerClient() {
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { sub: operator.id, email: operator.name } },
        error: null,
      }),
    },
    from: () => ({ select: () => ({ eq: orgMembersQuery }) }),
  };
}

beforeEach(() => {
  serverCreateClient.mockReturnValue(defaultServerClient());
  serverCreateClientFromRequest.mockReturnValue(defaultServerClient());
});

afterEach(() => {
  cleanup();
  push.mockClear();
  refresh.mockClear();
  redirect.mockClear();
  getVerifiedOperatorFromCookies.mockReset();
  signInWithPassword.mockReset();
  signUp.mockReset();
  getClaims.mockReset();
  signInWithOAuth.mockReset();
  orgMembersQuery.mockReset();
  orgMembersQuery.mockResolvedValue({
    data: [{ org_id: "22222222-2222-4222-8222-222222222222" }],
    error: null,
  });
  serverCreateClient.mockReset();
  serverCreateClientFromRequest.mockReset();
});

describe("successful authentication navigates to /app", () => {
  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: login page redirects an already-authenticated single-org operator to /app", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    await expect(
      LoginPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/app");
    expect(redirect).toHaveBeenCalledWith("/app");
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: login page routes an already-authenticated zero-org operator to /onboarding", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    orgMembersQuery.mockResolvedValue({ data: [], error: null });
    await expect(
      LoginPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/onboarding");
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: login page fails closed (renders form) when the server client is unavailable", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockReturnValue(null);
    const ui = await LoginPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(redirect).not.toHaveBeenCalled();
    expect(await screen.findByLabelText("Email")).toBeDefined();
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: login page normalizes a repeated next query key", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(null);
    const ui = await LoginPage({
      searchParams: Promise.resolve({
        next: ["/planner", "/app"],
      }),
    });
    render(ui);
    expect(await screen.findByLabelText("Email")).toBeDefined();
    // The lazy form receives the normalized first query value.
    expect(lastNextProp.value).toBe("/planner");
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: login form pushes /app after a successful password sign-in", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    getClaims.mockResolvedValue({});
    render(createElement(LoginForm, { next: null }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "qa@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/app");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: invalid required fields do not call signInWithPassword", async () => {
    render(createElement(LoginForm, { next: null }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(signInWithPassword).not.toHaveBeenCalled();
    });
  });

  it("IPI-1157 · AUTH-UX-001 — Split Sign In and Sign Up: /login is sign-in intent only — no signup toggle, links to /signup instead", async () => {
    render(createElement(LoginForm, { next: null }));
    expect(screen.queryByRole("button", { name: "Create an account" })).toBeNull();
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/signup");
  });

  it("IPI-1157 · AUTH-UX-001 — Split Sign In and Sign Up: sign-in never calls signUp()", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    getClaims.mockResolvedValue({});
    render(createElement(LoginForm, { next: null }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "qa@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalled();
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: Google button becomes disabled after the first click", async () => {
    signInWithOAuth.mockReturnValue(new Promise(() => {}));
    render(createElement(LoginForm, { next: null }));
    const google = screen.getByRole("button", { name: "Continue with Google" });
    fireEvent.click(google);
    await waitFor(() => {
      expect(google.getAttribute("disabled")).not.toBeNull();
    });
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: auth callback redirects to /app after a successful code exchange", async () => {
    const url = new URL("http://localhost:3000/auth/callback?code=abc123");
    const request = { url: url.toString(), nextUrl: url } as unknown as NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/app");
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: auth callback rejects an external next target", async () => {
    const url = new URL(
      "http://localhost:3000/auth/callback?code=abc123&next=https://evil.example",
    );
    const request = { url: url.toString(), nextUrl: url } as unknown as NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/app");
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: auth callback does not honor next=/planner for a zero-org user", async () => {
    orgMembersQuery.mockResolvedValue({ data: [], error: null });
    const url = new URL(
      "http://localhost:3000/auth/callback?code=abc123&next=/planner",
    );
    const request = { url: url.toString(), nextUrl: url } as unknown as NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: auth callback preserves a query-bearing compatible next target", async () => {
    const url = new URL(
      "http://localhost:3000/auth/callback?code=abc123&next=/planner?tab=threads",
    );
    const request = { url: url.toString(), nextUrl: url } as unknown as NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/planner?tab=threads",
    );
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: auth callback provider error retains a safe next target on /login", async () => {
    const url = new URL(
      "http://localhost:3000/auth/callback?error=access_denied&next=/planner",
    );
    const request = { url: url.toString(), nextUrl: url } as unknown as NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Fplanner");
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: auth callback resolves the operator from the exchanged session (no incoming cookie)", async () => {
    // No getVerifiedOperatorForRequest mock — the callback must resolve the
    // operator from the response-bound client's claims after exchange.
    const url = new URL("http://localhost:3000/auth/callback?code=abc123");
    const request = { url: url.toString(), nextUrl: url } as unknown as NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/app");
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: auth callback with no verified session redirects to /login", async () => {
    serverCreateClientFromRequest.mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: {} },
          error: null,
        }),
      },
      from: () => ({ select: () => ({ eq: orgMembersQuery }) }),
    });
    const url = new URL("http://localhost:3000/auth/callback?code=abc123");
    const request = { url: url.toString(), nextUrl: url } as unknown as NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});