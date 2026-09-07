import type { SupabaseClient } from "@supabase/supabase-js";
import { planListResponseSchema, type PlanEntityType, type PlanListRow } from "@/lib/plans/plan-types";

export type PlanListFilters = {
  search?: string | null;
  entityType?: PlanEntityType | null;
  status?: string | null;
  includeArchived?: boolean;
  limit?: number;
  after?: string | null;
};

export type PlanListResult =
  | { ok: true; rows: PlanListRow[]; nextCursor: string | null; hasMore: boolean }
  | { ok: false; reason: "forbidden" | "invalid_input" | "query_failed" };

export async function listPlansForOrg(
  supabase: SupabaseClient,
  orgId: string,
  filters: PlanListFilters = {},
): Promise<PlanListResult> {
  try {
    const { data, error } = await supabase.rpc("planner_list_instances", {
      p_org_id: orgId,
      p_search: filters.search ?? null,
      p_entity_type: filters.entityType ?? null,
      p_status: filters.status ?? null,
      p_include_archived: filters.includeArchived ?? false,
      p_limit: filters.limit ?? 20,
      p_cursor: filters.after ?? null,
    });
    if (error) {
      if (error.code === "42501") {
        return { ok: false, reason: "forbidden" };
      }
      if (error.code === "22023") {
        return { ok: false, reason: "invalid_input" };
      }
      console.error("plans.listPlansForOrg: rpc failed", { orgId, error });
      return { ok: false, reason: "query_failed" };
    }
    const parsed = planListResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error("plans.listPlansForOrg: malformed payload", { issues: parsed.error.issues });
      return { ok: false, reason: "query_failed" };
    }
    return {
      ok: true,
      rows: parsed.data.rows,
      nextCursor: parsed.data.nextCursor,
      hasMore: parsed.data.hasMore,
    };
  } catch (err) {
    console.error("plans.listPlansForOrg: threw", { err });
    return { ok: false, reason: "query_failed" };
  }
}