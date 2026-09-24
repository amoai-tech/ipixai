import { Mastra } from "@mastra/core/mastra";
import { ConsoleLogger, LogLevel } from "@mastra/core/logger";
import { getProductionPlannerAgent } from "./agents";
import { createMastraStorage } from "./pg-store";
import { brandIntelligenceWorkflow } from "./workflows/brand-intelligence";
import { shootPlanReviewWorkflow } from "./workflows/shoot-plan-review";
import { plannerMastraAuth } from "./server-auth";
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
      auth: plannerMastraAuth,
      apiRoutes: plannerRunControlRoutes,
      // IPI-1310 · MASTRA-PROD-001 — Mastra's default drain window is 5s, which
      // is far shorter than a Planner turn. On SIGTERM the generated server
      // stops accepting connections, waits this long for in-flight requests and
      // streams, then runs `mastra.shutdown()`. A plain `agent.stream()` cannot
      // resume after the process exits, so a short drain silently truncates live
      // operator turns on every restart or redeploy.
      //
      // The pinned generated server then bounds `mastra.shutdown()` separately
      // to 5s, so the host termination grace must exceed this drain window. The
      // deployment runbook uses 300s for a 240s drain to leave cleanup margin.
      drainTimeout: 240_000,
    },
  });
  return cachedMastra;
}
