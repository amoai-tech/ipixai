import { describe, expect, it } from "vitest";

import { onboardingDraftSchema } from "./schema";
import { migrateLegacyDraftToV2, parseDraftAnswers, serializeDraftAnswers } from "./session-draft";

describe("IPI-1260 V2 onboarding draft", () => {
  it("normalizes an empty session into a fresh semantic V2 draft", () => {
    expect(parseDraftAnswers({ flowVersion: 2 })).toEqual({
      flowVersion: 2,
      resumeStep: "build-type",
      buildType: null,
      brandName: "",
      websiteUrl: "",
      channels: [],
      channelIdentities: {},
      growthPreference: null,
    });
  });

  it("accepts the four-question semantic contract", () => {
    const parsed = onboardingDraftSchema.parse({
      flowVersion: 2,
      resumeStep: "growth-preference",
      buildType: "clothing",
      brandName: "Maison Noir",
      websiteUrl: "https://maisonnoir.com",
      channels: ["ig", "shopify"],
      channelIdentities: { ig: "@maisonnoir" },
      growthPreference: "social",
    });
    expect(parsed.channels).toEqual(["ig", "shopify"]);
  });

  it("preserves unknown legacy keys while normalizing V2 fields", () => {
    const draft = parseDraftAnswers({
      brandName: "Maison Noir",
      instagramHandle: "@legacy",
      currentLegacyThing: { keep: true },
    });
    const roundTrip = serializeDraftAnswers(draft);
    expect(roundTrip).toEqual({
      instagramHandle: "@legacy",
      currentLegacyThing: { keep: true },
      brandName: "Maison Noir",
      websiteUrl: "",
    });
  });

  it("drops invalid declared values to safe defaults without dropping unknown keys", () => {
    const draft = parseDraftAnswers({
      flowVersion: 2,
      resumeStep: "nonsense",
      channels: ["ig", "bogus"],
      channelIdentities: "bad",
      growthPreference: "robot-decides",
      futureField: 42,
    });
    expect(draft.flowVersion).toBe(2);
    expect(draft.resumeStep).toBe("build-type");
    expect(draft.channels).toEqual(["ig"]);
    expect(draft.channelIdentities).toEqual({});
    expect(draft.growthPreference).toBeNull();
    expect(draft.futureField).toBe(42);
  });
});

describe("IPI-1260 legacy answer migration", () => {
  it("maps useful old Lumina answer keys into the V2 semantic draft", () => {
    const legacy = parseDraftAnswers({
      build: "clothing",
      brandName: "Maison Noir",
      websiteUrl: "https://maisonnoir.com",
      listed: { ig: true, shopify: true, ebay: false },
      grow: "fashionos",
    });
    const draft = migrateLegacyDraftToV2(legacy, "growth-preference");
    expect(draft.buildType).toBe("clothing");
    expect(draft.channels).toEqual(["ig", "shopify"]);
    expect(draft.growthPreference).toBe("unsure");
  });
});