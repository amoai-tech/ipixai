import { afterEach, describe, expect, it, vi } from "vitest";

import { resetSupabaseMock, supabaseMock } from "./mocks/supabase";

vi.mock(
  "../src/lib/supabase/server",
  async () => (await import("./mocks/supabase")).supabaseMockModule(),
);

afterEach(() => {
  resetSupabaseMock();
  vi.restoreAllMocks();
});

import {
  composeShootPlan,
  type ComposeShootPlanInput,
} from "../src/mastra/tools/compose-shoot-plan";

const TRUSTED_REFERENCE = {
  id: "ref-normalize",
  category: "clothing",
  subcategory: "flat_lay",
  angle: "Front flat lay",
  description: "Garment laid flat on a clean background",
  channel_fit: ["shopify_pdp", "shopify"],
  model_type: null,
  background: "white",
};

function completeInput(overrides: Partial<ComposeShootPlanInput> = {}): ComposeShootPlanInput {
  return {
    channels: ["shopify"],
    shootName: "SS27 Launch",
    brief: "Premium ecommerce campaign",
    objective: "Launch the collection",
    mediaType: "photo",
    crewCount: 2,
    studioType: "owned",
    location: "Studio A",
    lighting: "Soft daylight",
    setBackground: "Warm neutral",
    talent: "One model",
    crew: "Photographer and stylist",
    studio: "Main studio",
    equipment: "Camera and strobes",
    scheduleStartDate: "2027-03-01",
    scheduleEndDate: "2027-03-01",
    scheduleNotes: "Morning call",
    campaignContext: "Spring launch",
    ...overrides,
  };
}

describe("PLAN-001 canonical text normalization", () => {
  it.each([
    ["objective", "objective"],
    ["location", "location"],
    ["lighting", "lighting"],
    ["setBackground", "setBackground"],
    ["talent", "talent"],
    ["crew", "crew"],
    ["studio", "studio"],
    ["equipment", "equipment"],
  ] as const)("treats whitespace-only %s as missing", async (inputKey, planKey) => {
    supabaseMock.rows = [TRUSTED_REFERENCE];
    const plan = await composeShootPlan(completeInput({ [inputKey]: "   " }));

    expect(plan[planKey]).toEqual({ status: "needs_input" });
    expect(plan.missingInputs).toContain(planKey);
    expect(plan.status).toBe("needs_input");
  });

  it("trims canonical text fields, optional campaign context, and schedule notes", async () => {
    supabaseMock.rows = [TRUSTED_REFERENCE];
    const plan = await composeShootPlan(
      completeInput({
        shootName: "  SS27 Launch  ",
        brief: "  Premium ecommerce campaign  ",
        objective: "  Launch the collection  ",
        location: "  Studio A  ",
        lighting: "  Soft daylight  ",
        setBackground: "  Warm neutral  ",
        talent: "  One model  ",
        crew: "  Photographer and stylist  ",
        studio: "  Main studio  ",
        equipment: "  Camera and strobes  ",
        scheduleNotes: "  Morning call  ",
        campaignContext: "  Spring launch  ",
      }),
    );

    expect(plan.shootName).toMatchObject({ value: "SS27 Launch" });
    expect(plan.brief).toMatchObject({ value: "Premium ecommerce campaign" });
    expect(plan.objective).toMatchObject({ value: "Launch the collection" });
    expect(plan.location).toMatchObject({ value: "Studio A" });
    expect(plan.lighting).toMatchObject({ value: "Soft daylight" });
    expect(plan.setBackground).toMatchObject({ value: "Warm neutral" });
    expect(plan.talent).toMatchObject({ value: "One model" });
    expect(plan.crew).toMatchObject({ value: "Photographer and stylist" });
    expect(plan.studio).toMatchObject({ value: "Main studio" });
    expect(plan.equipment).toMatchObject({ value: "Camera and strobes" });
    expect(plan.schedule).toMatchObject({ value: { notes: "Morning call" } });
    expect(plan.campaignContext).toMatchObject({ value: "Spring launch" });
  });
});
