import { z } from "zod";

export const planInstanceStatusSchema = z.enum([
  "draft",
  "planned",
  "active",
  "blocked",
  "completed",
  "archived",
  "cancelled",
]);

export const planTaskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);

export const planEntityTypeSchema = z.enum(["shoot", "campaign", "crm_deal"]);

export const planListRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  entityType: planEntityTypeSchema,
  entityId: z.string().uuid(),
  status: planInstanceStatusSchema,
  plannedStart: z.string().nullable(),
  plannedEnd: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  workflowName: z.string(),
});

export const planListResponseSchema = z.object({
  ok: z.literal(true),
  rows: z.array(planListRowSchema),
  nextCursor: z.string().uuid().nullable(),
  hasMore: z.boolean(),
});

export const planInstanceSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  workflowId: z.string().uuid(),
  entityType: planEntityTypeSchema,
  entityId: z.string().uuid(),
  name: z.string(),
  status: planInstanceStatusSchema,
  plannedStart: z.string().nullable(),
  plannedEnd: z.string().nullable(),
  ownerUserId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const planWorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  version: z.number(),
  isDefault: z.boolean(),
});

export const planPhaseSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  orderIndex: z.number(),
  defaultDurationDays: z.number(),
  gateType: z.string().nullable(),
  requiredRole: z.string().nullable(),
});

export const planTaskSchema = z.object({
  id: z.string().uuid(),
  instanceId: z.string().uuid(),
  phaseId: z.string().uuid().nullable(),
  parentTaskId: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  durationDays: z.number().nullable(),
  status: planTaskStatusSchema,
  priority: z.enum(["low", "medium", "high", "critical"]),
  assigneeUserId: z.string().uuid().nullable(),
  assigneeRole: z.string().nullable(),
  sortOrder: z.number(),
});

export const planDependencySchema = z.object({
  id: z.string().uuid(),
  instanceId: z.string().uuid(),
  fromTaskId: z.string().uuid(),
  toTaskId: z.string().uuid(),
  depType: z.enum([
    "finish_to_start",
    "start_to_start",
    "finish_to_finish",
    "start_to_finish",
  ]),
  lagDays: z.number(),
});

export const planAssignmentSchema = z.object({
  id: z.string().uuid(),
  instanceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "manager", "contributor", "viewer"]),
  permissions: z.unknown().nullable(),
});

export const planGateApprovalSchema = z.object({
  id: z.string().uuid(),
  instanceId: z.string().uuid(),
  phaseId: z.string().uuid(),
  status: z.enum(["reachable", "approved", "discarded"]),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.string().nullable(),
});

export const planViewConfigSchema = z
  .object({
    id: z.string().uuid(),
    instanceId: z.string().uuid(),
    defaultView: z.enum(["timeline", "kanban", "calendar"]),
    filters: z.unknown(),
    sortConfig: z.unknown(),
  })
  .nullable();

export const planDetailResponseSchema = z.object({
  ok: z.literal(true),
  instance: planInstanceSchema,
  workflow: planWorkflowSchema,
  phases: z.array(planPhaseSchema),
  tasks: z.array(planTaskSchema),
  dependencies: z.array(planDependencySchema),
  assignments: z.array(planAssignmentSchema),
  gateApprovals: z.array(planGateApprovalSchema),
  viewConfig: planViewConfigSchema,
});

export type PlanInstanceStatus = z.infer<typeof planInstanceStatusSchema>;
export type PlanTaskStatus = z.infer<typeof planTaskStatusSchema>;
export type PlanEntityType = z.infer<typeof planEntityTypeSchema>;
export type PlanListRow = z.infer<typeof planListRowSchema>;
export type PlanListResponse = z.infer<typeof planListResponseSchema>;
export type PlanInstance = z.infer<typeof planInstanceSchema>;
export type PlanWorkflow = z.infer<typeof planWorkflowSchema>;
export type PlanPhase = z.infer<typeof planPhaseSchema>;
export type PlanTask = z.infer<typeof planTaskSchema>;
export type PlanDependency = z.infer<typeof planDependencySchema>;
export type PlanAssignment = z.infer<typeof planAssignmentSchema>;
export type PlanGateApproval = z.infer<typeof planGateApprovalSchema>;
export type PlanViewConfig = z.infer<typeof planViewConfigSchema>;
export type PlanDetail = z.infer<typeof planDetailResponseSchema>;