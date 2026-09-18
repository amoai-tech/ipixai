// @vitest-environment jsdom
// IPI-1157 · AUTH-UX-001 — Split Sign In and Sign Up and Add Safe Exit Paths
//
// Mirrors tests/auth-navigation.test.ts's mocking setup (this file duplicates
// the mock boilerplate deliberately, rather than sharing it, to keep each
// route's test file independently readable — the same pattern already used
// between auth-navigation.test.ts and boundary-routes.test.ts).
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
    const DynamicForm = (props: { next: string | null }) => {
      const [Comp, setComp] = useState<React.ComponentType<{ next: string | null }> | null>(null);
      useEffect(() => {
        lastNextProp.value = props.next;
        loader().then((m) => setComp(() => m));
      }, [props.next]);
      return Comp ? createElement(Comp, props) : null;
    };
    return DynamicForm;
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

vi.mock("../src/lib/supabase/server", () => ({
  createClient: serverCreateClient,
  createClientFromRequest: vi.fn(),
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

import { SignupForm } from "../src/app/(marketing)/signup/signup-form";
import SignupPage from "../src/app/(marketing)/signup/page";

const operator = { id: "11111111-1111-4111-8111-111111111111", name: "qa@example.com" };

function defaultServerClient() {
  return {
    from: () => ({ select: () => ({ eq: orgMembersQuery }) }),
  };
}

beforeEach(() => {
  serverCreateClient.mockReturnValue(defaultServerClient());
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
});

describe("IPI-1157 · AUTH-UX-001 — /signup", () => {
  it("renders signup intent only — heading, no sign-in toggle, links to /login", async () => {
    render(createElement(SignupForm, { next: null }));
    expect(screen.getByRole("heading", { name: "Sign up" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });

  it("signup path calls signUp() and never signInWithPassword()", async () => {
    signUp.mockResolvedValue({ data: { session: {} }, error: null });
    render(createElement(SignupForm, { next: null }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({ email: "new@example.com", password: "secret" });
      expect(push).toHaveBeenCalledWith("/app");
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("signup without immediate session shows the email-confirmation state and does not navigate", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(createElement(SignupForm, { next: null }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => {
      expect(screen.getByText(/Check your email to confirm your account/i)).toBeDefined();
    });
    expect(push).not.toHaveBeenCalled();
    // "Back to sign in" is a plain link now (mode is route-owned, not a client toggle).
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/login");
  });

  it("preserves a safe next target on the confirmation screen's Back to sign in link", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(createElement(SignupForm, { next: "/planner" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => {
      expect(screen.getByText(/Check your email to confirm your account/i)).toBeDefined();
    });
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe(
      "/login?next=%2Fplanner",
    );
  });

  it("duplicate-submit guard: a second immediate click produces exactly one signUp call", async () => {
    signUp.mockResolvedValue({ data: { session: {} }, error: null });
    render(createElement(SignupForm, { next: null }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    const submit = screen.getByRole("button", { name: "Sign up" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(signUp).toHaveBeenCalledTimes(1);
  });

  it("preserves a safe next target across the /login <-> /signup cross-link", async () => {
    render(createElement(SignupForm, { next: "/planner" }));
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
      "/login?next=%2Fplanner",
    );
  });

  it("signup page redirects an already-authenticated single-org operator away from /signup", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    await expect(SignupPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/app");
    expect(redirect).toHaveBeenCalledWith("/app");
  });

  it("signup page redirects an already-authenticated zero-org operator to /onboarding", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    orgMembersQuery.mockResolvedValue({ data: [], error: null });
    await expect(SignupPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "REDIRECT:/onboarding",
    );
  });

  it("signup page redirects to /login on membership lookup failure (fail closed)", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    orgMembersQuery.mockResolvedValue({ data: null, error: new Error("db") });
    await expect(SignupPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("signup page fails closed (renders the form) when the server client is unavailable", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(operator);
    serverCreateClient.mockReturnValue(null);
    const ui = await SignupPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(redirect).not.toHaveBeenCalled();
    expect(await screen.findByLabelText("Email")).toBeDefined();
  });

  it("signup page rejects an external redirect target structurally (safeRedirect reused, not a second policy)", async () => {
    getVerifiedOperatorFromCookies.mockResolvedValue(null);
    const ui = await SignupPage({
      searchParams: Promise.resolve({ next: "https://evil.example" }),
    });
    render(ui);
    expect(await screen.findByLabelText("Email")).toBeDefined();
    expect(lastNextProp.value).toBeNull();
  });
});
