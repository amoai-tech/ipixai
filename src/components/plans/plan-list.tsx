import { StatusChip } from "@/components/ui/status-chip";
import {
  formatPlanDateRange,
  planPriorityLabel,
  planTaskStatusDotToken,
  planTaskStatusLabel,
} from "@/lib/plans/plan-display";
import type { PlanDetail, PlanTask } from "@/lib/plans/plan-types";

import { assigneeLabel, phaseName } from "./plan-view-utils";
import styles from "./plan-workspace.module.css";

/**
 * IPI-1074 · PLANS-001 — read-only task table. Semantically accessible
 * (caption + th scope="col"); rows are sorted by phase order then sortOrder
 * and open the read-only task detail on click.
 */
export function PlanList({
  detail,
  onSelectTask,
}: {
  detail: PlanDetail;
  onSelectTask: (task: PlanTask) => void;
}) {
  const phases = detail.phases;
  const ordered = [...detail.tasks].sort((a, b) => {
    const phaseA = a.phaseId ? (phases.find((p) => p.id === a.phaseId)?.orderIndex ?? Infinity) : Infinity;
    const phaseB = b.phaseId ? (phases.find((p) => p.id === b.phaseId)?.orderIndex ?? Infinity) : Infinity;
    if (phaseA !== phaseB) return phaseA - phaseB;
    return a.sortOrder - b.sortOrder;
  });

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} data-testid="plan-list-table">
        <caption>{detail.tasks.length} task{detail.tasks.length === 1 ? "" : "s"}</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Phase</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Assignee</th>
            <th scope="col">Dates</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((task) => (
            <tr
              key={task.id}
              className={styles.tableRow}
              tabIndex={0}
              aria-label={`Open ${task.title} details`}
              onClick={() => onSelectTask(task)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectTask(task);
                }
              }}
            >
              <td className={styles.tableTitle}>{task.title}</td>
              <td>{phaseName(detail.phases, task)}</td>
              <td>
                <StatusChip
                  dot={planTaskStatusDotToken(task.status)}
                  label={planTaskStatusLabel(task.status)}
                  bare
                />
              </td>
              <td>{planPriorityLabel(task.priority)}</td>
              <td>{assigneeLabel(task)}</td>
              <td>{formatPlanDateRange(task.startDate, task.endDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}