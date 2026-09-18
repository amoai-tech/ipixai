# Data / Supabase

Supabase/Postgres owns durable iPix application truth. RLS and server-derived organization membership protect tenant data. Mastra memory is stored separately in the private `mastra` schema.

| Need | Current source |
|---|---|
| Product boundary | [Product requirements](../prd.md) |
| Forward-only migration contract | [IPI-1040 runbook](../supabase/ipi-1040-forward-migrations.md) |
| Schema reconciliation / recovery | [IPI-1161 runbook](../supabase/ipi-1161-reconciliation-deployment.md) |
| Documentation audit | [Docs inventory](../DOCS-INDEX.md) |
| Live task status | [Linear v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues) |

## Rules

- Supabase/Postgres owns brands, shoots, assets, CRM, bookings, approvals, and planning records.
- The server derives the trusted organization from authenticated membership; browser-selected IDs are hints, not authorization.
- RLS is defense in depth; grants and RPC authorization still matter.
- Repository migrations own durable schema changes. Do not use documentation snapshots as executable migrations.
- `mastra.*` owns AI memory/runtime state; domain tables own product truth.
- Documentation work must not mutate production data.

Historical Supabase audits remain in Git and are indexed in [DOCS-INDEX.md](../DOCS-INDEX.md), but they are not current architecture authority.
