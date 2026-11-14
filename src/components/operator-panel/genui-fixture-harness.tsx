"use client";

import { CopilotKitProvider } from "@copilotkit/react-core/v2";

import { IpixGenerativeComparisonSurface } from "@/components/operator-panel/ipix-generative-surface";
import { ipixGenerativeUI } from "@/lib/copilotkit/ipix-generative-ui";
import { GenUIFixture } from "@/components/operator-panel/genui-fixture";

/**
 * Test-only browser harness. It mounts the real v2 provider, the same
 * `ipixGenerativeUI` catalog and the same `planner-comparison` Surface used by
 * the Operator Panel, without requiring an authenticated `/app` session.
 *
 * The route is 404 outside the guarded dev/E2E environment (see page.tsx).
 * It does not call a model and it is not linked from the app.
 */
export function GenUIFixtureHarness() {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      enableInspector={false}
      generativeUI={{ ui: ipixGenerativeUI }}
    >
      <div className="min-h-screen p-8">
        <IpixGenerativeComparisonSurface />
        <GenUIFixture />
      </div>
    </CopilotKitProvider>
  );
}
