import { isDatabaseUuid } from "@/lib/database-uuid";

import { forbiddenResponse, membershipLookupFailedResponse } from "./unauthorized";

export type RuntimeOrgResolution =
  | { status: "ok"; orgId: string }
  | { status: "needs_onboarding" }
  | { status: "needs_org_selection" }
  | { status: "lookup_failed" };

export type ProductBootstrap = "app" | "onboarding" | "org_selection";

function uniqueOrgIds(orgIds: string[]): string[] {
  const seen = new Set<string>();
  for (const id of orgIds) {
    if (!isDatabaseUuid(id) || seen.has(id)) continue;
    seen.add(id);
  }
  return [...seen];
}

/** Membership rows only. Client org hints and user_metadata are ignored. */
export function resolveTrustedRuntimeOrg(options: {
  membershipOrgIds: string[];
  clientOrgId?: string | null;
  userMetadataOrgId?: string | null;
}): RuntimeOrgResolution {
  void options.clientOrgId;
  void options.userMetadataOrgId;
  const orgIds = uniqueOrgIds(options.membershipOrgIds);
  if (orgIds.length === 0) return { status: "needs_onboarding" };
  if (orgIds.length > 1) return { status: "needs_org_selection" };
  return { status: "ok", orgId: orgIds[0] };
}

export function productBootstrapFor(
  resolution: Extract<
    RuntimeOrgResolution,
    { status: "needs_onboarding" } | { status: "needs_org_selection" }
  >,
): ProductBootstrap {
  if (resolution.status === "needs_org_selection") return "org_selection";
  return "onboarding";
}

type OrgMembersClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        userId: string,
      ) => PromiseLike<{ data: { org_id: string }[] | null; error: unknown }>;
    };
  };
};

export async function listMembershipOrgIds(
  supabase: OrgMembersClient,
  userId: string,
): Promise<{ ok: true; orgIds: string[] } | { ok: false }> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId);
  if (error || !data) return { ok: false };
  return { ok: true, orgIds: data.map((row) => row.org_id) };
}

/** AUTH-002: never pass client orgId / user_metadata into this lookup. */
export async function listMembershipOrgIdsFromServerClient(
  supabase: unknown,
  userId: string,
): Promise<{ ok: true; orgIds: string[] } | { ok: false }> {
  return listMembershipOrgIds(supabase as OrgMembersClient, userId);
}

export async function resolveRuntimeTenant(options: {
  listOrgIds: () => Promise<{ ok: true; orgIds: string[] } | { ok: false }>;
}): Promise<RuntimeOrgResolution> {
  try {
    const listed = await options.listOrgIds();
    if (!listed.ok) return { status: "lookup_failed" };
    return resolveTrustedRuntimeOrg({ membershipOrgIds: listed.orgIds });
  } catch {
    return { status: "lookup_failed" };
  }
}

export function runtimeTenantDenied(
  resolution: Exclude<RuntimeOrgResolution, { status: "ok" }>,
): Response {
  if (resolution.status === "lookup_failed") {
    return membershipLookupFailedResponse();
  }
  return forbiddenResponse(resolution.status);
}
