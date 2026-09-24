import {
  MASTRA_AUTH_TOKEN_KEY,
  MASTRA_RESOURCE_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";

import { resolveMastraIdentity, resolveSupabaseUserAuthConfig } from "./server-auth";

/**
 * IPI-1326 · MASTRA-WORKFLOW-AUTHZ-001 — who is a privileged workflow acting for?
 *
 * Mastra's server auth middleware stores the verified user under this reserved
 * RequestContext key, and `@mastra/server` drops reserved keys from any
 * client-supplied `requestContext`, so only server auth can set it. The value
 * mirrors `MASTRA_USER_KEY` exported by `@mastra/server/auth`. It is not
 * imported at runtime because `@mastra/server` is only a transitive dependency
 * of the pinned Mastra family; tests/mastra-server-auth-http.test.ts pins both
 * the constant and the real server behavior, so an upgrade that renames the key
 * fails CI instead of silently denying every privileged workflow.
 */
export const MASTRA_USER_KEY = "mastra__user";

type ContextReader = { get: (key: string) => unknown } | null | undefined;

export type AuthenticatedWorkflowUser = {
  userId: string;
  orgId: string;
  accessToken: string | null;
};

/**
 * The verified caller carried by the run's RequestContext: set by Mastra server
 * auth on the HTTP path, or by `createTrustedWorkflowRequestContext` for
 * in-process starts. `null` when absent; a present-but-malformed identity throws.
 */
export function readAuthenticatedWorkflowUser(
  requestContext: ContextReader,
): AuthenticatedWorkflowUser | null {
  const user = requestContext?.get(MASTRA_USER_KEY);
  if (user === undefined || user === null) return null;

  const { id, orgId } = user as { id?: unknown; orgId?: unknown };
  if (typeof id !== "string" || !id || typeof orgId !== "string" || !orgId) {
    throw new Error("Authenticated workflow identity is incomplete");
  }
  const token = requestContext?.get(MASTRA_AUTH_TOKEN_KEY);
  return {
    userId: id,
    orgId,
    accessToken: typeof token === "string" && token ? token : null,
  };
}

/**
 * Actor for a privileged step: always the authenticated user. A missing
 * identity fails closed, and a caller `claimedUserId` (e.g. `actorId`,
 * `stagedBy`) that disagrees fails closed. The claim is never authority.
 */
export function resolveWorkflowActorId(
  requestContext: ContextReader,
  claimedUserId: string | null | undefined,
): string {
  return requireAuthenticatedWorkflowUser(requestContext, claimedUserId).userId;
}

/** Authenticated workflow user, or throw; a mismatching claim also throws. */
export function requireAuthenticatedWorkflowUser(
  requestContext: ContextReader,
  claimedUserId?: string | null,
): AuthenticatedWorkflowUser {
  const user = readAuthenticatedWorkflowUser(requestContext);
  if (!user) throw new Error("Authenticated workflow identity required");
  if (claimedUserId && claimedUserId !== user.userId) {
    throw new Error("Workflow actor does not match the authenticated user");
  }
  return user;
}

/**
 * Trusted RequestContext for an in-process workflow start. Re-verifies the
 * access token with Supabase Auth, resolves the single trusted org from the
 * user's own membership (RLS), and sets the same reserved keys Mastra server
 * auth sets on the HTTP path. Returns `null` when the session is not usable.
 */
export async function createTrustedWorkflowRequestContext(
  accessToken: string,
): Promise<RequestContext | null> {
  const user = await resolveMastraIdentity(accessToken, resolveSupabaseUserAuthConfig);
  if (!user) return null;
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_USER_KEY, user);
  requestContext.set(MASTRA_AUTH_TOKEN_KEY, accessToken);
  requestContext.set(MASTRA_RESOURCE_ID_KEY, user.resourceId);
  return requestContext;
}
