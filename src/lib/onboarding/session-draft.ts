import {
  onboardingBuildTypeSchema,
  onboardingChannelIdSchema,
  onboardingGrowthPreferenceSchema,
  onboardingResumeStepSchema,
  type OnboardingBuildType,
  type OnboardingChannelId,
  type OnboardingDraft,
  type OnboardingGrowthPreference,
  type OnboardingResumeStep,
} from "./schema";

export const EMPTY_DRAFT: OnboardingDraft = {
  flowVersion: 2,
  resumeStep: "build-type",
  buildType: null,
  brandName: "",
  websiteUrl: "",
  channels: [],
  channelIdentities: {},
  growthPreference: null,
};

export type LegacyDraftAnswers = {
  flowVersion?: 2;
  resumeStep?: OnboardingResumeStep;
  buildType?: OnboardingBuildType | null;
  brandName: string;
  websiteUrl: string;
  channels?: OnboardingChannelId[];
  channelIdentities?: Record<string, string>;
  growthPreference?: OnboardingGrowthPreference | null;
} & Record<string, unknown>;

const stringRecord = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
};

const parseChannels = (source: Record<string, unknown>): OnboardingChannelId[] => {
  const rawChannels = Array.isArray(source.channels)
    ? source.channels
    : typeof source.listed === "object" && source.listed !== null && !Array.isArray(source.listed)
      ? Object.entries(source.listed as Record<string, unknown>)
          .filter(([, selected]) => selected === true)
          .map(([id]) => id)
      : [];
  return rawChannels.filter((value): value is OnboardingChannelId =>
    onboardingChannelIdSchema.safeParse(value).success,
  );
};

export function serializeDraftAnswers(draft: LegacyDraftAnswers): Record<string, unknown> {
  return { ...draft };
}
export function parseDraftAnswers(raw: unknown): LegacyDraftAnswers {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { brandName: "", websiteUrl: "" };
  }

  const source = raw as Record<string, unknown>;
  const base: LegacyDraftAnswers = {
    ...source,
    brandName: typeof source.brandName === "string" ? source.brandName : "",
    websiteUrl: typeof source.websiteUrl === "string" ? source.websiteUrl : "",
  };

  if (source.flowVersion !== 2) return base;

  const buildType = onboardingBuildTypeSchema.safeParse(source.buildType);
  const resumeStep = onboardingResumeStepSchema.safeParse(source.resumeStep);
  const growth = onboardingGrowthPreferenceSchema.safeParse(source.growthPreference);
  return {
    ...base,
    flowVersion: 2,
    resumeStep: resumeStep.success ? resumeStep.data : "build-type",
    buildType: buildType.success ? buildType.data : null,
    channels: parseChannels(source),
    channelIdentities: stringRecord(source.channelIdentities),
    growthPreference: growth.success ? growth.data : null,
  };
}

export function hasV2DraftMarker(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  return (raw as Record<string, unknown>).flowVersion === 2;
}
export function migrateLegacyDraftToV2(
  draft: LegacyDraftAnswers,
  resumeStep: OnboardingResumeStep,
): LegacyDraftAnswers & OnboardingDraft {
  const buildType = onboardingBuildTypeSchema.safeParse(draft.buildType ?? draft.build);
  const legacyGrowth = draft.grow === "fashionos" ? "unsure" : draft.grow;
  const growth = onboardingGrowthPreferenceSchema.safeParse(draft.growthPreference ?? legacyGrowth);
  const source = draft as Record<string, unknown>;

  return {
    ...draft,
    flowVersion: 2,
    resumeStep,
    buildType: buildType.success ? buildType.data : null,
    brandName: draft.brandName,
    websiteUrl: draft.websiteUrl,
    channels: parseChannels(source),
    channelIdentities: stringRecord(draft.channelIdentities),
    growthPreference: growth.success ? growth.data : null,
  };
}
