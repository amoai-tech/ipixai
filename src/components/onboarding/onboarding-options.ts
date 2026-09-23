import type {
  OnboardingBuildType,
  OnboardingChannelId,
  OnboardingGrowthPreference,
} from "@/lib/onboarding";

export const BUILD_OPTIONS: ReadonlyArray<{
  id: OnboardingBuildType;
  label: string;
  image: number;
}> = [
  { id: "fashion", label: "Fashion brand", image: 15 },
  { id: "clothing", label: "Clothing label", image: 16 },
  { id: "access", label: "Accessories & jewelry", image: 17 },
  { id: "beauty", label: "Beauty", image: 18 },
  { id: "both", label: "Products + services", image: 19 },
];

export const CHANNEL_OPTIONS: ReadonlyArray<{
  id: OnboardingChannelId;
  label: string;
  glyph: string;
}> = [
  { id: "ig", label: "Instagram", glyph: "◎" },
  { id: "fb", label: "Facebook", glyph: "f" },
  { id: "tiktok", label: "TikTok", glyph: "♪" },
  { id: "shopify", label: "Shopify", glyph: "S" },
  { id: "web", label: "Own website", glyph: "◍" },
  { id: "etsy", label: "Etsy", glyph: "E" },
  { id: "amazon", label: "Amazon", glyph: "a" },
  { id: "ebay", label: "eBay", glyph: "e" },
];

export const GROWTH_OPTIONS: ReadonlyArray<{
  id: OnboardingGrowthPreference;
  label: string;
}> = [
  { id: "social", label: "Social media" },
  { id: "paid", label: "Paid ads" },
  { id: "both", label: "Both" },
  { id: "unsure", label: "Not sure yet — help me decide later" },
];
