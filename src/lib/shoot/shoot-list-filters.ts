/**
 * IPI-1067 · SHOOT-001 — pure shoot display vocabulary.
 *
 * Maps the live `shoot` schema enums (confirmed on project
 * nvdlhrodvevgwdsneplk, 2026-09-06) to human labels and StatusChip dot
 * tokens. No Supabase, no React — callers (list workspace, detail
 * workspace, cards) resolve display strings here so the enum → token
 * mapping lives in exactly one place.
 *
 * Dot tokens reference the existing `--status-*` tokens in
 * src/styles/tokens.css (planning/active/post/complete/archived), which
 * already match the shoot_status enum 1:1.
 */

export const SHOOT_STATUS_ORDER = [
  "planning",
  "active",
  "post_production",
  "complete",
  "archived",
] as const;

export type ShootStatus = (typeof SHOOT_STATUS_ORDER)[number];

export const SHOOT_STATUS_LABELS: Record<ShootStatus, string> = {
  planning: "Planning",
  active: "Active",
  post_production: "Post-production",
  complete: "Complete",
  archived: "Archived",
};

export const SHOOT_STATUS_DOT_TOKENS: Record<ShootStatus, string> = {
  planning: "var(--status-planning-text)",
  active: "var(--status-active-text)",
  post_production: "var(--status-post-text)",
  complete: "var(--status-complete-text)",
  archived: "var(--status-archived-text)",
};

export function shootStatusLabel(status: string | null | undefined): string {
  if (status && status in SHOOT_STATUS_LABELS) return SHOOT_STATUS_LABELS[status as ShootStatus];
  return "Unknown";
}

export function shootStatusDotToken(status: string | null | undefined): string {
  if (status && status in SHOOT_STATUS_DOT_TOKENS) {
    return SHOOT_STATUS_DOT_TOKENS[status as ShootStatus];
  }
  return "var(--color-text-muted)";
}

/**
 * Child-record statuses are their own contracts — do NOT reuse the shoot
 * vocabulary for them. `shoot.shot_status` enum: pending / captured /
 * approved (live DB, 2026-09-06). Dot tokens reuse the existing
 * `--status-*` palette by lifecycle stage.
 */
export const SHOT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  captured: "Captured",
  approved: "Approved",
};

export const SHOT_STATUS_DOT_TOKENS: Record<string, string> = {
  pending: "var(--status-planning-text)",
  captured: "var(--status-active-text)",
  approved: "var(--status-complete-text)",
};

export function shotStatusLabel(status: string | null | undefined): string {
  if (status && status in SHOT_STATUS_LABELS) return SHOT_STATUS_LABELS[status];
  return "Unknown";
}

export function shotStatusDotToken(status: string | null | undefined): string {
  if (status && status in SHOT_STATUS_DOT_TOKENS) return SHOT_STATUS_DOT_TOKENS[status];
  return "var(--color-text-muted)";
}

/** `shoot.shoot_deliverables.status` CHECK constraint: planned / covered /
 *  delivered (live DB, 2026-09-06). */
export const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  covered: "Covered",
  delivered: "Delivered",
};

export const DELIVERABLE_STATUS_DOT_TOKENS: Record<string, string> = {
  planned: "var(--status-planning-text)",
  covered: "var(--status-active-text)",
  delivered: "var(--status-complete-text)",
};

export function deliverableStatusLabel(status: string | null | undefined): string {
  if (status && status in DELIVERABLE_STATUS_LABELS) return DELIVERABLE_STATUS_LABELS[status];
  return "Unknown";
}

export function deliverableStatusDotToken(status: string | null | undefined): string {
  if (status && status in DELIVERABLE_STATUS_DOT_TOKENS) {
    return DELIVERABLE_STATUS_DOT_TOKENS[status];
  }
  return "var(--color-text-muted)";
}

export const SHOOT_TYPE_LABELS: Record<string, string> = {
  lifestyle_beach: "Lifestyle · Beach",
  lifestyle_city: "Lifestyle · City",
  lifestyle_interior: "Lifestyle · Interior",
  studio_white: "Studio · White",
  studio_ecommerce: "Studio · E-commerce",
  editorial_vogue: "Editorial · Vogue",
  editorial_campaign: "Editorial · Campaign",
  video_motion: "Video · Motion",
};

export function shootTypeLabel(type: string | null | undefined): string {
  if (type && type in SHOOT_TYPE_LABELS) return SHOOT_TYPE_LABELS[type];
  return "Shoot";
}

export const CHANNEL_LABELS: Record<string, string> = {
  instagram_feed: "IG",
  instagram_story: "IG Story",
  instagram_reel: "IG Reel",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  amazon: "Amazon",
  shopify: "Shopify",
  facebook: "Facebook",
  youtube: "YouTube",
  website: "Website",
};

export function channelLabel(channel: string | null | undefined): string {
  if (channel && channel in CHANNEL_LABELS) return CHANNEL_LABELS[channel];
  return channel ?? "No channel";
}

/** Pure status filter for the browse list — `"all"` returns a copy. */
export function filterShootsByStatus<T extends { status: string | null }>(
  shoots: readonly T[],
  status: ShootStatus | "all",
): T[] {
  if (status === "all") return [...shoots];
  return shoots.filter((shoot) => shoot.status === status);
}

export function shootCountLabel(count: number): string {
  return `${count} ${count === 1 ? "shoot" : "shoots"}`;
}