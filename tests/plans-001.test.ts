import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadPlanDetailForOrg } from "@/lib/plans/get-plan-detail";
import { listPlansForOrg } from "@/lib/plans/get-plans";
import type { PlanDetail, PlanListRow } from "@/lib/plans/plan-types";

const ORG_A = "aaaaaaaa-0000-4000-8000-000000000001";
const PLAN_A1 = "bbbbbbbb-0000-4000-8000-000000000001";
const PLAN_A2 = "bbbbbbbb-0000-4000-8000-000000000002";
const ENTITY_A = "cccccccc-0000-4000-8000-000000000001";
const WORKFLOW_A = "dddddddd-0000-4000-8000-000000000001";
const PHASE_A1 = "eeeeeeee-0000-4000-8000-000000000001";
const TASK_A1 = "ffffffff-0000-4000-8000-000000000001";

/** Fake SupabaseClient whose `.rpc()` resolves to a caller-controlled
 *  `{ data, error }`. Cast to the real client type at the boundary — the DAL
 *  is typed with `SupabaseClient`, so the fake only needs to satisfy the
 *  `.rpc()` shape actually called at runtime. */
function fakeRpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as unknown as SupabaseClient;
}

function listRow(overrides: Partial<PlanListRow> & { id: string }): PlanListRow {
  return {
    name: "Summer Lookbook",
    entityType: "shoot",
    entityId: ENTITY_A,
    status: "planned",
    plannedStart: "2026-09-14",
    plannedEnd: "2026-09-20",
    createdAt: "2026-09-07T12:00:00.000Z",
    updatedAt: "2026-09-08T12:00:00.000Z",
    workflowName: "Standard Shoot",
    ...overrides,
  };
}

function listPayload(overrides: {
  rows?: PlanListRow[];
  nextCursor?: string | null;
  hasMore?: boolean;
} = {}) {
  return {
    ok: true as const,
    rows: overrides.rows ?? [listRow({ id: PLAN_A1 })],
    nextCursor: overrides.nextCursor ?? null,
    hasMore: overrides.hasMore ?? false,
  };
}

function detailPayload(overrides: Partial<PlanDetail> & { instanceId?: string } = {}): PlanDetail {
  const instanceId = overrides.instanceId ?? PLAN_A1;
  return {
    ok: true,
    instance: {
      id: instanceId,
      orgId: ORG_A,
      workflowId: WORKFLOW_A,
      entityType: "shoot",
      entityId: ENTITY_A,
      name: "Summer Lookbook",
      status: "planned",
      plannedStart: "2026-09-14",
      plannedEnd: "2026-09-20",
      ownerUserId: null,
      createdAt: "2026-09-07T12:00:00.000Z",
      updatedAt: "2026-09-08T12:00:00.000Z",
    },
    workflow: {
      id: WORKFLOW_A,
      name: "Standard Shoot",
      category: "shoot",
      version: 1,
      isDefault: true,
    },
    phases: [
      {
        id: PHASE_A1,
        workflowId: WORKFLOW_A,
        slug: "preproduction",
        name: "Pre-production",
        orderIndex: 0,
        defaultDurationDays: 5,
        gateType: null,
        requiredRole: null,
      },
    ],
    tasks: [
      {
        id: TASK_A1,
        instanceId,
        phaseId: PHASE_A1,
        parentTaskId: null,
        title: "Book studio",
        description: null,
        startDate: "2026-09-14",
        endDate: "2026-09-15",
        durationDays: 2,
        status: "todo",
        priority: "medium",
        assigneeUserId: null,
        assigneeRole: null,
        sortOrder: 0,
      },
    ],
    dependencies: [],
    assignments: [],
    gateApprovals: [],
    viewConfig: {
      id: "abababab-0000-4000-8000-000000000001",
      instanceId,
      defaultView: "timeline",
      filters: null,
      sortConfig: null,
    },
  };
}

