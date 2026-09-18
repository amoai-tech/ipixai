import { getVerifiedOperatorForRequest } from "@/lib/auth/operator-auth";
import { unauthorizedResponse } from "@/lib/auth/unauthorized";
import { loadShotReferenceCatalog } from "@/lib/shoot/shot-type-references";

/**
 * IPI-1084 · APPROVAL-001 — the trusted shot-reference catalog for the review
 * surface. Read-only, authenticated, and deliberately not org-scoped: the
 * catalog is the shared canonical reference set (49 rows), while the approval
 * decision itself remains org- and role-gated. `loadShotReferenceCatalog`
 * already fails closed to an empty list rather than throwing.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const operator = await getVerifiedOperatorForRequest(request);
  if (!operator) return unauthorizedResponse();

  const references = await loadShotReferenceCatalog();
  return Response.json(
    { references },
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
