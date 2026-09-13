# iPix PR Review Guidelines

Use `AGENTS.md` as the repository-wide contract. Exact-head CI remains authoritative.

## Stack checks
- CopilotKit: verify current v2 runtime and AG-UI behavior against installed packages and official docs.
- Mastra: verify tools, memory scope, workflows, persistence, HITL, retries, and cancellation against installed packages.
- Supabase: verify schema, policies, grants, RPC behavior, migrations, and generated types.
- pgvector: verify dimensions, distance operator, index strategy, filters, and query plan when vector SQL changes.
- Cloudinary: verify server-side signing, provider identity, webhook handling, transformations, and durable asset mapping.
- Stripe: apply only when active payment code exists; verify SDK/API version, webhook handling, idempotency, and test/live separation.
