import type { CopilotRuntimeHooks } from "@copilotkit/runtime";

import * as threadClaim from "./thread-claim";
import {
  authorizeThreadAccess,
  loadThreadOwner,
  normalizeThreadLocator,
  routeAllowsMissingThread,
  routeNeedsThreadAcl,
  threadForbiddenResponse,
  threadIdFromRequest,
} from "./thread-acl";
import {
  claimUnavailableResponse,
  unauthorizedResponse,
} from "./unauthorized";
import { getVerifiedOperatorForRequest } from "./operator-auth";


export async function identifyOperator(request: Request) {
  const operator = await getVerifiedOperatorForRequest(request);
  if (!operator) throw unauthorizedResponse();
  return operator;
}

export function copilotAuthHooksFor(resourceId: string): CopilotRuntimeHooks {
  return {
    onRequest: async ({ request }) => {
      const operator = await getVerifiedOperatorForRequest(request);
      if (!operator) throw unauthorizedResponse();
    },
    onBeforeHandler: async ({ request, route }) => {
      if (!routeNeedsThreadAcl(route.method)) return;
      if (route.method === "threads/clear") throw threadForbiddenResponse();

      const rawThreadId =
        "threadId" in route
          ? route.threadId
          : await threadIdFromRequest(request);
      if (rawThreadId === undefined || rawThreadId === null) {
        if (routeAllowsMissingThread(route.method)) return;
        throw threadForbiddenResponse();
      }
      const threadId = normalizeThreadLocator(rawThreadId);
      if (threadId === null) throw threadForbiddenResponse();

      const owner = await loadThreadOwner(threadId);
      if (
        owner.status === "lookup_failed" &&
        threadClaim.routeNeedsFirstCreateClaim(route.method)
      ) {
        throw claimUnavailableResponse();
      }
      const decision = authorizeThreadAccess({
        threadId,
        callerResourceId: resourceId,
        owner,
        allowMissing: routeAllowsMissingThread(route.method),
      });
      if (!decision.ok) throw threadForbiddenResponse();

      if (
        owner.status === "not_found" &&
        threadClaim.routeNeedsFirstCreateClaim(route.method)
      ) {
        const claim = await threadClaim.claimPlannerThread({
          threadId,
          resourceId,
        });
        if (claim.status === "owned") return;
        if (claim.status === "unavailable") throw claimUnavailableResponse();
        throw threadForbiddenResponse();
      }
    },
  };
}
