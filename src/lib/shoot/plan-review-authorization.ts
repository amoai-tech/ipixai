import { planApprovalMessage } from "@/lib/shoot/plan-approval";

/**
 * IPI-1084 · APPROVAL-001 — editor/owner authorization for plan review.
 *
 * The org is resolved from the brand row with the caller's own session client,
 * so row-level security hides foreign-org brands and they surface as NOT_FOUND
 * (never as a permission oracle). Client-supplied org or user ids are never
 * accepted, and a browser request can never reach the service-role path.
 */

export type PlanReviewAuthzRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export type PlanReviewAuthorizationResult =
  | { ok: true; orgId: string }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" | "LOOKUP_FAILED"; message: string };

export async function authorizePlanReviewEditor(
  input: { brandId: string; operatorId?: string | null },
  deps: {
    brands: {
      selectOrgId: (brandId: string) => Promise<{ data: unknown; error: unknown }>;
    };
    rpc: PlanReviewAuthzRpc;
  },
): Promise<PlanReviewAuthorizationResult> {
  const forbidden = (): PlanReviewAuthorizationResult => ({
    ok: false,
    code: "FORBIDDEN",
    message: planApprovalMessage("FORBIDDEN"),
  });
  const notFound = (): PlanReviewAuthorizationResult => ({
    ok: false,
    code: "NOT_FOUND",
    message: planApprovalMessage("NOT_FOUND"),
  });
  const lookupFailed = (): PlanReviewAuthorizationResult => ({
    ok: false,
    code: "LOOKUP_FAILED",
    message: planApprovalMessage("LOOKUP_FAILED"),
  });

  if (!input.brandId || !input.operatorId) return notFound();

  let orgId: string | null = null;
  try {
    const { data, error } = await deps.brands.selectOrgId(input.brandId);
    if (error) return notFound();
    if (typeof data === "object" && data !== null) {
      const value = (data as { org_id?: unknown }).org_id;
      orgId = typeof value === "string" && value.length > 0 ? value : null;
    }
  } catch {
    return notFound();
  }
  if (!orgId) return notFound();

  try {
    const { data, error } = await deps.rpc("is_org_editor_or_above", { p_org_id: orgId });
    if (error) return lookupFailed();
    if (data !== true) return forbidden();
  } catch {
    return lookupFailed();
  }

  return { ok: true, orgId };
}
