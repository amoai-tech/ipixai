import type { Pool } from "pg";

/** Atomically replace only the versioned GenUI key on a trusted Mastra thread.
 * The companion DB trigger protects this key from Mastra's whole-metadata writer.
 * Caller must derive resourceId from the authenticated server session.
 */
export async function writePlannerGenUIKey(
  pool: Pick<Pool, "connect">,
  input: {
    threadId: string;
    resourceId: string;
    previous: unknown;
    next: unknown;
  },
): Promise<boolean> {
  const client = await pool.connect();
  let transaction = false;
  try {
    await client.query("BEGIN");
    transaction = true;
    // Fail closed if the migration is not deployed. CAS alone cannot protect
    // this key against @mastra/pg 1.35's ordinary whole-metadata updates.
    const guard = await client.query<{ enabled: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'mastra.mastra_threads'::regclass
          AND tgname = 'preserve_thread_genui_metadata'
          AND tgenabled IN ('O', 'A')
      ) AS enabled`,
    );
    if (guard.rows[0]?.enabled !== true) {
      throw new Error("planner.genui.atomic_guard_unavailable");
    }
    // LOCAL prevents a pooled connection from carrying this flag to another request.
    await client.query("SET LOCAL ipix.genui_atomic_write = '1'");
    const result = await client.query(
      `UPDATE mastra.mastra_threads
        SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb),
          '{ipixGenUI}', $4::jsonb, true),
            "updatedAt" = (now() AT TIME ZONE 'UTC'), "updatedAtZ" = now()
        WHERE id = $1 AND "resourceId" = $2
          AND (metadata -> 'ipixGenUI') IS NOT DISTINCT FROM $3::jsonb
        RETURNING id`,
      [
        input.threadId, input.resourceId,
        input.previous === undefined ? null : JSON.stringify(input.previous),
        JSON.stringify(input.next),
      ],
    );
    await client.query("COMMIT");
    transaction = false;
    return result.rowCount === 1;
  } catch (error) {
    if (transaction) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
