import { getVerifiedOperatorForRequest } from "@/lib/auth/operator-auth";
import {
  listMembershipOrgIdsFromServerClient,
  resolveRuntimeTenant,
  runtimeTenantDenied,
} from "@/lib/auth/runtime-org";
import { unauthorizedResponse } from "@/lib/auth/unauthorized";
import {
  memoryResourceId,
  type VerifiedOperator,
} from "@/lib/auth/verified-operator";
import { createClientFromRequest } from "@/lib/supabase/server";

/** Intelligence keys threads by `id`; CopilotKit also requires a non-empty `name`. */
export function intelligenceIdentifyUser(input: {
  resourceId: string;
  operator: VerifiedOperator;
}): { id: string; name: string } {
  return { id: input.resourceId, name: input.operator.name };
}

export async function requirePlannerResourceId(request: Request): Promise<
  | { ok: true; resourceId: string; operator: VerifiedOperator }
  | { ok: false; response: Response }
> {
  const operator = await getVerifiedOperatorForRequest(request);
  if (!operator) return { ok: false, response: unauthorizedResponse() };

  const supabase = createClientFromRequest(request);
  if (!supabase) return { ok: false, response: unauthorizedResponse() };

  const tenant = await resolveRuntimeTenant({
    listOrgIds: () =>
      listMembershipOrgIdsFromServerClient(supabase, operator.id),
  });
  if (tenant.status !== "ok") {
    return { ok: false, response: runtimeTenantDenied(tenant) };
  }

  return {
    ok: true,
    resourceId: memoryResourceId({
      userId: operator.id,
      orgId: tenant.orgId,
    }),
    operator,
  };
}
