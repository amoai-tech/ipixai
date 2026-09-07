/**
 * IPI-1067 · SHOOT-001 — pure display formatting for the shoot detail
 * payload. Server-safe; no React, no I/O — unit-testable in isolation.
 */

import { channelLabel } from "@/lib/shoot/shoot-list-filters";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Date-only values ("2026-09-12") are calendar dates, not instants:
 *  parsing them with `new Date(value)` anchors them at UTC midnight, and
 *  reading them with local-timezone getters shifts the day in deployments
 *  west of UTC. Parse the components explicitly and anchor at UTC so the
 *  rendered calendar date is the stored one. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(value: string): Date | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    // Round-trip check rejects impossible calendar dates (Feb 30, Apr 31…)
    // instead of letting Date.UTC roll them over.
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** "Sep 12 – 14, 2026" · "Sep 12, 2026" · "Not scheduled" (null/empty). */
export function formatDateRange(start: string | null, end: string | null): string {
  const startDate = start ? parseDate(start) : null;
  const endDate = end ? parseDate(end) : null;
  if (!startDate && !endDate) return "Not scheduled";
  if (startDate && endDate) {
    if (startDate.getTime() === endDate.getTime()) return formatDay(startDate);
    if (
      startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
      startDate.getUTCMonth() === endDate.getUTCMonth()
    ) {
      return `${MONTHS[startDate.getUTCMonth()]} ${startDate.getUTCDate()} – ${endDate.getUTCDate()}, ${endDate.getUTCFullYear()}`;
    }
    return `${formatDay(startDate)} – ${formatDay(endDate)}`;
  }
  return formatDay(startDate ?? endDate!);
}

/** "$12,500" · "€3,200" · "Not set" (null amount). Malformed currency
 *  codes fall back to USD instead of throwing a RangeError. */
export function formatBudget(amount: number | null, currency: string | null): string {
  if (amount === null) return "Not set";
  const code = currency ?? "USD";
  const safeCode = /^[A-Z]{3}$/.test(code) ? code : "USD";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: safeCode,
    maximumFractionDigits: 0,
  }).format(amount);
  return formatted;
}

/** "IG · TikTok" · "No channels" (null/empty). */
export function formatChannelList(channels: string[] | null): string {
  if (!channels || channels.length === 0) return "No channels";
  return channels.map((channel) => channelLabel(channel)).join(" · ");
}

/** "82" · "Not scored" (null). */
export function formatDnaScore(score: number | null): string {
  return score === null ? "Not scored" : String(Math.round(score));
}

/** "3 shots" · "1 shot" · "No shots yet". */
export function formatCountLabel(count: number, noun: string): string {
  if (count === 0) return `No ${noun}s yet`;
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}