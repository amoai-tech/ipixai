"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

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
 * IPI-1074 · PLANS-001 — read-only task detail drawer. No mutation controls;
 * Escape and the close button dismiss it. Focus moves to the close button on
 * open and returns to nothing (the caller's trigger) on close.
 */
export function PlanTaskDetail({
  task,
  detail,
  onClose,
}: {
  task: PlanTask;
  detail: PlanDetail;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} data-testid="plan-task-drawer-overlay" />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`${task.title} — task details`}
        data-testid="plan-task-drawer"
      >
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>{task.title}</h2>
          <button
            type="button"
            ref={closeRef}
            className={styles.closeButton}
            aria-label="Close task details"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className={styles.drawerBody}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <StatusChip
              dot={planTaskStatusDotToken(task.status)}
              label={planTaskStatusLabel(task.status)}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Phase</span>
            <span className={styles.fieldValue}>{phaseName(detail.phases, task)}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Priority</span>
            <span className={styles.fieldValue}>{planPriorityLabel(task.priority)}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Dates</span>
            <span className={styles.fieldValue}>{formatPlanDateRange(task.startDate, task.endDate)}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Assignee</span>
            <span className={styles.fieldValue}>{assigneeLabel(task)}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Description</span>
            <span className={styles.fieldValue}>{task.description ?? "No description."}</span>
          </div>
        </div>
        <p className={styles.drawerFooter}>Read-only view — editing arrives with a later task.</p>
      </aside>
    </>
  );
}