import { StatusChip } from "@/components/ui/status-chip";
import {
  PLAN_TASK_STATUS_ORDER,
  planTaskStatusDotToken,
  planTaskStatusLabel,
} from "@/lib/plans/plan-display";
import type { PlanDetail, PlanTask } from "@/lib/plans/plan-types";

import { sortTasks } from "./plan-view-utils";
import styles from "./plan-workspace.module.css";

/**
 * IPI-1074 · PLANS-001 — read-only kanban: one column per task status, cards
 * ordered by sortOrder. No drag/drop and no status writes — cards open the
 * read-only task detail instead.
 */
export function PlanKanban({
  detail,
  onSelectTask,
}: {
  detail: PlanDetail;
  onSelectTask: (task: PlanTask) => void;
}) {
  const tasks = sortTasks(detail.tasks);
  return (
    <div className={styles.board} data-testid="plan-kanban">
      {PLAN_TASK_STATUS_ORDER.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <section key={status} className={styles.kanbanColumn} aria-label={planTaskStatusLabel(status)}>
            <div className={styles.kanbanColumnHeader}>
              <StatusChip dot={planTaskStatusDotToken(status)} label={planTaskStatusLabel(status)} />
              <span className={styles.kanbanCount}>{columnTasks.length}</span>
            </div>
            {columnTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className={styles.kanbanCard}
                onClick={() => onSelectTask(task)}
              >
                <span className={styles.kanbanCardTitle}>{task.title}</span>
                <span className={styles.kanbanCardMeta}>{task.priority}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}