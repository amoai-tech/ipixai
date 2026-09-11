import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type AgentLogInput = {
  agentName: string;
  userId: string | null;
  brandId?: string | null;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  durationMs?: number | null;
};

/** Insert a row into public.ai_agent_logs (user-scoped client recommended). */
export async function insertAgentLog(
  client: SupabaseClient,
  entry: AgentLogInput,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("ai_agent_logs")
    .insert({
      user_id: entry.userId,
      brand_id: entry.brandId ?? null,
      agent_name: entry.agentName,
      input: entry.input ?? {},
      output: entry.output ?? {},
      model: entry.model ?? null,
      tokens_in: entry.tokensIn ?? null,
      tokens_out: entry.tokensOut ?? null,
      duration_ms: entry.durationMs ?? null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to insert ai_agent_log");
  }

  return { id: data.id as string };
}
