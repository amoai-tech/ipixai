"use client";

import type { ReactNode } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";

import { ipixOnboardingUI } from "@/lib/copilotkit/ipix-onboarding-ui";

const GENERATIVE_UI = { ui: ipixOnboardingUI, agentIds: [] as string[] };

/**
 * IPI-1461 · ONBOARD-PLAYGROUND-001 — CopilotKit renderer for /onboarding.
 *
 * The provider needs a runtime URL to start in production. It reuses the
 * existing /api/copilotkit, which refuses zero-org users unchanged: the one
 * /info request fails and CopilotKit only logs a warning. Onboarding never
 * runs an agent; its buttons call host functions in the browser, and
 * `agentIds: []` keeps the onboarding catalog away from every agent.
 */
export function OnboardingGenUIProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      enableInspector={false}
      showDevConsole={false}
      generativeUI={GENERATIVE_UI}
    >
      {children}
    </CopilotKitProvider>
  );
}
