import { z } from "zod";

import { getVerifiedOperatorForRequest } from "@/lib/auth/operator-auth";
import { badRequestResponse, unauthorizedResponse } from "@/lib/auth/unauthorized";
import { jsonError } from "@/lib/http/json-response";
import { saveApprovedShoot } from "@/lib/shoot/save-approved-shoot";
import { createClientFromRequest } from "@/lib/supabase/server";
import { rpcCallFromClient } from "@/lib/supabase/rpc-adapter";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ approvalId: z.string().uuid() }).strict();

function statusForCode(code: string): number {
  switch (code) {
    case "UNAUTHENTICATED": return 401;
    case "FORBIDDEN": return 403;
    case "NOT_FOUND": return 404;
    case "INVALID_INPUT":
    case "INVALID_PLAN": return 400;
    case "HASH_MISMATCH":
    case "NOT_APPROVED":
    case "SUPERSEDED_REVISION": return 409;
    default: return 503;
  }
}

export async function POST(request: Request): Promise<Response> {
  const operator = await getVerifiedOperatorForRequest(request);
  if (!operator) return unauthorizedResponse();

  const supabase = createClientFromRequest(request);
  if (!supabase) return unauthorizedResponse();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequestResponse("invalid_body");
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return badRequestResponse("invalid_body");

  const result = await saveApprovedShoot(parsed.data.approvalId, {
    rpc: rpcCallFromClient(supabase),
  });
  if (!result.ok) {
    return jsonError(statusForCode(result.code), "error", result.code.toLowerCase());
  }

  return Response.json(result, { status: 200, headers: { "content-type": "application/json" } });
}
