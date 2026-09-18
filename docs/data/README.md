# Data / Supabase

Supabase/Postgres owns durable iPix application truth. RLS and server-derived organization membership protect tenant data. Mastra runtime memory is stored separately in the private `mastra` schema.

| Need | Current source |
|---|---|
| Product boundary | [Product requirements](../prd.md) |
| Forward-only migration contract | [IPI-1040 runbook](../supabase/ipi-1040-forward-migrations.md) |
| Schema reconciliation / recovery | [IPI-1161 runbook](../supabase/ipi-1161-reconciliation-deployment.md) |
| Mastra Postgres contract | [DB-001 matrix](../mastra/db-001-matrix.md) |
| Live task status | [Linear v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues) |
| Historical data audits | [archive/data/](../archive/data/) |

## Rules

- Supabase/Postgres owns brands, shoots, assets, CRM, bookings, approvals, and planning records.
- The server derives the trusted organization from authenticated membership; browser-selected IDs are hints, not authorization.
- RLS is defense in depth; grants and RPC authorization still matter.
- Repository migrations own durable schema changes. Documentation snapshots are never executable migrations.
- `mastra.*` owns AI runtime state; domain tables own product truth.
- Current task sequencing belongs in Linear, not in a Markdown todo/roadmap copy.
