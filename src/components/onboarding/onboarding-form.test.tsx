// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mock every CSS module the tree imports (OnboardingForm → ErrorState).
vi.mock("../ui/error-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { OnboardingForm } from "./onboarding-form";

type TestSession = {
  id: string;
  user_id: string;
  idempotency_key: string;
  status: string;
  current_screen: number;
  draft_answers: Record<string, unknown>;
  organization_id: string | null;
  brand_id: string | null;
};

const DRAFT_SESSION: TestSession = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "22222222-2222-2222-2222-222222222222",
  idempotency_key: "key-1",
  status: "draft",
  current_screen: 1,
  draft_answers: { brandName: "Maison Noir", websiteUrl: "" },
  organization_id: null,
  brand_id: null,
};

const MATERIALIZED_SESSION: TestSession = {
  ...DRAFT_SESSION,
  status: "materialized",
  organization_id: "33333333-3333-3333-3333-333333333333",
  brand_id: "44444444-4444-4444-4444-444444444444",
};

/** Explicit success + failure shapes so the mock accepts both (review fix). */
type RpcResponse =
  | { data: { organization_id: string; brand_id: string }; error: null }
  | { data: null; error: { message: string } };

function fakeSupabase(session: TestSession) {
  const supabase = {
    from: vi.fn(() => supabase),
    select: vi.fn(() => supabase),
    eq: vi.fn(() => supabase),
    // First maybeSingle = getOrCreateOnboardingSession (returns the session);
    // subsequent = hasMaterializedOnboardingSession (no other materialized row).
    maybeSingle: vi
      .fn()
      .mockResolvedValueOnce({ data: session, error: null })
      .mockResolvedValue({ data: null, error: null }),
    // updateOnboardingSessionDraft selects the updated row id via .single().
    single: vi.fn().mockResolvedValue({ data: { id: session.id }, error: null }),
    insert: vi.fn(() => supabase),
    update: vi.fn(() => supabase),
    rpc: vi.fn<() => Promise<RpcResponse>>().mockResolvedValue({
      data: {
        organization_id: "33333333-3333-3333-3333-333333333333",
        brand_id: "44444444-4444-4444-4444-444444444444",
      },
      error: null,
    }),
  };
  return supabase;
}

// Stable router identity: useRouter() must return the same object every render,
// otherwise the load effect re-runs on every setState and re-enters the
// get-or-create path (second run hits the insert branch).
const { replaceMock, routerMock } = vi.hoisted(() => {
  const replaceMock = vi.fn();
  return { replaceMock, routerMock: { replace: replaceMock } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => supabaseMock,
}));

let supabaseMock: ReturnType<typeof fakeSupabase>;

const TEST_USER_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  // Seed the per-user idempotency key so the component's key matches the mock
  // session's idempotency_key ("key-1") instead of minting a fresh UUID.
  localStorage.setItem(`ipix:onboarding:idempotency:v1:${TEST_USER_ID}`, "key-1");
});

afterEach(() => {
  cleanup();
  replaceMock.mockReset();
  localStorage.clear();
});

