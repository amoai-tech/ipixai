import { describe, expect, it } from "vitest";

import { resolveSemanticStep, type StepMappingInput } from "./step-mapping";

// IPI-1263 · ONBOARD-COMPAT-001 — table-driven, deterministic, no React/DOM.
// Adapted test *strategy* from amo-tech-ai/lumina-studio
// app/src/lib/onboarding/navigation.test.ts (exhaustive 1..13 coverage +
// malformed/out-of-range cases); assertions target this module's own
// resume-step contract, not Lumina's 13-screen navigability rules.

const baseInput = (patch: Partial<StepMappingInput>): StepMappingInput => ({
  status: "draft",
  currentScreen: 1,
  brandId: null,
  organizationId: null,
  draft: {},
  ...patch,
});

describe("resolveSemanticStep — materialized short-circuit", () => {
  it("routes to materialized by status regardless of screen", () => {
    for (const screen of [1, 5, 11, 12, 13]) {
      expect(
        resolveSemanticStep(
          baseInput({ status: "materialized", currentScreen: screen, draft: { brandName: "Maison Noir" } }),
        ),
        `screen ${screen}`,
      ).toBe("materialized");
    }
  });

  it("current_screen=12 alone never certifies analysis/DNA completion — status still decides", () => {
    // IPI-903 heals materialized rows to screen 12; a *draft* row sitting at
    // screen 12 must not be treated as materialized just because the number
    // matches the healed value.
    const result = resolveSemanticStep(
      baseInput({ status: "draft", currentScreen: 12, draft: { brandName: "Maison Noir" } }),
    );
    expect(result).not.toBe("materialized");
    expect(result).toBe("analysis");
  });

  it("treats durable brand_id + organization_id as materialized even if status is stale", () => {
    const result = resolveSemanticStep(
      baseInput({
        status: "draft",
        currentScreen: 1,
        brandId: "44444444-4444-4444-4444-444444444444",
        organizationId: "33333333-3333-3333-3333-333333333333",
      }),
    );
    expect(result).toBe("materialized");
  });

  it("does not treat a single durable id (without the other) as materialized", () => {
    expect(
      resolveSemanticStep(
        baseInput({ brandId: "44444444-4444-4444-4444-444444444444", organizationId: null }),
      ),
    ).not.toBe("materialized");
    expect(
      resolveSemanticStep(
        baseInput({ brandId: null, organizationId: "33333333-3333-3333-3333-333333333333" }),
      ),
    ).not.toBe("materialized");
  });
});

describe("resolveSemanticStep — missing brand name always resumes at brand-details", () => {
  it("blank/whitespace/missing brandName resumes at brand-details regardless of screen", () => {
    for (const screen of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) {
      expect(resolveSemanticStep(baseInput({ currentScreen: screen, draft: {} })), `screen ${screen}`).toBe(
        "brand-details",
      );
      expect(
        resolveSemanticStep(baseInput({ currentScreen: screen, draft: { brandName: "   " } })),
        `screen ${screen} whitespace`,
      ).toBe("brand-details");
    }
  });

  it("never skips past brand-details just because the historical screen is high", () => {
    // A partial/corrupted draft can't be trusted just because current_screen
    // says the old flow got further — never destructive, never a silent skip.
    expect(resolveSemanticStep(baseInput({ currentScreen: 13, draft: {} }))).toBe("brand-details");
  });
});

describe("resolveSemanticStep — historical screen 1..13 mapping once brand-details is answered", () => {
  // Historical meaning: 1..4 => brand-details boundary; 5 => Channels;
  // 6-7 => Growth Preference boundary; 8-12 => Analysis; 13 => Review.
  const cases: Array<[number, ReturnType<typeof resolveSemanticStep>]> = [
    [1, "channels"],
    [2, "channels"],
    [3, "channels"],
    [4, "channels"],
    [5, "channels"],
    [6, "growth-preference"],
    [7, "growth-preference"],
    [8, "analysis"],
    [9, "analysis"],
    [10, "analysis"],
    [11, "analysis"],
    [12, "analysis"],
    [13, "review"],
  ];

  for (const [screen, expected] of cases) {
    it(`screen ${screen} with brand-details answered resumes at "${expected}"`, () => {
      expect(
        resolveSemanticStep(baseInput({ currentScreen: screen, draft: { brandName: "Maison Noir" } })),
      ).toBe(expected);
    });
  }
});

