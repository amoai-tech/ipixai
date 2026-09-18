/**
 * IPI-1084 · APPROVAL-001 — a client-safe, defensive view of a stored ShootPlan.
 *
 * The canonical `ShootPlan` is a Mastra tool schema; importing it into a client
 * component would pull the tool runtime into the browser bundle. The stored
 * revision is jsonb, so the review surface reads it through this pure
 * projection instead, which tolerates unknown shapes and never throws.
 */

export type PlanReviewField = { label: string; value: string };

export type PlanReviewSection = {
  id: string;
  title: string;
  fields: PlanReviewField[];
};

export type PlanReviewReference = {
  referenceId: string;
  angle: string | null;
};

export type ShootPlanReviewView = {
  objective: string | null;
  mediaType: string | null;
  status: string | null;
  missingInputs: string[];
  references: PlanReviewReference[];
  shotCount: number;
  sections: PlanReviewSection[];
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
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

/** Formats a `PlanField<T>` ({ value, status }) or a bare scalar. */
function fieldText(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return scalar(value);
  const inner = scalar(record.value);
  if (!inner) return null;
  const status = scalar(record.status);
  if (!status || status === "confirmed") return inner;
  return `${inner} — ${status.replace(/_/g, " ")}`;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    const text = record ? fieldText(record) ?? scalar(record.statement) : scalar(entry);
    if (text) out.push(text);
  }
  return out;
}

function section(id: string, title: string, fields: PlanReviewField[]): PlanReviewSection | null {
  const present = fields.filter((entry) => entry.value.length > 0);
  return present.length > 0 ? { id, title, fields: present } : null;
}

function simpleSection(
  id: string,
  title: string,
  plan: Record<string, unknown>,
  keys: { key: string; label: string }[],
): PlanReviewSection | null {
  return section(
    id,
    title,
    keys.map(({ key, label }) => ({ label, value: fieldText(plan[key]) ?? "" })),
  );
}

export function describeShootPlanReview(plan: unknown): ShootPlanReviewView {
  const root = asRecord(plan) ?? {};

  const references: PlanReviewReference[] = [];
  const used = Array.isArray(root.referencesUsed) ? root.referencesUsed : [];
  for (const entry of used) {
    const record = asRecord(entry);
    const referenceId = scalar(record?.id);
    if (referenceId) references.push({ referenceId, angle: scalar(record?.angle) });
  }

  const shotList = asRecord(root.shotListResult);
  const shots = Array.isArray(shotList?.shots) ? shotList.shots : [];

  const deliverables = asRecord(root.deliverablesResult);
  const deliverableRows = Array.isArray(deliverables?.deliverables) ? deliverables.deliverables : [];

  const budget = asRecord(root.budgetResult);

  const channels = Array.isArray(root.channels)
    ? root.channels.map((entry) => fieldText(entry) ?? scalar(entry)).filter((v): v is string => Boolean(v))
    : [];

  const sections = [
    section("channels", "Channels", [
      { label: "Target channels", value: channels.join(", ") },
    ]),
    simpleSection("production", "Production", root, [
      { key: "location", label: "Location" },
      { key: "lighting", label: "Lighting" },
      { key: "setBackground", label: "Set / background" },
      { key: "talent", label: "Talent" },
      { key: "crew", label: "Crew" },
      { key: "studio", label: "Studio" },
      { key: "equipment", label: "Equipment" },
      { key: "schedule", label: "Schedule" },
      { key: "campaignContext", label: "Campaign context" },
    ]),
    section(
      "deliverables",
      "Deliverables",
      deliverableRows.map((entry, index) => {
        const record = asRecord(entry) ?? {};
        const channel = scalar(record.channel) ?? "channel";
        const format = scalar(record.format) ?? "format";
        const quantity = scalar(record.quantity) ?? "1";
        return { label: `Deliverable ${index + 1}`, value: `${channel} · ${format} × ${quantity}` };
      }),
    ),
    section(
      "shots",
      "Shots",
      shots.map((entry, index) => {
        const record = asRecord(entry) ?? {};
        const number = scalar(record.shotNumber) ?? String(index + 1);
        const description = scalar(record.description) ?? "";
        const angle = scalar(record.angle);
        return {
          label: `Shot ${number}`,
          value: [description, angle ? `[${angle}]` : null].filter(Boolean).join(" "),
        };
      }),
    ),
    section(
      "budget",
      "Budget",
      budget
        ? Object.entries(budget)
            .map(([key, value]) => {
              const text = scalar(value) ?? fieldText(value);
              return { label: key.replace(/([a-z])([A-Z])/g, "$1 $2"), value: text ?? "" };
            })
            .slice(0, 12)
        : [],
    ),
    section(
      "references",
      "References",
      references.map((entry, index) => ({
        label: `Reference ${index + 1}`,
        value: entry.angle ? `${entry.referenceId} — ${entry.angle}` : entry.referenceId,
      })),
    ),
    section(
      "risks",
      "Risks",
      stringList(root.risks).map((value, index) => ({ label: `Risk ${index + 1}`, value })),
    ),
    section(
      "assumptions",
      "Assumptions",
      stringList(root.assumptions).map((value, index) => ({ label: `Assumption ${index + 1}`, value })),
    ),
    section(
      "warnings",
      "Warnings",
      stringList(root.warnings).map((value, index) => ({ label: `Warning ${index + 1}`, value })),
    ),
  ].filter((entry): entry is PlanReviewSection => entry !== null);

  return {
    objective: fieldText(root.objective),
    mediaType: fieldText(root.mediaType),
    status: scalar(root.status),
    missingInputs: stringList(root.missingInputs),
    references,
    shotCount: shots.length,
    sections,
  };
}

/**
 * The first target channel of the plan, used for reference compatibility
 * scoring. Falls back to shopify when the plan carries no readable channel.
 */
export function primaryDeliverableChannel(plan: unknown): string {
  const root = asRecord(plan);
  const channels = Array.isArray(root?.channels) ? root.channels : [];
  for (const entry of channels) {
    const text = fieldText(entry) ?? scalar(entry);
    if (text) return text.split(/[\s·—]+/)[0];
  }
  return "shopify";
}

/**
 * Applies a review-state reference choice to a copy of the plan. This is a local
 * edit only: it changes no Shoot, and it is what makes the caller stage a new
 * revision before any decision can be recorded.
 */
export function applyReferenceSelection(
  plan: unknown,
  from: string,
  to: string,
): Record<string, unknown> {
  const root = { ...(asRecord(plan) ?? {}) };

  const replaceIn = (list: unknown): unknown[] => {
    if (!Array.isArray(list)) return [];
    return list.map((entry) => {
      const record = asRecord(entry);
      if (!record) return entry;
      return record.id === from ? { ...record, id: to } : { ...record };
    });
  };
  root.referencesUsed = replaceIn(root.referencesUsed);

  const shotList = asRecord(root.shotListResult);
  if (shotList && Array.isArray(shotList.shots)) {
    root.shotListResult = {
      ...shotList,
      shots: shotList.shots.map((entry) => {
        const record = asRecord(entry);
        if (!record) return entry;
        return record.referenceId === from ? { ...record, referenceId: to } : { ...record };
      }),
    };
  }

  return root;
}
