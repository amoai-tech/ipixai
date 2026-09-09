"use server";

import { noopObserve } from "@mastra/core/tools";

import { requestToken } from "@/lib/request-token";
import { createClient } from "@/lib/supabase/server";
import { approveDraft, startBrandAnalysis } from "@/mastra/tools/brand-intelligence";

/**
 * IPI-1093 · BRAND-INTEL-001 — Brand Detail review-card server actions.
 *
 * Consequential-action rule: the operator explicitly clicks Approve/Reject
 * with the exact `draftHash` their browser rendered; nothing here
 * recomputes that hash or decides on the operator's behalf.
 *
 * Reuses `approveDraft`/`startBrandAnalysis` — the same hardened Mastra
 * tools proven in PR #116 (trusted workflow-run binding, permanent
 * one-hash-one-decision, post-commit resume recovery) — rather than
 * duplicating their RPC/reconciliation logic here. `requestToken` is a
 * plain AsyncLocalStorage, not CopilotKit-specific, so it scopes cleanly
 * to this Server Action's request too.
 */

type ActionResult = { ok: boolean; message: string };

// The installed Mastra Tool.execute signature is (inputData, context); see
// tests/brand-intelligence-tools.test.ts for the same cast against the
// installed @mastra/core types. `observe` is the only required field.
const toolCtx = { observe: noopObserve } as Parameters<
  NonNullable<typeof approveDraft.execute>
>[1];

async function getOperatorAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function decideBrandDraft(
  brandId: string,
  draftHash: string,
  approved: boolean,
): Promise<ActionResult> {
  const token = await getOperatorAccessToken();
  if (!token) return { ok: false, message: "Not authenticated — please sign in and try again." };

  try {
    const result = await requestToken.run(token, () =>
      approveDraft.execute!({ brandId, draftHash, approved }, toolCtx),
    );
    return result as ActionResult;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not record this decision.",
    };
  }
}

export async function startBrandAnalysisAction(brandId: string): Promise<ActionResult> {
  const token = await getOperatorAccessToken();
  if (!token) return { ok: false, message: "Not authenticated — please sign in and try again." };

  try {
    const result = (await requestToken.run(token, () =>
      startBrandAnalysis.execute!({ brandId }, toolCtx),
    )) as { runId: string; message: string };
    return { ok: true, message: result.message };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not start the analysis.",
    };
  }
}
