import type { PlanPhase, PlanTask } from "@/lib/plans/plan-types";

/** Tasks ordered by sortOrder (the read contract's primary sort). */
export function sortTasks(tasks: PlanTask[]): PlanTask[] {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Tasks belonging to a phase (null = unscheduled tasks). */
export function tasksForPhase(tasks: PlanTask[], phaseId: string | null): PlanTask[] {
  return sortTasks(tasks.filter((task) => (task.phaseId ?? null) === phaseId));
}

/** Look up a phase by id (null when the phase id isn't in the detail). */
export function phaseForTask(phases: PlanPhase[], task: PlanTask): PlanPhase | null {
  if (!task.phaseId) return null;
  return phases.find((phase) => phase.id === task.phaseId) ?? null;
}

export function phaseName(phases: PlanPhase[], task: PlanTask): string {
  return phaseForTask(phases, task)?.name ?? "Unscheduled";
}

/** The task DTO carries only an assignee role (no user display name), so
 *  the assignee column shows the role, "Unassigned", or "Assigned". */
export function assigneeLabel(task: PlanTask): string {
  if (task.assigneeUserId === null && task.assigneeRole === null) return "Unassigned";
  if (task.assigneeRole) return task.assigneeRole.replace(/_/g, " ");
  return "Assigned";
}