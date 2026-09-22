import { Mastra } from "@mastra/core/mastra";
import { ConsoleLogger, LogLevel } from "@mastra/core/logger";
import { getProductionPlannerAgent } from "./agents";
import { createMastraStorage } from "./pg-store";
import { brandIntelligenceWorkflow } from "./workflows/brand-intelligence";
import { shootPlanReviewWorkflow } from "./workflows/shoot-plan-review";
import { plannerMastraAuthMiddleware } from "./server-auth";
import { plannerRunControlRoutes } from "./run-control-routes";

let cachedMastra: Mastra | undefined;

export function getMastra(): Mastra {
  if (cachedMastra) return cachedMastra;

  // Read inside the factory, not at module scope: importing this module must do
  // nothing at all. A module-scope read would also freeze the value at import
  // time, so a later `vi.stubEnv("LOG_LEVEL", ...)` would be silently ignored.
  const logLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

  cachedMastra = new Mastra({
    agents: { default: getProductionPlannerAgent() },
    workflows: {
      "brand-intelligence": brandIntelligenceWorkflow,
      "shoot-plan-review": shootPlanReviewWorkflow,
    },
    storage: createMastraStorage(),
    logger: new ConsoleLogger({ level: logLevel }),
    server: {
      middleware: plannerMastraAuthMiddleware,
      apiRoutes: plannerRunControlRoutes,
    },
  });
  return cachedMastra;
}
