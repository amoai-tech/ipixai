/**
 * IPI-1233 · PLAN-CARD-001 — a client-safe, defensive view of a completed
 * `composeShootPlan` result.
 *
 * The canonical `ShootPlan` is a Mastra tool schema (`@/mastra/tools/plan-schema`);
 * importing it here would pull `@mastra/core/tools` into the browser bundle for a
 * component that only ever receives the tool's already-computed JSON result.
 * Mirrors the same defensive-projection pattern as
 * `shoot-plan-review-view.ts::describeShootPlanReview` — tolerate unknown
 * shapes, never throw, never invent a field the real result didn't provide.
 */

export type ProductionPlanCardShot = {
  shotNumber: number;
  description: string;
  angle: string | null;
};

export type ProductionPlanCardDeliverable = {
  channel: string;
  format: string;
  quantity: number;
};

export type ProductionPlanCardView = {
  status: "complete" | "needs_input";
  objective: string | null;
  channels: string[];
  shots: ProductionPlanCardShot[];
  totalShots: number | null;
  deliverables: ProductionPlanCardDeliverable[];
  /** Always `deliverablesResult.totalAssets` — never `deliverables.length`
   *  (a quantity-weighted asset count, not a row count). */
  totalAssets: number | null;
  missingInputs: string[];
  warnings: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function scalar(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const text = scalar(entry);
    if (text) out.push(text);
  }
  return out;
}

/** A `PlanField<T>` ({ status, value }) — only `confirmed`/`assumed` carry a value. */
function planFieldValue(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return null;
  if (record.status === "needs_input") return null;
  return scalar(record.value);
}

/**
 * Projects an unknown `composeShootPlan` result into the card's view model, or
 * `null` when the value isn't shaped like a `ShootPlan` at all (malformed/
 * unreadable tool result) — the renderer falls back to a safe message rather
 * than crash the chat on `null`.
 */
export function describeProductionPlanCard(plan: unknown): ProductionPlanCardView | null {
  const root = asRecord(plan);
  if (!root) return null;
  const status = root.status;
  if (status !== "complete" && status !== "needs_input") return null;

  const channels = Array.isArray(root.channels)
    ? root.channels.map((entry) => scalar(entry)).filter((entry): entry is string => Boolean(entry))
    : [];

  const shotListResult = asRecord(root.shotListResult);
  const shotRows = Array.isArray(shotListResult?.shots) ? shotListResult.shots : [];
  const shots: ProductionPlanCardShot[] = shotRows
    .map((entry, index) => {
      const record = asRecord(entry) ?? {};
      const description = scalar(record.description) ?? "";
      return {
        shotNumber: typeof record.shotNumber === "number" ? record.shotNumber : index + 1,
        description,
        angle: scalar(record.angle),
      };
    })
    .filter((shot) => shot.description.length > 0);
  const totalShots = typeof shotListResult?.totalShots === "number" ? shotListResult.totalShots : null;

  const deliverablesResult = asRecord(root.deliverablesResult);
  const deliverableRows = Array.isArray(deliverablesResult?.deliverables)
    ? deliverablesResult.deliverables
    : [];
  const deliverables: ProductionPlanCardDeliverable[] = deliverableRows
    .map((entry) => {
      const record = asRecord(entry) ?? {};
      return {
        channel: scalar(record.channel) ?? "",
        format: scalar(record.format) ?? "",
        quantity: typeof record.quantity === "number" ? record.quantity : 0,
      };
    })
    .filter((row) => row.channel.length > 0 && row.format.length > 0);
  // Required: the displayed count is the canonical quantity-weighted total,
  // never `deliverables.length` (a row count) — omitted entirely when the
  // real tool result doesn't carry it, rather than falling back to a count
  // that would silently misrepresent asset quantity as row count.
  const totalAssets =
    typeof deliverablesResult?.totalAssets === "number" ? deliverablesResult.totalAssets : null;

  return {
    status,
    objective: planFieldValue(root.objective),
    channels,
    shots,
    totalShots,
    deliverables,
    totalAssets,
    missingInputs: stringList(root.missingInputs),
    warnings: stringList(root.warnings),
  };
}
