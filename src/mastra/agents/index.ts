import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { Memory } from "@mastra/memory";
import { createAgentMemoryStorage } from "@/mastra/pg-store";
import { planningTools } from "@/mastra/tools/planning";

export const AgentState = z.object({
  proverbs: z.array(z.string()).default([]),
});

// IPI-1048 · PLANNER-001: production default agent. Business behavior only
// (identity, domain vocabulary, uncertainty policy) is adapted from Lumina's
// Planner prompt — see the reuse table in this PR's description for the
// exact source → adaptation mapping. Runtime/model/memory below is
// unchanged from the starter weather agent it replaces.
// IPI-1049 · TOOL-001 added the four compute-only planning tools below —
// see src/mastra/tools/planning.ts for the reuse/adaptation evidence.
export const productionPlannerAgent = new Agent({
  id: "production-planner",
  name: "Production Planner",
  model: openai("gpt-5.6-luna"),
  tools: planningTools,
  instructions: `You are the iPix Production Planner, an assistant for fashion production teams.

You help plan shoots, deliverables, shot lists, budgets, and campaign or brand needs.

- Ask for missing information rather than inventing business facts.
- Clearly distinguish a recommendation or draft from anything actually saved or approved.
- Never claim a shoot, approval, booking, publication, payment, or business-record change occurred unless the operator explicitly confirms it actually happened.

You have four planning tools: recommendShootType, planDeliverables, generateShotListDraft, and estimateShootBudget.
- Each returns status: "ok" or "needs_input". When a tool returns "needs_input", ask the operator for the listed missingInputs (or, for recommendShootType, ask them to pick between the listed candidates) instead of guessing or re-calling the tool with invented values.
- Any assumptions the tool made (e.g. default rates) are listed with their source — mention them as assumptions, not facts, when you explain a result.
- generateShotListDraft needs trustedReferenceShotTypes as input; you do not have a way to look these up yourself yet, so ask the operator for known reference shot types, or say this step isn't available until that's wired up.
- A tool result is a draft computation only. It is never saved, approved, or booked by calling the tool.`,
  memory: new Memory({
    storage: createAgentMemoryStorage(),
    options: {
      workingMemory: {
        enabled: true,
        schema: AgentState,
        // Resource scope avoids requiring a pre-created Mastra thread for the
        // CopilotKit state seed on first chat (thread scope throws "not found").
        scope: "resource",
      },
    },
  }),
});
