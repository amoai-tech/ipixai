import {
  CopilotRuntime,
  CopilotKitIntelligence,
  createCopilotEndpoint,
} from "@copilotkit/runtime/v2";
import { createLocalAgents } from "@/agent";
import {
  copilotAuthHooksFor,
  identifyOperator,
} from "@/lib/auth/copilot-hooks";
import {
  intelligenceIdentifyUser,
  requirePlannerResourceId,
} from "@/lib/auth/planner-session";
import { handle } from "hono/vercel";
import { requestToken } from "@/lib/request-token";
import { createClientFromRequest } from "@/lib/supabase/server";

import {
  attachRunnerAbort,
  TenantAbortRunner,
} from "@/lib/copilotkit/tenant-abort-runner";

async function handleCopilot(request: Request) {
  const session = await requirePlannerResourceId(request);
  if (!session.ok) return session.response;

  const resourceId = session.resourceId;
  const operator = session.operator;
  const agents = attachRunnerAbort(createLocalAgents(resourceId));
  const licenseToken = process.env.COPILOTKIT_LICENSE_TOKEN?.trim() || undefined;
  // IPI-1191 · COPILOT-INTEL-001 — CPK_INTELLIGENCE_API_KEY is the canonical
  // env var emitted by the current CopilotKit CLI and used by this
  // integration (COPILOTKIT_API_KEY is the accepted alias). The previous
  // iPix INTELLIGENCE_API_KEY wiring did not match this integration —
  // CopilotKit's docs are not fully uniform on the name across
  // framework-specific pages, so don't read that as "never a real name".
  // Provisioned by `npx copilotkit project select` into .env (gitignored),
  // project "ipix".
  // https://docs.copilotkit.ai/intelligence/connect-your-runtime
  const intelligenceKey =
    process.env.CPK_INTELLIGENCE_API_KEY?.trim() ||
    process.env.COPILOTKIT_API_KEY?.trim() ||
    undefined;
  // Installed @copilotkit/runtime reads COPILOTKIT_LICENSE_TOKEN from the
  // environment itself (options.licenseToken ?? process.env.COPILOTKIT_LICENSE_TOKEN)
  // even though this route no longer passes licenseToken explicitly — a
  // stale self-hosted token left in a managed environment is silently
  // picked up by the SDK, not neutralized by removing the explicit option.
  // Warn, don't fail: valid self-hosted/license scenarios exist.
  if (intelligenceKey && licenseToken) {
    console.warn(
      "[copilotkit] Managed Intelligence is configured (CPK_INTELLIGENCE_API_KEY " +
        "or COPILOTKIT_API_KEY set) while COPILOTKIT_LICENSE_TOKEN is also present. " +
        "Verify this is intentional — COPILOTKIT_LICENSE_TOKEN is a separate, " +
        "offline/self-hosted-only credential and is not needed for managed mode.",
    );
  }
  // CopilotKit docs: override apiUrl/wsUrl together only (self-hosted target).
  // A one-sided override would split the REST and realtime planes across
  // managed and self-hosted backends — never a valid configuration — so a
  // partial pair is dropped entirely (falls back to managed defaults for
  // both) rather than merely warned about and passed through split.
  const intelligenceApiUrl = process.env.INTELLIGENCE_API_URL?.trim() || undefined;
  const intelligenceWsUrl = process.env.INTELLIGENCE_GATEWAY_WS_URL?.trim() || undefined;
  const hasPairedEndpoints = Boolean(intelligenceApiUrl) === Boolean(intelligenceWsUrl);
  if (!hasPairedEndpoints) {
    console.warn(
      "[copilotkit] INTELLIGENCE_API_URL and INTELLIGENCE_GATEWAY_WS_URL " +
        "must be set together — one was set without the other. Ignoring " +
        "both and falling back to managed Intelligence defaults.",
    );
  }
  const intelligenceEndpoints =
    hasPairedEndpoints && intelligenceApiUrl && intelligenceWsUrl
      ? { apiUrl: intelligenceApiUrl, wsUrl: intelligenceWsUrl }
      : {};
  // Official CopilotKit: Intelligence mode auto-wires IntelligenceAgentRunner.
  // Do not pass TenantAbortRunner together with intelligence (type/runtime conflict).
  // License-only (Preview today) keeps the SSE persist runner.
  const runtime = intelligenceKey
    ? new CopilotRuntime({
        agents,
        // Intelligence keys threads by identifyUser.id (not TenantAbortRunner).
        // AUTH-002 org+user resourceId so Org B cannot attach to Org A.
        // Display name is the verified operator email/sub, not a dummy string.
        identifyUser: async () =>
          intelligenceIdentifyUser({ resourceId, operator }),
        // intelligenceEndpoints is {} unless both apiUrl/wsUrl are paired
        // (see above) — managed mode then defaults to CopilotKit's hosted
        // Intelligence platform. The prior hardcoded localhost:4201/4401
        // defaults were self-hosted remnants that don't apply there.
        intelligence: new CopilotKitIntelligence({
          apiKey: intelligenceKey,
          ...intelligenceEndpoints,
        }),
        // licenseToken intentionally omitted from this options object for
        // managed Intelligence — but note @copilotkit/runtime's own
        // BaseCopilotRuntime constructor falls back to
        // `process.env.COPILOTKIT_LICENSE_TOKEN` whenever `options.licenseToken`
        // is undefined (node_modules/@copilotkit/runtime/dist/v2/runtime/core/
        // runtime.mjs: `this.resolvedLicenseToken = options.licenseToken ??
        // process.env.COPILOTKIT_LICENSE_TOKEN`), for BOTH the SSE and
        // Intelligence runtime classes. So a self-hosted deployment that sets
        // COPILOTKIT_LICENSE_TOKEN in its environment still gets it picked up
        // automatically here — omitting it from this object only means iPix's
        // own code isn't redundantly re-passing what the SDK already reads
        // itself. What actually produced "Invalid CopilotKit license token"
        // before this fix was a garbage-format ck_pub_... value being present
        // in COPILOTKIT_LICENSE_TOKEN at all (verifyLicense() rejects it,
        // status.error = "invalid") — not which code path passed it in.
      })
    : new CopilotRuntime({
        agents,
        identifyUser: identifyOperator,
        runner: new TenantAbortRunner(resourceId, request.signal),
        ...(licenseToken ? { licenseToken } : {}),
      });

  const app = createCopilotEndpoint({
    runtime,
    basePath: "/api/copilotkit",
    hooks: copilotAuthHooksFor(resourceId),
  });

  // AUTH-002: tools that act as the operator (brand-intelligence start/approve)
  // resolve identity from the verified session JWT, not from browser-supplied
  // brand/actor IDs. requestToken.run scopes the token to this request's async
  // context so Mastra tool execution can read it via requestToken.getStore().
  // getVerifiedOperatorForRequest above uses getClaims() (identity only, no
  // network round-trip); getSession() here is the separate call needed to
  // recover the raw JWT itself for the user-scoped Supabase client tools use.
  const authClient = createClientFromRequest(request);
  const {
    data: { session: authSession },
  } = authClient
    ? await authClient.auth.getSession()
    : { data: { session: null } };
  const accessToken = authSession?.access_token;

  return requestToken.run(accessToken ?? "", () => handle(app)(request));
}

// IPI-1210 · COPILOT-TIMEOUT-001 — a prior fix here set maxDuration=60,
// theorizing composeShootPlan's multi-tool turns exceeded the platform
// default. That was wrong and has been reverted. Vercel's documented
// default for every plan with Fluid Compute — the platform default for
// new projects, not independently re-verified against this specific
// project's dashboard setting — is 300s:
// https://vercel.com/docs/functions/configuring-functions/duration#duration-limits.
// So the 60s override, at minimum, didn't add headroom over the documented
// platform default; it cut it by 80%. It also didn't fix the live
// "no response" symptom either way — Supabase query logs during a failed
// live attempt showed zero reads against shot_type_references, proving
// the failure happens before composeShootPlan's tool chain even starts,
// nowhere near a duration ceiling. Root cause is tracked separately in
// IPI-1211 · COPILOT-INTELLIGENCE-RELIABILITY-001. Leave this route on
// the platform default; only add an explicit maxDuration here again if a
// measured p95/p99 Planner turn is shown to actually need more than 300s.

export const GET = handleCopilot;
export const POST = handleCopilot;
export const PATCH = handleCopilot;
export const DELETE = handleCopilot;
