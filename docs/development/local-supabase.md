# Local Supabase and isolated database testing

**Current iPix path (IPI-1374):** The normal local CLI runs through `npm run supabase:cli`, which supplies only the required dotenvx private keys to the CLI, without exposing application credentials to the calling agent. The old plain `supabase start` / encrypted `.env.local` parse failure (`failed to parse config: missing private key`) is a **resolved local wrapper issue**, not a reason to copy a project or delete/decrypt secrets. See the Supabase safety section of [AGENTS.md](../../AGENTS.md), plus `scripts/` and `package.json` for the installed wrapper.

## Standard local workflow

1. Inspect the live Linear task, current `origin/main`, installed Supabase CLI and actual project/role. Use a verified local-only target; check worktree/port/container ownership before any write.
2. Check `command -v supabase` and `supabase --version` before local proof: the `supabase-fresh-replay` CI job pins **2.116.0**, but the local `supabase:cli` wrapper invokes the binary from PATH and does not enforce that version. Confirm CLI compatibility with the CI baseline, then use `npm run supabase:cli -- start`. Use `npm run supabase:cli -- db reset --local` **only with task authorization and verified disposable local data**; this discards local DB contents. Do **not** run `supabase db push` against production.
3. If wrapper/config fails, STOP and report the exact error. Do not delete `.env.local`, reveal `.env.keys`, or fall back to a different database without verified and approved proof isolation. CI `supabase-fresh-replay` independently tests a fresh stack.

**Reference — REFERENCE ONLY:** https://supabase.com/docs/guides/local-development/cli/getting-started — verify CLI behavior and avoid applying destructive reset steps to hosted/production data.

## Independent local Supabase stack (only if isolation is required)

When a task explicitly requires a **separate** local Supabase instance, a copied `supabase/` directory is only a starting point, **not** proof of isolation. Choose a **unique local `project_id`** and **unused ports** for API, database, shadow DB, Studio, mail and every enabled service. Inspect listeners (`ss -ltn`), containers (`docker ps -a`) and volumes (`docker volume ls`); prove no project ID, port, container, volume or DB state is shared with another worktree. **STOP unless isolation** and ownership are established. Never stop, reuse, reset or delete another worktree's containers or data. The supported wrapper remains the standard path; do not revive the old dotenvx workaround as the default.

The experimental parallel-stack command requires CLI 2.119.0 or later. CI pins 2.116.0, but the local CLI version is environment-dependent; check `supabase --version` before relying on version-sensitive commands. Do not assume `supabase stack` is available or upgrade tooling for this proof.

**Reference — REFERENCE ONLY:** https://supabase.com/docs/guides/local-development/running-multiple-local-projects — verify version-specific support without replacing iPix scripts.

## Isolated Mastra/Postgres-only proof

Use an approved disposable Postgres on `127.0.0.1` (allowlisted in `src/mastra/pg-store.ts`) with independently verified container/database ownership. Before migrations, create the `anon`, `authenticated` and `service_role` NOLOGIN roles and the restricted login role as shown in the `Provision the pinned mastra schema and the runtime role` step of the [existing `mem-001-restart-history` CI job](../../.github/workflows/ci.yml). These are local-only provisioning steps; **never** create or modify roles on hosted production.

Apply the repo's pinned Mastra migrations **in timestamp order**: `20260722093028_mastra_schema_pinned_1_12_0` → `20260722094055_mastra_runtime_grants_and_rls` → `20260822070000_ipi1008_mastra_workflow_definitions` → `20260927194500_ipi1332_mastra_1_71_schema_delta` → `20261110000000_ipi1385_mastra_1_82_run_fencing` → `20261119000000_ipi1460_mastra_184_compat`. The grants/RLS migration expects the roles and core tables; the delta requires prior RLS state. Do not skip prerequisites or silently substitute a new database provider.

### Mastra 1.84 workflow-run journal (IPI-1460)

`20261119000000_ipi1460_mastra_184_compat` adds `mastra.mastra_workflow_runs` and `mastra.mastra_workflow_run_entries`, copied from the installed `@mastra/pg` 1.37.0 `exportSchemas("mastra")` output and the `@mastra/core` 1.84.0 run-journal table config:

- `mastra_workflow_runs` — run header, `lastSeq`/`stateSeq` cursors, state byte counters, `runToken`, plus the `createdAtZ` / `updatedAtZ` timestamp mirrors maintained by the reused `mastra.trigger_set_timestamps()` trigger. Primary key `(workflow_name, run_id)`.
- `mastra_workflow_run_entries` — append-only step/state journal. Primary key `(workflow_name, run_id, seq)`.
- Five reviewed indexes: run name/created-at, run name/status/created-at, run thread id, entry step lookup, and the partial `state-base` expression index.

**Why the tables are required even with v2 storage disabled.** The 1.84 packages ship these tables as part of the normal workflow-storage schema, not as an opt-in v2 feature. iPix runs the adapter with `schemaName: "mastra"` and `disableInit: true`, so the database schema is owned by reviewed migrations instead of process-start DDL. The journal tables must exist before the 1.84 runtime is deployed; `storageVersion: 2` and `autoStorageVersion` stay at their 1.82 values, so this is a schema prerequisite, not a storage-format upgrade. Under that v1 configuration these tables are read by `getWorkflowRunById()` but not written, so they do not grow with normal runs; retention of the v1 `mastra_workflow_snapshot` table remains the existing (unchanged) operational decision.

**Runtime-role permissions.** Both tables enable RLS and carry the existing `hyperdrive_mastra_runtime_all` policy scoped to `hyperdrive_mastra_runtime`. Only that dedicated role receives `SELECT, INSERT, UPDATE, DELETE`; `anon`, `authenticated` and `service_role` receive no grants, and no `public.mastra_*` shadow table is created. Verify as the runtime role (or locally with `SET LOCAL ROLE hyperdrive_mastra_runtime` when the cluster role is `NOLOGIN`) and confirm the PostgREST roles are denied. The `mem-001-restart-history` CI job runs the same DML check after replaying the migration order above.

**Real business-workflow proof.** `tests/ipi1460-business-workflows.real-pg.test.ts` is opt-in and skipped by `npm test`. Run it with `node scripts/run-ipi1460-business-pg.mjs`: the runner refuses non-loopback targets, requires the disposable Mastra database (default `ipi1460_b1_20261119`) to already carry the reviewed tables, seeds the IPI-1460 fixture namespace, and removes it afterwards. The suite drives the committed `shoot-plan-review` and `brand-intelligence` workflows across a new pool + Mastra instance (so resume must load from PostgreSQL), uses the real approval RPCs and tenant authorization, and refuses a superseded revision both at decision time and at resume time.

**Deployment ordering and rollback.** Apply this additive migration before deploying Mastra 1.84 code. The migration does not alter any existing table, column, index, policy or grant, and Mastra 1.82 code does not reference the new tables, so the safe rollback is to leave the empty tables in place; dropping `mastra.mastra_workflow_run_entries` then `mastra.mastra_workflow_runs` is the manual cleanup path only after 1.84 code is no longer running.

This scoped troubleshooting reference does not authorize production writes, paid QA or account changes.
