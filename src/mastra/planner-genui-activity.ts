import type { A2UIOperation } from "@copilotkit/shared";

export type PlannerGenUIActivity = {
  /** A locator, NOT authorization; the resourceId and thread owner are checked server-side. */
  scopeKey?: string;
  target: "planner-comparison";
  surfaceId: string;
  catalogId: string;
  operations: A2UIOperation[];
};

const GENUI_TARGET = "planner-comparison";
const GENUI_CATALOG_ID = "ipix/planner@1";
export const GENUI_MAX_OPERATIONS = 20;
export const GENUI_MAX_SERIALIZED_BYTES = 64_000;

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Validate the replay contract shared by message history and persisted
 *  metadata: planner target, known catalog, bounded 1.0 operations, a
 *  ConceptComparison root, and no delete/failed content. */
export function normalizePlannerGenUIActivity(
  value: unknown,
): PlannerGenUIActivity | null {
  const row = asRecord(value);
  if (!row || row.target !== GENUI_TARGET) return null;
  const operations = row.operations;
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > GENUI_MAX_OPERATIONS) return null;
  let serialized: string;
  try {
    serialized = JSON.stringify(operations);
  } catch {
    return null;
  }
  if (serialized.length > GENUI_MAX_SERIALIZED_BYTES) return null;
  const ops = operations.filter((op): op is Record<string, unknown> => Boolean(op) && typeof op === "object" && !Array.isArray(op));
  if (ops.length !== operations.length) return null;
  if (!ops.every((op) => op.version === "1.0")) return null;
  const creates = ops.filter((op) => op.createSurface !== undefined);
  if (creates.length !== 1) return null;
  const create = asRecord(creates.at(0)?.createSurface);
  if (!create || typeof create.surfaceId !== "string" || !create.surfaceId) return null;
  if (create.catalogId !== GENUI_CATALOG_ID) return null;
  const selected: Record<string, unknown>[] = [];
  for (const op of ops) {
    const del = op.deleteSurface === undefined ? null : asRecord(op.deleteSurface);
    if (del) {
      if (typeof del.surfaceId !== "string") return null;
      // A cleanup delete for an older surface cannot delete the current card;
      // it also should not be re-applied when rebuilding a fresh manager.
      if (del.surfaceId === create.surfaceId) return null;
      continue;
    }
    if (op.createSurface !== undefined) {
      if (!asRecord(op.createSurface)) return null;
    } else {
      const update = asRecord(op.updateComponents ?? op.updateDataModel);
      // Every appended update must target the single surface being restored.
      if (!update || update.surfaceId !== create.surfaceId) return null;
    }
    selected.push(op);
  }
  const hasRoot = selected.some((op) => {
    const update = asRecord(op.updateComponents);
    if (!update) return false;
    const components = update.components;
    return Array.isArray(components) && components.some((component) => {
      const c = asRecord(component);
      return c !== null && c.id === "root" && c.component === "ConceptComparison";
    });
  });
  if (!hasRoot) return null;
  return {
    ...(typeof row.scopeKey === "string" ? { scopeKey: row.scopeKey } : {}),
    target: GENUI_TARGET,
    surfaceId: create.surfaceId,
    catalogId: create.catalogId,
    operations: selected as unknown as A2UIOperation[],
  };
}
