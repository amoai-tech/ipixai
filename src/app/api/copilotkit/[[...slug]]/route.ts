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
  const intelligenceKey = process.env.INTELLIGENCE_API_KEY?.trim() || undefined;
  // Official CopilotKit: Intelligence mode auto-wires IntelligenceAgentRunner.
  // Do not pass TenantAbortRunner together with intelligence (type/runtime conflict).
  // License-only (Preview today) keeps the SSE persist runner.
  const runtime =
    licenseToken && intelligenceKey
      ? new CopilotRuntime({
          agents,
          // Intelligence keys threads by identifyUser.id (not TenantAbortRunner).
          // AUTH-002 org+user resourceId so Org B cannot attach to Org A.
          // Display name is the verified operator email/sub, not a dummy string.
          identifyUser: async () =>
            intelligenceIdentifyUser({ resourceId, operator }),
          intelligence: new CopilotKitIntelligence({
            apiKey: intelligenceKey,
            apiUrl: process.env.INTELLIGENCE_API_URL ?? "http://localhost:4201",
            wsUrl:
              process.env.INTELLIGENCE_GATEWAY_WS_URL ?? "ws://localhost:4401",
          }),
          licenseToken,
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
