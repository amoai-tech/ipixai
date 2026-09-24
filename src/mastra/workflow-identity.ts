import { MASTRA_AUTH_TOKEN_KEY } from "@mastra/core/request-context";

/**
 * IPI-1326 · MASTRA-WORKFLOW-AUTHZ-001 — who is a privileged workflow acting for?
 *
 * Mastra's server auth middleware stores the verified user under this reserved
 * RequestContext key, and `@mastra/server` drops reserved keys from any
 * client-supplied `requestContext`, so only server auth can set it. The value
 * mirrors `MASTRA_USER_KEY` in `@mastra/server`; `@mastra/core@1.63.2` does not
 * export that constant from its public entry.
 */
export const MASTRA_USER_KEY = "mastra__user";

type ContextReader = { get: (key: string) => unknown } | undefined;

export type AuthenticatedWorkflowUser = {
  userId: string;
  orgId: string;
  accessToken: string | null;
};

/**
 * The verified caller when the run was started through authenticated Mastra
 * (HTTP agent/tool path), or `null` for a trusted in-process start by a Next
 * route or tool that already authorized the operator. A present-but-malformed
 * identity throws instead of being treated as in-process.
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
 * Actor for a privileged step. The authenticated user always wins; a caller
 * `claimedUserId` (e.g. `actorId`, `stagedBy`) that disagrees fails closed. The
 * claim is used only for trusted in-process starts that carry no Mastra user.
 */
export function resolveWorkflowActorId(
  requestContext: ContextReader,
  claimedUserId: string | null | undefined,
): string {
  const user = readAuthenticatedWorkflowUser(requestContext);
  if (user) {
    if (claimedUserId && claimedUserId !== user.userId) {
      throw new Error("Workflow actor does not match the authenticated user");
    }
    return user.userId;
  }
  if (!claimedUserId) throw new Error("Workflow actor unavailable");
  return claimedUserId;
}
