/**
 * IPI-1067 · SHOOT-001 — pure display formatting for the shoot detail
 * payload. Server-safe; no React, no I/O — unit-testable in isolation.
 */

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

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "Sep 12 – 14, 2026" · "Sep 12, 2026" · "Not scheduled" (null/empty). */
export function formatDateRange(start: string | null, end: string | null): string {
  const startDate = start ? parseDate(start) : null;
  const endDate = end ? parseDate(end) : null;
  if (!startDate && !endDate) return "Not scheduled";
  if (startDate && endDate) {
    if (startDate.getTime() === endDate.getTime()) return formatDay(startDate);
    if (
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth()
    ) {
      return `${MONTHS[startDate.getMonth()]} ${startDate.getDate()} – ${endDate.getDate()}, ${endDate.getFullYear()}`;
    }
    return `${formatDay(startDate)} – ${formatDay(endDate)}`;
  }
  return formatDay(startDate ?? endDate!);
}

/** "$12,500" · "€3,200" · "Not set" (null amount). */
export function formatBudget(amount: number | null, currency: string | null): string {
  if (amount === null) return "Not set";
  const code = (currency ?? "USD").toUpperCase();
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(amount);
  return formatted;
}

/** "IG · TikTok" · "No channels" (null/empty). */
export function formatChannelList(channels: string[] | null): string {
  if (!channels || channels.length === 0) return "No channels";
  return channels.join(" · ");
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