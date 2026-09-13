/** IPI-1200 clean-control fixture: intentionally simple and safe. */
export function normalizeReviewLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}
