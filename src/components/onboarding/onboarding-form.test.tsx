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
  draft_answers: {
    flowVersion: 2,
    resumeStep: "brand-details",
    buildType: null,
    brandName: "Maison Noir",
    websiteUrl: "",
    channels: [],
    channelIdentities: {},
    growthPreference: null,
  },
  organization_id: null,
  brand_id: null,
};

const READY_SESSION: TestSession = {
  ...DRAFT_SESSION,
  draft_answers: {
    ...DRAFT_SESSION.draft_answers,
    resumeStep: "growth-preference",
  },
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
const { replaceMock, startAnalysisMock, routerMock } = vi.hoisted(() => {
  const replaceMock = vi.fn();
  const startAnalysisMock = vi.fn().mockResolvedValue({ ok: true, message: "Brand analysis started." });
  return { replaceMock, startAnalysisMock, routerMock: { replace: replaceMock } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => supabaseMock,
}));

vi.mock("@/app/app/brands/[brandId]/actions", () => ({
  startBrandAnalysisAction: startAnalysisMock,
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
  startAnalysisMock.mockReset();
  startAnalysisMock.mockResolvedValue({ ok: true, message: "Brand analysis started." });
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
    supabaseMock = fakeSupabase({ ...READY_SESSION, draft_answers: { ...READY_SESSION.draft_answers, brandName: "" } });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("materializes and opens the created Brand on submit", async () => {
    supabaseMock = fakeSupabase(READY_SESSION);
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app/brands/44444444-4444-4444-4444-444444444444"));
    expect(supabaseMock.rpc).toHaveBeenCalledWith("materialize_onboarding_session", {
      p_idempotency_key: "key-1",
      p_brand_name: "Maison Noir",
      p_brand_url: null,
    });
  });

  it("persists a pending draft before materializing on submit", async () => {
    supabaseMock = fakeSupabase(READY_SESSION);
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
    // Submit before the 400ms debounce fires so the save is still pending.
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    // The save is still in flight — materialization must wait for it.
    await waitFor(() => expect(order).toContain("update"));
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    resolveUpdate({ data: { id: DRAFT_SESSION.id }, error: null });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app/brands/44444444-4444-4444-4444-444444444444"));
    expect(order.indexOf("rpc")).toBeGreaterThan(order.indexOf("update"));
  });

  it("blocks materialization when the draft save fails", async () => {
    supabaseMock = fakeSupabase(READY_SESSION);
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
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("recovers when the user retries after a failed draft save", async () => {
    supabaseMock = fakeSupabase(READY_SESSION);
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
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    // Retry re-saves the failed snapshot, then submit materializes + navigates.
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app/brands/44444444-4444-4444-4444-444444444444"));
    expect(supabaseMock.rpc).toHaveBeenCalled();
  });

  it("recovers to /app when a concurrent materialization already won", async () => {
    supabaseMock = fakeSupabase(READY_SESSION);
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
      .mockResolvedValueOnce({ data: READY_SESSION, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "materialized-1" }, error: null });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
    expect(screen.queryByTestId("onboarding-submit-error")).toBeNull();
  });

  it("shows a retryable error when materialization fails", async () => {
    supabaseMock = fakeSupabase(READY_SESSION);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: "unauthorized" } });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("recovers when the user retries after a failed materialization", async () => {
    supabaseMock = fakeSupabase(READY_SESSION);
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: "unauthorized" } });
    render(<OnboardingForm userId="22222222-2222-2222-2222-222222222222" />);
    await screen.findByTestId("onboarding-form");
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    expect(await screen.findByTestId("onboarding-submit-error")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app/brands/44444444-4444-4444-4444-444444444444"));
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
    expect(screen.getByRole("heading", { name: "How do you want to grow?" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "Where is your Brand active?" });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "Tell us about your Brand" });
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
    await screen.findByRole("heading", { name: "How do you want to grow?" });
    fireEvent.click(screen.getByLabelText("Social media"));
    // Final materialization flushes the latest V2 draft immediately.
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app/brands/44444444-4444-4444-4444-444444444444"));
    expect(savedPayload).toMatchObject({
      brandName: "Maison Noir",
      websiteUrl: "https://maisonnoir.com",
      instagramHandle: "@maisonnoir",
      industry: "fashion",
    });
  });
});
describe("OnboardingForm — IPI-1260 four-question flow", () => {
  const FRESH_V2_SESSION: TestSession = {
    ...DRAFT_SESSION,
    draft_answers: {
      flowVersion: 2,
      resumeStep: "build-type",
      buildType: null,
      brandName: "",
      websiteUrl: "",
      channels: [],
      channelIdentities: {},
      growthPreference: null,
    },
  };

  it("starts a fresh V2 user at Build Type instead of Brand Details", async () => {
    supabaseMock = fakeSupabase(FRESH_V2_SESSION);
    render(<OnboardingForm userId={TEST_USER_ID} />);
    expect(await screen.findByRole("heading", { name: "What are you building?" })).toBeDefined();
    expect(screen.queryByLabelText("Brand name")).toBeNull();
  });

  it("saves the durable next step before moving from Build Type to Brand Details", async () => {
    supabaseMock = fakeSupabase(FRESH_V2_SESSION);
    let savedPayload: Record<string, unknown> | undefined;
    supabaseMock.update.mockImplementation((patch?: Record<string, unknown>) => {
      savedPayload = patch?.draft_answers as Record<string, unknown>;
      return supabaseMock;
    });
    render(<OnboardingForm userId={TEST_USER_ID} />);
    await screen.findByRole("heading", { name: "What are you building?" });
    fireEvent.click(screen.getByLabelText("Clothing label"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByLabelText("Brand name")).toBeDefined();
    expect(savedPayload).toMatchObject({ buildType: "clothing", resumeStep: "brand-details" });
  });

  it("completes all four steps and starts Brand Intelligence when a website exists", async () => {
    supabaseMock = fakeSupabase(FRESH_V2_SESSION);
    let savedPayload: Record<string, unknown> | undefined;
    supabaseMock.update.mockImplementation((patch?: Record<string, unknown>) => {
      savedPayload = patch?.draft_answers as Record<string, unknown>;
      return supabaseMock;
    });
    render(<OnboardingForm userId={TEST_USER_ID} />);
    await screen.findByRole("heading", { name: "What are you building?" });
    fireEvent.click(screen.getByLabelText("Fashion brand"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByLabelText("Brand name");
    fireEvent.change(screen.getByLabelText("Brand name"), { target: { value: "Maison Noir" } });
    fireEvent.change(screen.getByLabelText(/Website/), { target: { value: "https://maisonnoir.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Where is your Brand active?" });
    fireEvent.click(screen.getByLabelText("Instagram"));
    fireEvent.click(screen.getByLabelText("Shopify"));
    fireEvent.change(screen.getByLabelText("Optional public handle or URL"), { target: { value: "@maisonnoir" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "How do you want to grow?" });
    fireEvent.click(screen.getByLabelText("Social media"));
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app/brands/44444444-4444-4444-4444-444444444444"));
    expect(startAnalysisMock).toHaveBeenCalledWith("44444444-4444-4444-4444-444444444444");
    expect(savedPayload).toMatchObject({
      flowVersion: 2,
      resumeStep: "complete",
      buildType: "fashion",
      brandName: "Maison Noir",
      websiteUrl: "https://maisonnoir.com",
      channels: ["ig", "shopify"],
      channelIdentities: { public: "@maisonnoir" },
      growthPreference: "social",
    });
  });

  it("can skip optional questions and creates a Brand without starting analysis", async () => {
    supabaseMock = fakeSupabase(FRESH_V2_SESSION);
    render(<OnboardingForm userId={TEST_USER_ID} />);
    await screen.findByRole("heading", { name: "What are you building?" });
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await screen.findByLabelText("Brand name");
    fireEvent.change(screen.getByLabelText("Brand name"), { target: { value: "No Website Brand" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Where is your Brand active?" });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "How do you want to grow?" });
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app/brands/44444444-4444-4444-4444-444444444444"));
    expect(startAnalysisMock).not.toHaveBeenCalled();
  });

  it("blocks invalid optional website before leaving Brand Details", async () => {
    supabaseMock = fakeSupabase(DRAFT_SESSION);
    render(<OnboardingForm userId={TEST_USER_ID} />);
    await screen.findByLabelText("Brand name");
    fireEvent.change(screen.getByLabelText(/Website/), { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Enter a valid URL");
    expect(screen.getByRole("heading", { name: "Tell us about your Brand" })).toBeDefined();
  });

  it("persists semantic Back navigation before rendering the previous step", async () => {
    const CHANNEL_SESSION: TestSession = {
      ...DRAFT_SESSION,
      draft_answers: { ...DRAFT_SESSION.draft_answers, resumeStep: "channels" },
    };
    supabaseMock = fakeSupabase(CHANNEL_SESSION);
    let savedPayload: Record<string, unknown> | undefined;
    supabaseMock.update.mockImplementation((patch?: Record<string, unknown>) => {
      savedPayload = patch?.draft_answers as Record<string, unknown>;
      return supabaseMock;
    });
    render(<OnboardingForm userId={TEST_USER_ID} />);
    await screen.findByRole("heading", { name: "Where is your Brand active?" });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "Tell us about your Brand" });
    expect(savedPayload).toMatchObject({ resumeStep: "brand-details" });
  });


  it("does not let a slow Brand Intelligence handoff block deterministic onboarding", async () => {
    const WEBSITE_READY_SESSION: TestSession = {
      ...READY_SESSION,
      draft_answers: { ...READY_SESSION.draft_answers, websiteUrl: "https://maisonnoir.com" },
    };
    supabaseMock = fakeSupabase(WEBSITE_READY_SESSION);
    startAnalysisMock.mockImplementation(() => new Promise(() => {}));
    render(<OnboardingForm userId={TEST_USER_ID} />);
    await screen.findByRole("heading", { name: "How do you want to grow?" });
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    await waitFor(
      () => expect(replaceMock).toHaveBeenCalledWith("/app/brands/44444444-4444-4444-4444-444444444444"),
      { timeout: 2500 },
    );
    expect(startAnalysisMock).toHaveBeenCalledTimes(1);
  });

});
