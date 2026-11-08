import { CopilotRuntime, createCopilotEndpoint } from "@copilotkit/runtime/v2";
import { createLocalAgents } from "@/agent";
import {
  copilotAuthHooksFor,
  identifyOperator,
} from "@/lib/auth/copilot-hooks";
import { requirePlannerResourceId } from "@/lib/auth/planner-session";
import { handle } from "hono/vercel";
import { requestToken } from "@/lib/request-token";
import { createClientFromRequest } from "@/lib/supabase/server";

import {
  attachRunnerAbort,
  TenantAbortRunner,
} from "@/lib/copilotkit/tenant-abort-runner";
import { createPlannerRunControl } from "@/lib/copilotkit/planner-run-control-supabase";

// IPI-1329 · MASTRA-INPROC-001 — the Product Planner always runs in this
// process: server-derived org+user resourceId → createLocalAgents →
// TenantAbortRunner → existing Mastra/Postgres memory. Managed Intelligence
// keys (CPK_INTELLIGENCE_API_KEY / COPILOTKIT_API_KEY) and MASTRA_BASE_URL are
// deliberately NOT read here, so an env change can never silently move the
// Planner to a remote Mastra service. Remote helpers stay in src/agent.ts and
// mastra-control-runner.ts only until IPI-1334 · MASTRA-REMOTE-CLEANUP-001.
async function handleCopilot(request: Request) {
  const session = await requirePlannerResourceId(request);
  if (!session.ok) return session.response;

  const resourceId = session.resourceId;

  const authClient = createClientFromRequest(request);
  const {
    data: { session: authSession },
  } = authClient
    ? await authClient.auth.getSession()
    : { data: { session: null } };
  const accessToken = authSession?.access_token;

  // Installed @copilotkit/runtime also falls back to
  // process.env.COPILOTKIT_LICENSE_TOKEN itself; passing the trimmed value
  // keeps a whitespace-padded env value from being rejected as invalid.
  const licenseToken = process.env.COPILOTKIT_LICENSE_TOKEN?.trim() || undefined;

  const runtime = new CopilotRuntime({
    agents: attachRunnerAbort(createLocalAgents(resourceId)),
    identifyUser: identifyOperator,
    runner: new TenantAbortRunner(
      resourceId,
      request.signal,
      createPlannerRunControl(resourceId, accessToken),
    ),
    ...(licenseToken ? { licenseToken } : {}),
  });

  const app = createCopilotEndpoint({
    runtime,
    basePath: "/api/copilotkit",
    hooks: copilotAuthHooksFor(resourceId),
  });

  // Planner tools read the verified bearer through AsyncLocalStorage.
  return requestToken.run(accessToken ?? "", () => handle(app)(request));
}

// Bound the owner request to 300s so the Proxy can prove a refreshed JWT
// outlives its Realtime channel by at least 60s (IPI-1117). This matches the
// documented Vercel Fluid Compute default, rather than reducing it.
export const maxDuration = 300;

// IPI-1210 history: the old 60s maxDuration experiment reduced the
// documented Vercel Fluid Compute default of 300s and did not fix the
// composeShootPlan "no response" symptom (IPI-1211). IPI-1117 now pins
// 300s for a DIFFERENT reason: a refreshed JWT must remain valid for the
// entire run. The SSR Proxy ensures at least 360s JWT lifetime at entry.
// This is not a claim that longer Planner turns improve reliability.
// https://vercel.com/docs/functions/configuring-functions/duration#duration-limits

export const GET = handleCopilot;
export const POST = handleCopilot;
export const PATCH = handleCopilot;
export const DELETE = handleCopilot;
