"use client";

import { useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

import { ComposeShootPlanCard } from "@/components/shoot/compose-shoot-plan-card";
import { describeProductionPlanCard } from "@/lib/shoot/compose-shoot-plan-card-view";

/**
 * IPI-1233 · PLAN-CARD-001 — the named CopilotKit v2 tool renderer for
 * `composeShootPlan`. Registers inside the existing `/app` Production Copilot
 * provider (no second runtime); every other message/tool keeps CopilotKit's
 * default rendering.
 *
 * A permissive placeholder schema — not the real `ComposeShootPlanInputSchema`
 * (`@/mastra/tools/compose-shoot-plan`), which transitively imports
 * `@mastra/core/tools`. This renderer never reads `parameters`, only the
 * completed `result`, so importing the server tool's real input schema here
 * would pull Mastra tool-runtime code into the browser bundle for no benefit.
 */
const RenderParameters = z.object({}).passthrough();

function PendingPlanCard() {
  return (
    <div
      data-testid="compose-shoot-plan-pending"
      className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500"
    >
      Composing the production plan…
    </div>
  );
}

function UnreadablePlanCard() {
  return (
    <div
      data-testid="compose-shoot-plan-unreadable"
      className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500"
    >
      Couldn&apos;t display this plan.
    </div>
  );
}

/** Never throws: an unparsable/unexpected `result` is a display gap, not a crash. */
function parseToolResult(result: string): unknown {
  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
}

export function ComposeShootPlanRenderer() {
  useRenderTool(
    {
      name: "composeShootPlan",
      parameters: RenderParameters,
      render: ({ status, result }) => {
        if (status !== "complete") return <PendingPlanCard />;

        const plan = describeProductionPlanCard(parseToolResult(result));
        if (!plan) return <UnreadablePlanCard />;

        return <ComposeShootPlanCard plan={plan} />;
      },
    },
    [],
  );

  return null;
}
