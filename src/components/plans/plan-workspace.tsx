"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StatusChip } from "@/components/ui/status-chip";
import {
  planInstanceStatusDotToken,
  planInstanceStatusLabel,
} from "@/lib/plans/plan-display";
import type { PlanDetail, PlanTask } from "@/lib/plans/plan-types";

import { PlanCalendar } from "./plan-calendar";
import { PlanKanban } from "./plan-kanban";
import { PlanList } from "./plan-list";
import { PlanTaskDetail } from "./plan-task-detail";
import { PlanTimeline } from "./plan-timeline";
import styles from "./plan-workspace.module.css";

export type PlanViewKey = "timeline" | "kanban" | "calendar" | "list";

const VIEWS: { key: PlanViewKey; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "kanban", label: "Kanban" },
  { key: "calendar", label: "Calendar" },
  { key: "list", label: "List" },
];

/**
 * IPI-1074 · PLANS-001 — read-only plan workspace. One shared `detail` DTO
 * powers all four views (no duplicate fetches); view selection is client
 * state only, defaulting to the plan's saved default view when present.
 * Clicking a task in any view opens the same read-only detail drawer.
 */
export function PlanWorkspace({ detail }: { detail: PlanDetail }) {
  const [view, setView] = useState<PlanViewKey>(
    detail.viewConfig?.defaultView ?? "timeline",
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask =
    detail.tasks.find((task) => task.id === selectedTaskId) ?? null;

  function openTask(task: PlanTask) {
    setSelectedTaskId(task.id);
  }

  return (
    <div className={styles.root} data-testid="plan-workspace">
      <Link href="/app/plans" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden />
        Plans
      </Link>

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.heading}>{detail.instance.name}</h1>
          <StatusChip
            dot={planInstanceStatusDotToken(detail.instance.status)}
            label={planInstanceStatusLabel(detail.instance.status)}
          />
        </div>
        <p className={styles.subheading}>{detail.workflow.name}</p>
      </header>

      <div role="tablist" aria-label="Plan views" className={styles.viewTabs}>
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`plan-view-${item.key}`}
            aria-selected={view === item.key}
            aria-controls={`plan-view-panel-${item.key}`}
            tabIndex={view === item.key ? 0 : -1}
            className={`${styles.viewTab} ${view === item.key ? styles.viewTabActive : ""}`}
            onClick={() => setView(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="plan-view-panel-timeline"
        aria-labelledby="plan-view-timeline"
        className={styles.viewPanel}
        hidden={view !== "timeline"}
      >
        <PlanTimeline detail={detail} onSelectTask={openTask} />
      </div>
      <div
        role="tabpanel"
        id="plan-view-panel-kanban"
        aria-labelledby="plan-view-kanban"
        className={styles.viewPanel}
        hidden={view !== "kanban"}
      >
        <PlanKanban detail={detail} onSelectTask={openTask} />
      </div>
      <div
        role="tabpanel"
        id="plan-view-panel-calendar"
        aria-labelledby="plan-view-calendar"
        className={styles.viewPanel}
        hidden={view !== "calendar"}
      >
        <PlanCalendar detail={detail} />
      </div>
      <div
        role="tabpanel"
        id="plan-view-panel-list"
        aria-labelledby="plan-view-list"
        className={styles.viewPanel}
        hidden={view !== "list"}
      >
        <PlanList detail={detail} onSelectTask={openTask} />
      </div>

      {selectedTask ? (
        <PlanTaskDetail
          task={selectedTask}
          detail={detail}
          onClose={() => setSelectedTaskId(null)}
        />
      ) : null}
    </div>
  );
}