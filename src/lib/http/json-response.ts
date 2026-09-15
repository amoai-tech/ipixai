/**
 * Minimal JSON error response shared by authenticated API routes.
 * Keeps the `{ error, reason }` shape consistent and DRY.
 */
export function jsonError(status: number, error: string, reason: string): Response {
  return new Response(JSON.stringify({ error, reason }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
