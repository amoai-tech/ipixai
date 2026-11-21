"use client";

import { useEffect, useRef } from "react";
import { A2UI_VERSION, GENERATIVE_UI_ROOT_ID } from "@copilotkit/shared";
import {
  GenerativeUISurface,
  useGenerativeUIFunction,
  useGenerativeUIRuntime,
} from "@copilotkit/react-core/v2/generative-ui";

import { ONBOARDING_COMPONENTS, ipixOnboardingUI } from "@/lib/copilotkit/ipix-onboarding-ui";
import type { OnboardingBuildType } from "@/lib/onboarding";

/**
 * IPI-1462 · ONBOARD-A2UI-01 — Screen 1 (Brand Discovery) as a fixed
 * CopilotKit form. The host owns the draft: this screen seeds the form from
 * it once, reports every edit for the existing autosave, and calls back on
 * Continue. No agent is involved.
 */
export type BrandDiscoveryValues = {
  brandName: string;
  buildType: OnboardingBuildType | null;
  websiteUrl: string;
  ig: string;
  tiktok: string;
  shopify: string;
};

const TARGET = "onboarding-step";
const THREAD = "onboarding";
const SURFACE = "onboarding-brand-discovery";
const p = (path: string) => ({ "@path": `/draft/${path}` });

const BUILD_TYPES: { value: OnboardingBuildType; label: string }[] = [
  { value: "fashion", label: "Fashion brand" },
  { value: "clothing", label: "Clothing label" },
  { value: "access", label: "Accessories" },
  { value: "beauty", label: "Beauty" },
  { value: "both", label: "Both fashion and beauty" },
];

export function brandDiscoveryOps(values: BrandDiscoveryValues) {
  return [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: SURFACE, catalogId: ipixOnboardingUI.id, dataModel: { draft: values } },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: SURFACE,
        components: [
          {
            id: GENERATIVE_UI_ROOT_ID,
            component: "Form",
            label: "Tell us about your brand",
            children: ["title", "intro", "name", "category", "sources", "website", "ig", "tiktok", "shopify", "note", "continue"],
            onSubmit: {
              functionCall: {
                "@call": "onboardingContinue",
                args: {
                  brandName: p("brandName"),
                  buildType: p("buildType"),
                  websiteUrl: p("websiteUrl"),
                  ig: p("ig"),
                  tiktok: p("tiktok"),
                  shopify: p("shopify"),
                },
              },
            },
          },
          { id: "title", component: "Title", text: "Tell us about your brand" },
          { id: "intro", component: "Caption", text: "Only the brand name is required. You can change everything later." },
          { id: "name", component: "TextField", label: "Brand name (required)", placeholder: "e.g. Maison Atelier", value: p("brandName") },
          { id: "category", component: "RadioGroup", label: "Brand type (optional)", value: p("buildType"), options: BUILD_TYPES },
          { id: "sources", component: "Caption", text: "Public profiles are optional. Sharing one does not connect or verify an account." },
          { id: "website", component: "TextField", label: "Website (optional)", placeholder: "https://yourbrand.com", variant: "url", value: p("websiteUrl") },
          { id: "ig", component: "TextField", label: "Instagram handle or URL (optional)", placeholder: "@yourbrand", value: p("ig") },
          { id: "tiktok", component: "TextField", label: "TikTok handle or URL (optional)", placeholder: "@yourbrand", value: p("tiktok") },
          { id: "shopify", component: "TextField", label: "Public Shopify storefront (optional)", placeholder: "yourbrand.myshopify.com", value: p("shopify") },
          { id: "note", component: "Caption", text: "After you create your Brand, iPix can research your website and prepare a Brand DNA draft for you to review." },
          { id: "continue", component: "Button", label: "Continue", submit: true, variant: "primary" },
        ],
      },
    },
  ];
}

export function BrandDiscoveryScreen({
  initial,
  onChange,
  onContinue,
}: {
  initial: BrandDiscoveryValues;
  onChange: (values: BrandDiscoveryValues) => void;
  onContinue: (values: Partial<BrandDiscoveryValues>) => void;
}) {
  const runtime = useGenerativeUIRuntime();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Seed once from the saved draft; later edits live in the form until saved.
  const initialRef = useRef(initial);

  useGenerativeUIFunction(ipixOnboardingUI, "onboardingContinue", (args) => onContinue(args));

  useEffect(() => {
    if (!runtime) return;
    const { manager } = runtime;
    manager.setActiveThread(THREAD);
    manager.ingest(THREAD, undefined, {
      surfaceId: SURFACE,
      catalogId: ipixOnboardingUI.id,
      target: TARGET,
      status: "ready",
      rejected: [],
      operations: brandDiscoveryOps(initialRef.current) as never,
    });
    const subscription = manager
      .getSurface(THREAD, SURFACE)
      ?.model.dataModel.subscribe<BrandDiscoveryValues>("/draft", (values) => {
        if (values) onChangeRef.current({ ...values });
      });
    return () => subscription?.unsubscribe();
  }, [runtime]);

  return (
    <GenerativeUISurface
      id={TARGET}
      ui={ipixOnboardingUI}
      components={[...ONBOARDING_COMPONENTS]}
      fallback={<p className="text-sm text-[var(--muted-foreground)]">Loading…</p>}
      autoScroll={false}
    />
  );
}
