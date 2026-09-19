"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAgent, useCopilotKit, useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

import { ComposeShootPlanCard } from "@/components/shoot/compose-shoot-plan-card";
import {
  describeProductionPlanCard,
  type ProductionPlanCardView,
} from "@/lib/shoot/compose-shoot-plan-card-view";

/**
 * IPI-1242 · PLAN-CARD-002 — the user-side message that prompts the model
 * to call the existing model-invoked `reviewShootPlan` HITL tool for the
 * plan it just proposed. This never calls `reviewShootPlan` directly: the
 * model still decides to call it, preserving the existing
 * "AI proposes → human reviews" flow with no second approval path.
 *
 * A thread can hold more than one composeShootPlan card (a plan revised
 * more than once). Naming the clicked card's own objective/channels/counts
 * here — rather than a fully generic "the plan you just proposed" — gives
 * the model a concrete disambiguator so a click on an older card is far
 * less likely to be answered by reviewing a newer one. The operator still
 * sees the actual reviewed plan content in the HITL card before approving,
 * and the server independently hashes/binds whatever plan the model
 * ultimately supplies (`shoot-plan-review.ts`) — this only reduces the
 * chance of reviewing the wrong plan, it isn't the authorization boundary.
 */
function describePlanForReview(plan: ProductionPlanCardView): string {
  const details = [
    plan.objective ? `objective “${plan.objective}”` : null,
    plan.channels.length > 0 ? `channels ${plan.channels.join(", ")}` : null,
    plan.totalShots !== null
      ? `${plan.totalShots} ${plan.totalShots === 1 ? "shot" : "shots"}`
      : null,
    plan.totalAssets !== null
      ? `${plan.totalAssets} ${plan.totalAssets === 1 ? "deliverable" : "deliverables"}`
      : null,
  ].filter((entry): entry is string => Boolean(entry));
  return details.length > 0 ? ` (${details.join(", ")})` : "";
}

function buildReviewShootPlanMessage(plan: ProductionPlanCardView): string {
  return `Please start a formal review of the production plan you just proposed${describePlanForReview(plan)}, so I can approve or request changes.`;
}

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
  const { agent } = useAgent({ agentId: "default" });
  const { copilotkit } = useCopilotKit();
  // useRenderTool registers `render` once ([] deps, matching this file's
  // existing convention) — read the latest agent/copilotkit through a ref
  // updated every render rather than closing over them directly, so the
  // frozen render callback never operates on a stale agent/copilotkit pair.
  const latestRef = useRef({ agent, copilotkit });
  useEffect(() => {
    latestRef.current = { agent, copilotkit };
  });
  // Same synchronous in-flight guard as ProductionCopilotPanel.ask() — a
  // second click before agent.isRunning has actually flipped must not start
  // a competing run.
  const reviewInFlightRef = useRef(false);

  const onReviewShootPlan = useCallback((plan: ProductionPlanCardView) => {
    const { agent: currentAgent, copilotkit: currentCopilotkit } = latestRef.current;
    if (currentAgent.isRunning || reviewInFlightRef.current) return;
    reviewInFlightRef.current = true;
    try {
      currentAgent.addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: buildReviewShootPlanMessage(plan),
      });
      void currentCopilotkit
        .runAgent({ agent: currentAgent })
        .catch((error) => {
          console.error("ComposeShootPlanRenderer: review request failed", error);
        })
        .finally(() => {
          reviewInFlightRef.current = false;
        });
    } catch (error) {
      reviewInFlightRef.current = false;
      throw error;
    }
  }, []);

  useRenderTool(
    {
      name: "composeShootPlan",
      parameters: RenderParameters,
      render: ({ status, result }) => {
        if (status !== "complete") return <PendingPlanCard />;

        const plan = describeProductionPlanCard(parseToolResult(result));
        if (!plan) return <UnreadablePlanCard />;

        return (
          <ComposeShootPlanCard plan={plan} onReviewShootPlan={() => onReviewShootPlan(plan)} />
        );
      },
    },
    [],
  );

  return null;
}
