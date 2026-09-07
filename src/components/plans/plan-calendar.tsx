import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { PlanDetail, PlanTask } from "@/lib/plans/plan-types";

import styles from "./plan-workspace.module.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type YearMonth = { year: number; month: number };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): YearMonth & { day: number } | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/** Deterministic anchor: the month of the earliest real date on the plan
 *  (planned start, else earliest task date). Null when no dates exist. */
function defaultAnchor(detail: PlanDetail): YearMonth | null {
  const candidates = [
    detail.instance.plannedStart,
    ...detail.tasks.map((task) => task.startDate),
    ...detail.tasks.map((task) => task.endDate),
  ].filter((value): value is string => Boolean(value));
  if (candidates.length === 0) return null;
  const earliest = [...candidates].sort()[0];
  const parsed = parseDateOnly(earliest);
  if (!parsed) return null;
  return { year: parsed.year, month: parsed.month };
}

function taskCoversDay(task: PlanTask, iso: string): boolean {
  if (task.startDate && task.endDate) return iso >= task.startDate && iso <= task.endDate;
  if (task.startDate) return iso === task.startDate;
  if (task.endDate) return iso === task.endDate;
  return false;
}

function cellIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * IPI-1074 · PLANS-001 — read-only month calendar. Dates are YYYY-MM-DD
 * calendar dates compared lexicographically (UTC-safe, no timezone shift).
 * A task appears on every day from startDate through endDate inclusive.
 */
export function PlanCalendar({ detail }: { detail: PlanDetail }) {
  const [anchor, setAnchor] = useState<YearMonth | null>(() => defaultAnchor(detail));

  if (!anchor) {
    return (
      <EmptyState
        heading="No dates scheduled"
        body="This plan has no start or end dates yet, so there is no calendar to show."
        icon={<ChevronLeft aria-hidden />}
      />
    );
  }

  const { year, month } = anchor;
  const leadingBlanks = firstWeekday(year, month);
  const dim = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const target = new Date(Date.UTC(year, month - 1 + delta, 1));
    setAnchor({ year: target.getUTCFullYear(), month: target.getUTCMonth() + 1 });
  }

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <div data-testid="plan-calendar">
      <div className={styles.calendarToolbar}>
        <span className={styles.calendarTitle}>{monthLabel}</span>
        <div className={styles.calendarNav}>
          <button type="button" className={styles.calendarNavButton} aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft size={14} aria-hidden />
          </button>
          <button type="button" className={styles.calendarNavButton} aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
      </div>
      <div className={styles.calendarGrid} role="grid" aria-label={`Tasks for ${monthLabel}`}>
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className={styles.weekday} role="columnheader">
            {weekday}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`blank-${index}`} className={`${styles.dayCell} ${styles.dayCellOut}`} />;
          }
          const iso = cellIso(year, month, day);
          const tasks = detail.tasks.filter((task) => taskCoversDay(task, iso));
          return (
            <div key={iso} className={styles.dayCell} role="gridcell" data-day={iso}>
              <span className={styles.dayNumber}>{day}</span>
              <div className={styles.dayTasks}>
                {tasks.map((task) => (
                  <span key={task.id} className={styles.dayTask} title={task.title}>
                    {task.title}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}