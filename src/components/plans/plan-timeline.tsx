import { StatusChip } from "@/components/ui/status-chip";
import {
  formatPlanDateRange,
  planTaskStatusDotToken,
  planTaskStatusLabel,
} from "@/lib/plans/plan-display";
import type { PlanDetail, PlanTask } from "@/lib/plans/plan-types";

import { tasksForPhase } from "./plan-view-utils";
import styles from "./plan-workspace.module.css";

/**
 * IPI-1074 · PLANS-001 — read-only timeline: one column per phase (by
 * orderIndex), tasks stacked inside their phase by sortOrder. Tasks without
 * a phase render in a trailing "Unscheduled" column. No drag/drop.
 */
export function PlanTimeline({
  detail,
  onSelectTask,
}: {
  detail: PlanDetail;
  onSelectTask: (task: PlanTask) => void;
}) {
  const phases = [...detail.phases].sort((a, b) => a.orderIndex - b.orderIndex);
  const hasUnscheduled = detail.tasks.some((task) => task.phaseId === null);

  return (
    <div className={styles.timeline} data-testid="plan-timeline">
      {phases.map((phase) => {
        const tasks = tasksForPhase(detail.tasks, phase.id);
        return (
          <section key={phase.id} className={styles.timelineColumn} aria-label={phase.name}>
            <h2 className={styles.timelineColumnHeader}>{phase.name}</h2>
            {tasks.length === 0 ? (
              <p className={styles.emptyColumn}>No tasks</p>
            ) : (
              tasks.map((task) => (
                <TaskBar key={task.id} task={task} onSelectTask={onSelectTask} />
              ))
            )}
          </section>
        );
      })}
      {hasUnscheduled ? (
        <section className={styles.timelineColumn} aria-label="Unscheduled">
          <h2 className={styles.timelineColumnHeader}>Unscheduled</h2>
          {tasksForPhase(detail.tasks, null).map((task) => (
            <TaskBar key={task.id} task={task} onSelectTask={onSelectTask} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function TaskBar({
  task,
  onSelectTask,
}: {
  task: PlanTask;
  onSelectTask: (task: PlanTask) => void;
}) {
  return (
    <button type="button" className={styles.timelineTask} onClick={() => onSelectTask(task)}>
      <span className={styles.timelineTaskTitle}>{task.title}</span>
      <span className={styles.timelineTaskMeta}>
        <StatusChip
          dot={planTaskStatusDotToken(task.status)}
          label={planTaskStatusLabel(task.status)}
          bare
        />
      </span>
      <span className={styles.timelineTaskMeta}>
        {formatPlanDateRange(task.startDate, task.endDate)}
      </span>
    </button>
  );
}