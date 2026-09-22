// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { ConfigError, createClientMock, signInWithOAuthMock } = vi.hoisted(() => {
  class ConfigError extends Error {
    constructor() {
      super("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
      this.name = "SupabaseConfigError";
    }
  }

  return {
    ConfigError,
    createClientMock: vi.fn(),
    signInWithOAuthMock: vi.fn(),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: createClientMock,
  SupabaseConfigError: ConfigError,
}));

vi.mock("./auth-form.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

let AuthForm: typeof import("./auth-form").AuthForm;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_GOOGLE_OAUTH_ENABLED", "true");
  ({ AuthForm } = await import("./auth-form"));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

afterAll(() => vi.unstubAllEnvs());

function mockMissingSupabaseConfig() {
  createClientMock.mockImplementation(() => {
    throw new ConfigError();
  });
}

function mockReturnedOAuthError() {
  signInWithOAuthMock.mockResolvedValue({
    data: { provider: "google", url: null },
    error: new Error("OAuth unavailable"),
  });
  createClientMock.mockReturnValue({
    auth: { signInWithOAuth: signInWithOAuthMock },
  });
}

describe("AuthForm Google OAuth errors", () => {
  it("shows the sign-in outage message when Supabase client configuration is missing", async () => {
    mockMissingSupabaseConfig();
    render(<AuthForm mode="signin" next={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sign in is temporarily unavailable. Please try again shortly.",
    );
  });

  it("shows the sign-up outage message when Supabase client configuration is missing", async () => {
    mockMissingSupabaseConfig();
    render(<AuthForm mode="signup" next={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sign up is temporarily unavailable. Please try again shortly.",
    );
  });

  it("uses the current form mode when signInWithOAuth returns an error", async () => {
    mockReturnedOAuthError();
    render(<AuthForm mode="signup" next={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Sign up failed");
  });
});
