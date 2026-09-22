# ADR 003 — Supabase owns tenant identity

**Status:** Accepted · 2026-08-24
**Context:** `threadId` in the URL is a locator, like a lookbook permalink — not a backstage pass. Live `mastra` RLS is `USING (true)` for the runtime role.

**Decision:**

- Session from Supabase Auth on every Copilot request.
- Org from membership, server-side. Fail closed (401/403).
- Core `resourceId = org:{orgId}:user:{userId}`. Later shared shoots: `org:{orgId}:shoot:{shootId}`.
- Org B + Org A `?thread=` → **403**, no message bodies.
- Tools share one authz helper (user, org, role, resource, approval). No per-tool security folklore.

**Do not:** Trust `threadId` or client-supplied org ids.