describe("plans-001 DAL — listPlansForOrg", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns rows + cursor on a valid payload", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: listPayload(), error: null });
    const result = await listPlansForOrg(fakeRpcClient(rpc), ORG_A, { search: "summer" });

    expect(result).toEqual({
      ok: true,
      rows: [expect.objectContaining({ id: PLAN_A1, name: "Summer Lookbook" })],
      nextCursor: null,
      hasMore: false,
    });
    expect(rpc).toHaveBeenCalledWith("planner_list_instances", {
      p_org_id: ORG_A,
      p_search: "summer",
      p_entity_type: null,
      p_status: null,
      p_include_archived: false,
      p_limit: 20,
      p_cursor: null,
    });
  });

  it("maps a 42501 rpc error to forbidden", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "forbidden" },
    });
    await expect(listPlansForOrg(fakeRpcClient(rpc), ORG_A)).resolves.toEqual({
      ok: false,
      reason: "forbidden",
    });
  });

  it("maps a 22023 rpc error to invalid_input", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "22023", message: "invalid_entity_type" },
    });
    await expect(listPlansForOrg(fakeRpcClient(rpc), ORG_A)).resolves.toEqual({
      ok: false,
      reason: "invalid_input",
    });
  });

  it("maps a generic rpc error to query_failed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST999", message: "db down" },
    });
    await expect(listPlansForOrg(fakeRpcClient(rpc), ORG_A)).resolves.toEqual({
      ok: false,
      reason: "query_failed",
    });
  });

  it("maps a malformed payload to query_failed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, rows: [{ id: "not-a-uuid" }], nextCursor: null, hasMore: true },
      error: null,
    });
    await expect(listPlansForOrg(fakeRpcClient(rpc), ORG_A)).resolves.toEqual({
      ok: false,
      reason: "query_failed",
    });
  });

  it("maps a thrown rpc call to query_failed", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("network"));
    await expect(listPlansForOrg(fakeRpcClient(rpc), ORG_A)).resolves.toEqual({
      ok: false,
      reason: "query_failed",
    });
  });
});

describe("plans-001 DAL — loadPlanDetailForOrg", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the detail when the payload instance id matches", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: detailPayload(), error: null });
    const result = await loadPlanDetailForOrg(fakeRpcClient(rpc), PLAN_A1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.detail.instance.id).toBe(PLAN_A1);
      expect(result.detail.tasks).toHaveLength(1);
      expect(result.detail.viewConfig?.defaultView).toBe("timeline");
    }
    expect(rpc).toHaveBeenCalledWith("planner_get_instance_detail", { p_instance_id: PLAN_A1 });
  });

  it("maps a P0002 rpc error to not_found", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "not_found" },
    });
    await expect(loadPlanDetailForOrg(fakeRpcClient(rpc), PLAN_A1)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("maps a 42501 rpc error to forbidden", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "forbidden" },
    });
    await expect(loadPlanDetailForOrg(fakeRpcClient(rpc), PLAN_A1)).resolves.toEqual({
      ok: false,
      reason: "forbidden",
    });
  });

  it("maps a generic rpc error to query_failed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST999", message: "db down" },
    });
    await expect(loadPlanDetailForOrg(fakeRpcClient(rpc), PLAN_A1)).resolves.toEqual({
      ok: false,
      reason: "query_failed",
    });
  });

  it("maps a malformed payload to query_failed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, instance: { id: "nope" }, phases: 42 },
      error: null,
    });
    await expect(loadPlanDetailForOrg(fakeRpcClient(rpc), PLAN_A1)).resolves.toEqual({
      ok: false,
      reason: "query_failed",
    });
  });

  it("maps a payload whose instance id does not match the requested id to query_failed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: detailPayload({ instanceId: PLAN_A2 }),
      error: null,
    });
    await expect(loadPlanDetailForOrg(fakeRpcClient(rpc), PLAN_A1)).resolves.toEqual({
      ok: false,
      reason: "query_failed",
    });
  });

  it("maps a thrown rpc call to query_failed", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("network"));
    await expect(loadPlanDetailForOrg(fakeRpcClient(rpc), PLAN_A1)).resolves.toEqual({
      ok: false,
      reason: "query_failed",
    });
  });
});