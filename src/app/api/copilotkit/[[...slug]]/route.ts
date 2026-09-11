import {
  CopilotRuntime,
  CopilotKitIntelligence,
  createCopilotEndpoint,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import type { AbstractAgent, BaseEvent } from "@ag-ui/client";
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
import { Observable } from "rxjs";
import { requestToken } from "@/lib/request-token";
import { createClientFromRequest } from "@/lib/supabase/server";

import {
  ensureMastraThread,
  getPlannerMemory,
  splitRunThreadIds,
} from "@/mastra/thread-persistence";

/**
 * Mastra local agents inherit AbstractAgent.abortRun() as a no-op.
 * CopilotKit clones the registered agent per /run (`cloneAgentForRequest`);
 * clone() is Object.create(prototype) and drops instance abortRun.
 * UI Stop → POST /stop → InMemoryAgentRunner.stop → stored clone.abortRun().
 * detachActiveRun() completes the runAgent takeUntil, which ends the SSE.
 */
function wrapAbortRun(agent: AbstractAgent): AbstractAgent {
  const previousAbort = agent.abortRun.bind(agent);
  agent.abortRun = () => {
    previousAbort();
    void agent.detachActiveRun();
  };
  const previousClone = agent.clone.bind(agent);
  agent.clone = () => wrapAbortRun(previousClone());
  return agent;
}

function attachRunnerAbort(agents: Record<string, AbstractAgent>) {
  for (const [id, agent] of Object.entries(agents)) {
    agents[id] = wrapAbortRun(agent);
  }
  return agents;
}

/**
 * Process-global InMemoryAgentRunner is keyed by threadId only. Prefix with the
 * AUTH-002 resourceId so /stop cannot cancel another org/user's run.
 * Bind abort on run() after the store registers the thread (not a one-shot body peek).
 */
const pendingRuns = new Set<string>();
const pendingStops = new Set<string>();

class TenantAbortRunner extends InMemoryAgentRunner {
  constructor(
    private readonly resourceId: string,
    private readonly signal: AbortSignal,
  ) {
    super();
  }

  private scope(threadId: string) {
    return splitRunThreadIds(this.resourceId, threadId).runnerThreadId;
  }

  private shouldSkipRun(runnerThreadId: string, cancelled: boolean) {
    return (
      cancelled ||
      this.signal.aborted ||
      pendingStops.has(runnerThreadId)
    );
  }

  override run(request: Parameters<InMemoryAgentRunner["run"]>[0]) {
    const { runnerThreadId, mastraThreadId } = splitRunThreadIds(
      this.resourceId,
      request.threadId,
    );
    const input = request.input
      ? { ...request.input, threadId: mastraThreadId }
      : request.input;
    const agent = request.agent;
    const runAgent = agent.runAgent.bind(agent);
    agent.runAgent = (runInput, subscribers) => {
      if (this.signal.aborted) {
        agent.abortRun();
        return Promise.resolve({ result: undefined, newMessages: [] });
      }
      this.signal.addEventListener(
        "abort",
        () => {
          agent.abortRun();
        },
        { once: true },
      );
      return runAgent(runInput, subscribers);
    };
    pendingRuns.add(runnerThreadId);
    return new Observable<BaseEvent>((subscriber) => {
      let inner: { unsubscribe: () => void } | undefined;
      let cancelled = false;
      const releasePending = () => {
        pendingStops.delete(runnerThreadId);
        pendingRuns.delete(runnerThreadId);
      };
      void (async () => {
        if (this.shouldSkipRun(runnerThreadId, cancelled)) {
          releasePending();
          subscriber.complete();
          return;
        }
        const memory = await getPlannerMemory();
        if (this.shouldSkipRun(runnerThreadId, cancelled)) {
          releasePending();
          subscriber.complete();
          return;
        }
        if (!memory) {
          releasePending();
          subscriber.error(new Error("memory_unavailable"));
          return;
        }
        await ensureMastraThread(memory, {
          threadId: mastraThreadId,
          resourceId: this.resourceId,
        });
        if (this.shouldSkipRun(runnerThreadId, cancelled)) {
          releasePending();
          subscriber.complete();
          return;
        }
        inner = super
          .run({ ...request, threadId: runnerThreadId, input })
          .subscribe(subscriber);
        pendingRuns.delete(runnerThreadId);
      })().catch((error) => {
        releasePending();
        if (!cancelled) subscriber.error(error);
      });
      return () => {
        cancelled = true;
        pendingRuns.delete(runnerThreadId);
        inner?.unsubscribe();
      };
    });
  }

  override async stop(request: Parameters<InMemoryAgentRunner["stop"]>[0]) {
    const runnerThreadId = this.scope(request.threadId);
    if (pendingRuns.has(runnerThreadId)) {
      pendingStops.add(runnerThreadId);
    }
    const stopped = await super.stop({
      ...request,
      threadId: runnerThreadId,
    });
    return Boolean(stopped) || pendingStops.has(runnerThreadId);
  }

  override connect(request: Parameters<InMemoryAgentRunner["connect"]>[0]) {
    return super.connect({
      ...request,
      threadId: this.scope(request.threadId),
    });
  }

  override isRunning(request: Parameters<InMemoryAgentRunner["isRunning"]>[0]) {
    return super.isRunning({ threadId: this.scope(request.threadId) });
  }

  override getThreadMessages(threadId: string) {
    return super.getThreadMessages(this.scope(threadId));
  }

  override getThreadEvents(threadId: string) {
    return super.getThreadEvents(this.scope(threadId));
  }

  override getThreadState(threadId: string) {
    return super.getThreadState(this.scope(threadId));
  }

  override listThreads() {
    const prefix = splitRunThreadIds(this.resourceId, "").runnerThreadId;
    return super
      .listThreads()
      .filter((thread) => thread.id.startsWith(prefix))
      .map((thread) => ({ ...thread, id: thread.id.slice(prefix.length) }));
  }
}

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

export const GET = handleCopilot;
export const POST = handleCopilot;
export const PATCH = handleCopilot;
export const DELETE = handleCopilot;
