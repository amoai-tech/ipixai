import { Mastra } from "@mastra/core/mastra";
import { ConsoleLogger, LogLevel } from "@mastra/core/logger";
import { getProductionPlannerAgent } from "./agents";
import { createMastraStorage } from "./pg-store";
import { brandIntelligenceWorkflow } from "./workflows/brand-intelligence";
import { shootPlanReviewWorkflow } from "./workflows/shoot-plan-review";

const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || "info";
let cachedMastra: Mastra | undefined;

export function getMastra(): Mastra {
  if (cachedMastra) return cachedMastra;
  cachedMastra = new Mastra({
    agents: { default: getProductionPlannerAgent() },
    workflows: {
      "brand-intelligence": brandIntelligenceWorkflow,
      "shoot-plan-review": shootPlanReviewWorkflow,
    },
    storage: createMastraStorage(),
    logger: new ConsoleLogger({ level: LOG_LEVEL }),
  });
  return cachedMastra;
}