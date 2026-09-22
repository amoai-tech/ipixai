import { isDatabaseUuid } from "@/lib/database-uuid";

export type SaveApprovedShootRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export type SaveApprovedShootResult =
  | { ok: true; shootId: string; replayed: boolean }
  | { ok: false; code: string };

const KNOWN_FAILURES = new Set([
  "UNAUTHENTICATED",
  "INVALID_INPUT",
  "NOT_FOUND",
  "FORBIDDEN",
  "HASH_MISMATCH",
  "NOT_APPROVED",
  "SUPERSEDED_REVISION",
  "INVALID_PLAN",
]);

export async function saveApprovedShoot(
  approvalId: string,
  deps: { rpc: SaveApprovedShootRpc },
): Promise<SaveApprovedShootResult> {
  if (!isDatabaseUuid(approvalId)) return { ok: false, code: "INVALID_INPUT" };

  let data: unknown;
  try {
    const response = await deps.rpc("save_approved_shoot", { p_approval_id: approvalId });
    if (response.error) return { ok: false, code: "SAVE_FAILED" };
    data = response.data;
  } catch {
    return { ok: false, code: "SAVE_FAILED" };
  }

  if (typeof data !== "object" || data === null) return { ok: false, code: "SAVE_FAILED" };
  const row = data as Record<string, unknown>;
  if (row.ok === true && typeof row.shootId === "string" && isDatabaseUuid(row.shootId)) {
    return { ok: true, shootId: row.shootId, replayed: row.replayed === true };
  }
  if (row.ok === false && typeof row.code === "string" && KNOWN_FAILURES.has(row.code)) {
    return { ok: false, code: row.code };
  }
  return { ok: false, code: "SAVE_FAILED" };
}
