import { CopilotRuntime, createCopilotEndpoint } from "@copilotkit/runtime/v2";
import { createLocalAgents } from "@/agent";
import {
  copilotAuthHooksFor,
  identifyOperator,
} from "@/lib/auth/copilot-hooks";
import { startPlannerMembershipWatchdog } from "@/lib/auth/planner-membership-watchdog";
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
  const orgId = /^org:([0-9a-f-]{36})::user:/.exec(resourceId)?.[1];
  if (!orgId) {
    // Fail visibly rather than silently disabling the revocation watchdog if
    // the resourceId contract changes. Do not log tenant identifiers.
    console.warn("[planner] resourceId missing orgId; membership watchdog disabled");
  }

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

  // A request is authorized once at start. Long streams must stop when the
  // operator is removed from the organization instead of continuing to deliver
  // model output under the old authorization. The watchdog shares the request
  // abort signal so either source stops the same runner.
  const membershipController = new AbortController();
  const abortMembership = () => membershipController.abort();
  if (request.signal.aborted) abortMembership();
  else request.signal.addEventListener("abort", abortMembership, { once: true });
  const membershipWatchdog = orgId
    ? startPlannerMembershipWatchdog({
        check: async () => {
          if (!authClient) return "error";
          const { data, error } = await authClient
            .from("org_members")
            .select("org_id")
            .eq("org_id", orgId)
            .eq("user_id", session.operator.id)
            .maybeSingle();
          if (error) return "error";
          return data ? "member" : "missing";
        },
        onRevoked: () => membershipController.abort(),
      })
    : undefined;
  const cleanupMembershipWatchdog = () => {
    membershipWatchdog?.stop();
    request.signal.removeEventListener("abort", abortMembership);
  };
  if (membershipController.signal.aborted) cleanupMembershipWatchdog();
  else
    membershipController.signal.addEventListener("abort", cleanupMembershipWatchdog, {
      once: true,
    });

  const runtime = new CopilotRuntime({
    agents: attachRunnerAbort(createLocalAgents(resourceId)),
    identifyUser: identifyOperator,
    runner: new TenantAbortRunner(
      resourceId,
      membershipController.signal,
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
  let response: Response;
  try {
    response = await requestToken.run(accessToken ?? "", () => handle(app)(request));
  } catch (error) {
    cleanupMembershipWatchdog();
    throw error;
  }
  if (!membershipWatchdog) return response;
  if (!response.body) {
    cleanupMembershipWatchdog();
    return response;
  }
  // Stop the membership poll when this stream finishes, errors, or is
  // cancelled instead of leaving a timer alive for the watchdog's maximum
  // lifetime. Client disconnects still stop it through the request abort
  // signal above.
  const reader = response.body.getReader();
  const guardedBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          cleanupMembershipWatchdog();
          controller.close();
          return;
        }
        if (value) controller.enqueue(value);
      } catch (error) {
        cleanupMembershipWatchdog();
        controller.error(error);
      }
    },
    cancel(reason) {
      cleanupMembershipWatchdog();
      return reader.cancel(reason);
    },
  });
  return new Response(guardedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
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
