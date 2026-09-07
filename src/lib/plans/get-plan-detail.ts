import type { SupabaseClient } from "@supabase/supabase-js";
import { planDetailResponseSchema, type PlanDetail } from "@/lib/plans/plan-types";

export type PlanDetailResult =
  | { ok: true; detail: PlanDetail }
  | { ok: false; reason: "not_found" | "forbidden" | "query_failed" };

export async function loadPlanDetailForOrg(
  supabase: SupabaseClient,
  instanceId: string,
): Promise<PlanDetailResult> {
  try {
    const { data, error } = await supabase.rpc("planner_get_instance_detail", {
      p_instance_id: instanceId,
    });
    if (error) {
      if (error.code === "P0002") {
        return { ok: false, reason: "not_found" };
      }
      if (error.code === "42501") {
        return { ok: false, reason: "forbidden" };
      }
      console.error("plans.loadPlanDetailForOrg: rpc failed", { instanceId, error });
      return { ok: false, reason: "query_failed" };
    }
    const parsed = planDetailResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error("plans.loadPlanDetailForOrg: malformed payload", { issues: parsed.error.issues });
      return { ok: false, reason: "query_failed" };
    }
    if (parsed.data.instance.id !== instanceId) {
      console.error("plans.loadPlanDetailForOrg: payload instance id mismatch", {
        instanceId,
        returned: parsed.data.instance.id,
      });
      return { ok: false, reason: "query_failed" };
    }
    return { ok: true, detail: parsed.data };
  } catch (err) {
    console.error("plans.loadPlanDetailForOrg: threw", { err });
    return { ok: false, reason: "query_failed" };
  }
}