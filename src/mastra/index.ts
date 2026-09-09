import { Mastra } from "@mastra/core/mastra";
import { productionPlannerAgent } from "./agents";
import { ConsoleLogger, LogLevel } from "@mastra/core/logger";
import { createMastraStorage } from "./pg-store";
import { brandIntelligenceWorkflow } from "./workflows/brand-intelligence";

const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || "info";

export const mastra = new Mastra({
  agents: {
    default: productionPlannerAgent,
  },
  workflows: {
    "brand-intelligence": brandIntelligenceWorkflow,
  },
  storage: createMastraStorage(),
  logger: new ConsoleLogger({
    level: LOG_LEVEL,
  }),
});
