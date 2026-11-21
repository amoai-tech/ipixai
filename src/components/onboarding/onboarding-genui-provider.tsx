"use client";

import { useMemo, type ReactNode } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import type { GenerativeUIErrorInfo } from "@copilotkit/react-core/v2/generative-ui";

import { ipixOnboardingUI } from "@/lib/copilotkit/ipix-onboarding-ui";

/**
 * IPI-1461 · ONBOARD-PLAYGROUND-001 — CopilotKit renderer for /onboarding.
 *
 * The provider needs a runtime URL to start in production. It reuses the
 * existing /api/copilotkit, which refuses zero-org users unchanged: the one
 * /info request fails and CopilotKit only logs a warning. Onboarding never
 * runs an agent; its buttons call host functions in the browser, and
 * `agentIds: []` keeps the onboarding catalog away from every agent.
 */
export function OnboardingGenUIProvider({
  children,
  onError,
}: {
  children: ReactNode;
  /** Render, props, operation and function failures, e.g. rejected arguments. */
  onError?: (info: GenerativeUIErrorInfo) => void;
}) {
  const generativeUI = useMemo(
    () => ({ ui: ipixOnboardingUI, agentIds: [] as string[], errorBoundary: { onError } }),
    [onError],
  );
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      enableInspector={false}
      showDevConsole={false}
      generativeUI={generativeUI}
    >
      {children}
    </CopilotKitProvider>
  );
}