describe("OnboardingForm (IPI-1089 · ONBOARD-001)", () => {
  it("renders the draft form for a zero-org user", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    const form = await screen.findByTestId("onboarding-form");
    expect(form).toBeDefined();
    expect(screen.getByLabelText("Brand name")).toBeDefined();
    expect(screen.getByLabelText(/Website/)).toBeDefined();
  });

  it("resumes an existing draft", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    expect((screen.getByLabelText("Brand name") as HTMLInputElement).value).toBe("Maison Noir");
  });

  it("redirects to /app when the session is already materialized", async () => {
    supabaseMock = fakeSupabase(MATERIALIZED_SESSION);
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
  });

  it("blocks submit when brand name is blank", async () => {
    supabaseMock = fakeSupabase({ ...DRAFT_SESSION, draft_answers: {} });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("materializes and hands off to /app on submit", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Maison Noir" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
    expect(supabaseMock.rpc).toHaveBeenCalledWith("materialize_onboarding_session", {
      p_idempotency_key: "key-1",
      p_brand_name: "Maison Noir",
      p_brand_url: null,
    });
  });

  it("persists a pending draft before materializing on submit", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    const order: string[] = [];
    let resolveUpdate!: (value: { data: { id: string }; error: null }) => void;
    const updateGate = new Promise<{ data: { id: string }; error: null }>((resolve) => {
      resolveUpdate = resolve;
    });
    supabaseMock.update.mockImplementation(() => {
      order.push("update");
      return {
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => updateGate,
            }),
          }),
        }),
      } as never;
    });
    supabaseMock.rpc.mockImplementation(async () => {
      order.push("rpc");
      return {
        data: {
          organization_id: "33333333-3333-3333-3333-333333333333",
          brand_id: "44444444-4444-4444-4444-444444444444",
        },
        error: null,
      };
    });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    // Distinct value so React fires onChange (the draft already holds "Maison Noir").
    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "New Brand" },
    });
    // Submit before the 400ms debounce fires so the save is still pending.
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    // The save is still in flight — materialization must wait for it.
    await waitFor(() => expect(order).toContain("update"));
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    resolveUpdate({ data: { id: DRAFT_SESSION.id }, error: null });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
    expect(order.indexOf("rpc")).toBeGreaterThan(order.indexOf("update"));
  });

  it("blocks materialization when the draft save fails", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    supabaseMock.update.mockReturnValue({
      eq: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: "network down" } }),
          }),
        }),
      }),
    } as never);
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "New Brand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("recovers when the user retries after a failed draft save", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    supabaseMock.update
      .mockReturnValueOnce({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "network down" } }),
            }),
          }),
        }),
      } as never)
      .mockReturnValue(supabaseMock);
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "New Brand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    // Retry re-saves the failed snapshot, then submit materializes + navigates.
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
    expect(supabaseMock.rpc).toHaveBeenCalled();
  });

  it("redirects to /app when a concurrent materialization already won", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "onboarding_sessions_one_materialized_per_user"',
      },
    });
    // getOrCreate → draft; load hasMaterialized → none; post-failure
    // hasMaterialized → the other context's materialized row.
    supabaseMock.maybeSingle
      .mockReset()
      .mockResolvedValueOnce({ data: DRAFT_SESSION, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "materialized-1" }, error: null });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "New Brand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
    expect(screen.queryByTestId("onboarding-submit-error")).toBeNull();
  });

  it("shows a retryable error when materialization fails", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: "unauthorized" } });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Maison Noir" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("recovers when the user retries after a failed materialization", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: "unauthorized" } });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Maison Noir" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
  });
});

// IPI-1263 · ONBOARD-COMPAT-001 — resume/fallback at the component boundary.
describe("OnboardingForm — legacy session compatibility (IPI-1263)", () => {
  const LEGACY_SESSION: TestSession = {
    ...DRAFT_SESSION,
    // A pre-IPI-1089 multi-screen draft: current_screen > 1 while status
    // stays "draft" only happens for rows an older onboarding iteration
    // wrote — current code never advances current_screen itself.
    current_screen: 7,
    draft_answers: {
      brandName: "Maison Noir",
      websiteUrl: "https://maisonnoir.com",
      instagramHandle: "@maisonnoir",
      industry: "fashion",
    },
  };

  it("resumes a legacy multi-screen draft, prefilling known fields without crashing", async () => {
    supabaseMock = fakeSupabase(LEGACY_SESSION);
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    const form = await screen.findByTestId("onboarding-form");
    expect(form).toBeDefined();
    expect((screen.getByLabelText("Brand name") as HTMLInputElement).value).toBe("Maison Noir");
    expect((screen.getByLabelText(/Website/) as HTMLInputElement).value).toBe("https://maisonnoir.com");
  });

  it("routes a draft row healed to screen 12 through the normal form — screen 12 alone never means done", async () => {
    // IPI-903 heals *materialized* rows to screen 12; a draft row must not
    // be short-circuited to /app just because current_screen says 12.
    supabaseMock = fakeSupabase({ ...LEGACY_SESSION, current_screen: 12 });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    expect(replaceMock).not.toHaveBeenCalledWith("/app");
  });

  it("preserves unrecognized legacy keys through an autosave instead of dropping them", async () => {
    supabaseMock = fakeSupabase(LEGACY_SESSION);
    let savedPayload: Record<string, unknown> | undefined;
    supabaseMock.update.mockImplementation((patch?: Record<string, unknown>) => {
      savedPayload = patch?.draft_answers as Record<string, unknown>;
      return {
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: LEGACY_SESSION.id }, error: null }),
            }),
          }),
        }),
      } as never;
    });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Maison Noir Updated" },
    });
    // Submit flushes the debounced autosave immediately instead of waiting 400ms.
    fireEvent.click(screen.getByRole("button", { name: "Create brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
    expect(savedPayload).toMatchObject({
      brandName: "Maison Noir Updated",
      websiteUrl: "https://maisonnoir.com",
      instagramHandle: "@maisonnoir",
      industry: "fashion",
    });
  });
});