describe("resolveSemanticStep — current single-question flow's own draft", () => {
  it("current_screen frozen at 1 (this app's own row) with brand name resumes past brand-details", () => {
    // Current code always inserts current_screen: 1 and never advances it
    // while status stays "draft" — this is what makes screen > 1 here a
    // reliable legacy signal, not the number by itself.
    expect(
      resolveSemanticStep(baseInput({ currentScreen: 1, draft: { brandName: "Maison Noir", websiteUrl: "" } })),
    ).toBe("channels");
  });
});

describe("resolveSemanticStep — malformed / out-of-range input never throws", () => {
  const malformedScreens = [Number.NaN, -3, 0, 99, 1.9, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  it("falls back out-of-range high screens to the safe first-screen mapping", () => {
    expect(
      resolveSemanticStep(baseInput({ currentScreen: 99, draft: { brandName: "Maison Noir" } })),
    ).toBe(
      resolveSemanticStep(baseInput({ currentScreen: 1, draft: { brandName: "Maison Noir" } })),
    );
  });

  it("clamps non-finite/out-of-range screens instead of propagating garbage", () => {
    for (const screen of malformedScreens) {
      expect(() =>
        resolveSemanticStep(baseInput({ currentScreen: screen, draft: { brandName: "Maison Noir" } })),
      ).not.toThrow();
    }
  });

  it("tolerates a non-string brandName instead of throwing", () => {
    expect(() =>
      resolveSemanticStep(baseInput({ draft: { brandName: 42 as unknown as string } })),
    ).not.toThrow();
    expect(resolveSemanticStep(baseInput({ draft: { brandName: 42 as unknown as string } }))).toBe(
      "brand-details",
    );
  });

  it("tolerates a missing draft field entirely", () => {
    expect(() => resolveSemanticStep(baseInput({ draft: {} }))).not.toThrow();
  });

  it("tolerates an unexpected status string instead of throwing", () => {
    expect(() =>
      resolveSemanticStep(baseInput({ status: "superseded", draft: { brandName: "Maison Noir" } })),
    ).not.toThrow();
    expect(resolveSemanticStep(baseInput({ status: "superseded", draft: { brandName: "Maison Noir" } }))).not.toBe(
      "materialized",
    );
  });
});

describe("resolveSemanticStep — unknown legacy keys are ignored, not inspected", () => {
  it("does not let an unrelated unknown key change the resolved step", () => {
    const withoutExtra = resolveSemanticStep(baseInput({ currentScreen: 7, draft: { brandName: "Maison Noir" } }));
    const withExtra = resolveSemanticStep(
      baseInput({
        currentScreen: 7,
        draft: { brandName: "Maison Noir", instagramHandle: "@maisonnoir", industry: "fashion" },
      }),
    );
    expect(withExtra).toBe(withoutExtra);
  });
});


describe("IPI-1260 V2 semantic resolver", () => {
  it("exports a pure resolver that starts a fresh V2 draft at build-type", async () => {
    const module = (await import("./step-mapping")) as Record<string, unknown>;
    const candidate = module.resolveLeanStep;
    expect(typeof candidate).toBe("function");
    if (typeof candidate !== "function") return;
    expect(candidate({ flowVersion: 2, resumeStep: "build-type" })).toBe("build-type");
  });

  it("returns the persisted semantic step and fails closed to build-type", async () => {
    const module = (await import("./step-mapping")) as Record<string, unknown>;
    const candidate = module.resolveLeanStep;
    expect(typeof candidate).toBe("function");
    if (typeof candidate !== "function") return;
    for (const step of ["brand-details", "channels", "growth-preference", "complete"]) {
      expect(candidate({ flowVersion: 2, resumeStep: step })).toBe(step);
    }
    expect(candidate({ flowVersion: 99, resumeStep: "channels" })).toBe("build-type");
    expect(candidate({ flowVersion: 2, resumeStep: "bogus" })).toBe("build-type");
  });
});