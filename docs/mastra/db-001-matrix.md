# DB-001 — Mastra Postgres schema contract

**Ticket:** [IPI-1043 · DB-001 — Prove Mastra Can Use the iPix Postgres Schema Safely](https://linear.app/amo100/issue/IPI-1043/ipi-1043-db-001-prove-mastra-can-use-the-ipix-postgres-schema-safely)

---

## Recertification 2026-09-01 (`@mastra/pg@1.22.2`)

**Git SSOT:** `origin/main` `615877b69892ae9ccc111af963ce026a7fff87d0` — **IPI-1042 · RUNTIME-001 — Pin ipixai to the Mastra 1.63.2 family** (PR #25).

The 2026-08-25 matrix below was written against `@mastra/pg@1.12.1` / `@mastra/core@1.41.0`. That pin is **stale**. Installed contract after PR #25:

| Package | Installed |
|---------|-----------|
| `@mastra/pg` | `1.22.2` |
| `@mastra/core` | `1.63.2` |
| `@mastra/memory` | `1.28.1` |
| `@mastra/libsql` | `1.22.2` |

Constructor still proven from `node_modules/@mastra/pg/dist/shared/config.d.ts`: required `id`; `schemaName?` (runtime default remains **`public`**); `disableInit?`; injected `pool` via `PoolInstanceConfig`. Live code on this SHA already wires that in `src/mastra/pg-store.ts` (`schemaName: "mastra"`, `disableInit: true`, singleton `pg.Pool`). This recertification does **not** construct a store or call `init()`.

### Catalogs this run (read-only SELECT / `list_tables`)

| Env | Result |
|-----|--------|
| Hosted fashionos `nvdlhrodvevgwdsneplk` | **34** `mastra.*` tables. **Zero** `public.mastra_*`. Required core memory columns and indexes **MATCH** `TABLE_SCHEMAS` from `@mastra/core@1.63.2`. Additive `*Z` columns remain **CHANGE** (below). Row counts: threads 45, messages 103, snapshots 6140, resources 0. |
| Hosted planner-staging `wtuhdynujhszsbwxlbdi` | **34** `mastra.*` (empty Core rows) **plus leftover `public.mastra_*` shadows** (almost all 0 rows; `public.mastra_workflow_snapshot` has 1). Staging shadows are **not** the runtime target. |
| Local Docker `127.0.0.1:54342` | **NOT VERIFIED this run** (no listener). 2026-08-25 probe still the last local fingerprint. |

### `TABLE_SCHEMAS` grew 35 → 44 names

**MISSING** on iPix `mastra` vs `@mastra/core@1.63.2` (not Core memory blockers with `disableInit: true`):

`mastra_notifications`, `mastra_traces`, `mastra_tool_provider_connections`, `mastra_thread_state`, `mastra_harness_sessions`, `mastra_knowledge_activity`, `mastra_knowledge_cursors`, `mastra_knowledge_mentions`, `mastra_knowledge_nodes`, `mastra_knowledge_records`, `mastra_knowledge_semantic_outbox`.

**EXTRA:** `mastra_observational_memory` (still not in Core `TABLE_SCHEMAS`).

**MATCH (load-bearing memory):** `mastra_threads`, `mastra_messages`, `mastra_resources`, `mastra_workflow_snapshot` required columns + PKs + `(resourceId, createdAt DESC)` / `(thread_id, createdAt DESC)` indexes. Snapshot uniqueness still named `public_mastra_workflow_snapshot_workflow_name_run_id_key` (**CHANGE** name, **MATCH** columns). Additive `*Z` timestamptz columns remain **CHANGE**.

### `public.mastra_*` investigation

Fashionos production catalog has **no** `public.mastra_*`. Planner-staging still has a full shadow set. Installed PostgresStore with `schemaName: "mastra"` qualifies `mastra.mastra_*` and does **not** need `public.mastra_*`. Do not GRANT `mastra` to `anon`. Do not point hosted iPixai at staging `public`.

### Recert verdict

**GO for local PG-001 shipped code path and 2026-08-25 fingerprint** (already shipped in **IPI-1044 · PG-001 — Make iPix AI Conversations Survive Server Restarts** on this SHA). Current local recertification on `@mastra/pg@1.22.2` is **UNVERIFIED** (no Docker probe this run). **GO for hosted `mastra.*` column contract** on fashionos. **NO-GO for hosted writes** until **IPI-1124 · MASTRA-HOST-PG-001 — Run Mastra Memory on Shared Supabase Postgres in Hosted iPix** (allowlist, pooler, least-privilege role, fail-closed — not this ticket).

Historical 1.12.1 write-up is preserved below as the original PR #7 evidence.

---

**Original date:** 2026-08-25  
**Original Git SSOT:** `origin/main` `054da4eed3eaffc988aae9325a1c3a4e069c95fd` — **IPI-1042 · RUNTIME-001 — Pin `@mastra/pg` 1.12.1 so it loads with Core 1.41.0** (merge of PR #6). Dirty `/home/sk/ipixai` is not SSOT.

This file is the **MATCH / CHANGE / MISSING** contract. It does **not** wire `PostgresStore`, call `init()`, or write Postgres.

---

## Verdict (plain English)

Think of Mastra storage as a filing cabinet labeled `mastra`, not the default public drawer. Installed `@mastra/pg` will use **`public` unless you pass `schemaName`**. iPix already keeps threads, messages, resources, and workflow snapshots in schema **`mastra`**. Those four Core tables exist locally and on hosted with every **required** column from installed `@mastra/core` `TABLE_SCHEMAS`. Extra `*Z` timestamp columns are additive extras the adapter can ignore.

The required Core columns are compatible. Installed `@mastra/pg@1.12.1` **loads** (`import` exports `PostgresStore`; no `mergeWorkflowStepResult`). Hosted Core indexes/uniques and `anon`/`authenticated` privileges were re-checked **read-only** on 2026-08-25.

**Verdict: PASS / GO for the local schema contract that unlocks [IPI-1044 · PG-001 — Make iPix AI Conversations Survive Server Restarts](https://linear.app/amo100/issue/IPI-1044/ipi-1044-pg-001-make-ipix-ai-conversations-survive-server-restarts).** Wire that ticket against local Docker (`127.0.0.1:54342`) with `schemaName: "mastra"`, `disableInit: true`, and one injected singleton `pool`. Catalog fingerprint across a real process restart is **IPI-1044 · PG-001** (this **IPI-1043 · DB-001** ticket does **not** construct the store or record before/after hashes). Live Linear is SSOT: **IPI-1044 is PG-001**, not the stale `docs/` map of IPI-1044 to AI-V2-023 canvas, and not **IPI-V2-006**. **NO-GO for hosted/production writes** on fashionos `nvdlhrodvevgwdsneplk`.

**Do not GRANT schema `mastra` to `anon`.**

---

## Installed versions (lockfile + `node_modules`)

| Package | Declared | Installed | Tarball |
|---------|----------|-----------|---------|
| `@mastra/pg` | `1.12.1` | `1.12.1` | `https://registry.npmjs.org/@mastra/pg/-/pg-1.12.1.tgz` |
| `@mastra/core` | `1.41.0` | `1.41.0` | lockfile |
| `@mastra/memory` | `1.26.1` | `1.26.1` | lockfile |

Peer on `@mastra/pg@1.12.1`: `@mastra/core >=1.34.0-0 <2` — **MATCH**. Dist does **not** import `mergeWorkflowStepResult`.

Runtime on this SHA is still **LibSQL** (`src/mastra/index.ts`). Zero `PostgresStore` in `src/`.

---

## Constructor contract (installed types, not blogs)

Source: `node_modules/@mastra/pg/dist/shared/config.d.ts` (`PostgresStoreConfig`).

- **`id: string`** — required.
- Connection: **`pool`** *or* **`connectionString`** *or* host (`host`, `port`, `database`, `user`, `password`) *or* Cloud SQL `ClientConfig`.
- **`schemaName?: string`** — runtime default when omitted is **`"public"`** (`this.schemaName \|\| "public"` in `dist/index.js`). iPix **must** pass `"mastra"`.
- **`disableInit?: boolean`** — when true, storage does **not** auto-create/alter tables; tables must already exist. Also skipped if `MASTRA_DISABLE_STORAGE_INIT=true`.
- Optional: `skipDefaultIndexes`, `indexes`, SSL / pool size on string/host configs.

**Recommended for PG-001 (document only — do not construct here):**

```ts
// PG-001 only. Not executed by DB-001.
new PostgresStore({
  id: "ipix-mastra-storage",
  pool, // singleton / injected pg.Pool — do not open a second pool per request
  schemaName: "mastra",
  disableInit: true,
});
```

`exportSchemas()` exists on the package. Column contract here uses **`TABLE_SCHEMAS` from `@mastra/core/storage/constants`** plus installed `@mastra/pg@1.12.1` types. This ticket still does **not** construct a live `PostgresStore`.

**Import probe (2026-08-25, `/tmp/ipixai-verify-6` at `054da4e` / **IPI-1042 · RUNTIME-001** pin + `@mastra/pg@1.12.1`):** **PASS**. Command:

```bash
node --input-type=module -e "const m = await import('@mastra/pg'); console.log(typeof m.PostgresStore)"
```

Result: `function`. **The store was not constructed or initialized.** No Postgres connection in this probe.

---

## Catalog sources (read-only)

| Env | Project / bind | Method | Writes |
|-----|----------------|--------|--------|
| Local | Docker `127.0.0.1:54342` (Supabase local) | `psql` `information_schema` + `pg_indexes` + `pg_policies` | none (SELECT) |
| Hosted | `nvdlhrodvevgwdsneplk` (fashionos, PG 17) | Supabase MCP `list_tables` schema `mastra` (verbose) | none intended |

**2026-08-25 hosted catalog (SELECT only):** MCP `list_tables` plus `execute_sql` `SELECT` on `pg_indexes` / `has_schema_privilege` / `has_table_privilege` / `role_table_grants`. Privilege re-check covered schema USAGE and SELECT/INSERT/UPDATE/DELETE on all four Core tables for `hyperdrive_mastra_runtime`. No `init()`, migrate, INSERT, UPDATE, DELETE, or GRANT. MCP is not proven `read_only=true`; queries were SELECT-only.

**Environment SSOT:** live Linear **IPI-1043 · DB-001** requires local first, then read-only comparison with the existing hosted project `nvdlhrodvevgwdsneplk`, and explicitly forbids creating a second hosted preview/staging project. Supabase MCP `list_branches` on that project (2026-08-24) returned **only** branch `main` (no preview/branch database). Local Docker (`127.0.0.1:54342`) is the **preview analog** for this matrix. Hosted `list_tables` on fashionos proves live **table/column** shape; it is **not** a write target and does **not** unlock PG-001 against production. The older `docs/archive/notes/12-task-roadmap.md` preview wording is archived historical evidence and must not override the live Linear task.

Local `search_path`: `"$user", public, extensions` — **`mastra` is not in the path**. Unqualified `mastra_threads` would miss the iPix tables. Adapter with `schemaName: "mastra"` qualifies names — **required**.

Foreign keys on Core tables: **0** (local). Logical `thread_id` only.

---

## Official URLs (2026-08-24)

| URL | Status | Note |
|-----|--------|------|
| https://registry.npmjs.org/@mastra/pg/1.12.1 | **VERIFIED** | metadata + peer (2026-08-25) |
| https://registry.npmjs.org/@mastra/pg/-/pg-1.12.1.tgz | **VERIFIED** | lockfile |
| https://mastra.ai/integrations/databases/postgresql | **VERIFIED** | documents **latest**, not 1.12.1 — **hypothesis** |
| https://mastra.ai/docs/storage | **VERIFIED** | latest; `schemaName` default `public`; auto-`init()` when registered |
| https://mastra.ai/reference/build-with-ai | **VERIFIED** | skill / MCP pointer |
| https://github.com/mastra-ai/mastra/tree/main/stores/pg | **VERIFIED** | GitHub **main**, not 1.12.1 — **do not copy** |
| https://supabase.com/docs/guides/ai-tools/mcp | **VERIFIED** | `read_only=true` exists; this MCP session was not that mode |
| https://www.postgresql.org/docs/current/infoschema-tables.html | **VERIFIED** | |
| https://www.postgresql.org/docs/current/infoschema-columns.html | **VERIFIED** | |
| https://supabase.com/docs/guides/api/using-custom-schemas | **VERIFIED** | do **not** follow GRANT ALL to `anon` |
| https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH | **VERIFIED** | `mastra` not in path is a risk |

Installed types win over current web docs and GitHub `main`.

Mastra Docs MCP search for `@mastra/pg`: **no excerpts** in this checkout. CopilotKit persistence docs are Channels StateStore — **not** this contract.

---

## Table inventory

`TABLE_SCHEMAS` in `@mastra/core@1.41.0`: **35** table names.  
Local + hosted `mastra` catalogs: **34** tables. **Local table set = hosted table set.**

### MISSING vs `TABLE_SCHEMAS` (not present locally or hosted)

| Table | Classification | Core PG-001 blocker? |
|-------|----------------|----------------------|
| `mastra_notifications` | **MISSING** | No, with `disableInit: true` |
| `mastra_traces` | **MISSING** | No |
| `mastra_tool_provider_connections` | **MISSING** | No |

### EXTRA vs `TABLE_SCHEMAS` (present on iPix)

| Table | Classification |
|-------|----------------|
| `mastra_observational_memory` | **CHANGE** (additive; MemoryPG in `@mastra/pg@1.12.1`) |
| `mastra_workflow_definitions` | **CHANGE** (iPix-owned; not in Core `TABLE_SCHEMAS`) |

### MISSING vs `@mastra/pg@1.12.1` observability event tables (vNext)

`1.12.1` dist does **not** name `mastra_span_events` (unlike later 1.13). The five `*_events` tables remain **MISSING** on iPix and are **not** a Core Memory blocker with `disableInit: true`.

### MATCH (present local = hosted)

`mastra_agent_versions`, `mastra_agents`, `mastra_ai_spans`, `mastra_background_tasks`, `mastra_channel_config`, `mastra_channel_installations`, `mastra_dataset_items`, `mastra_dataset_versions`, `mastra_datasets`, `mastra_experiment_results`, `mastra_experiments`, `mastra_favorites`, `mastra_mcp_client_versions`, `mastra_mcp_clients`, `mastra_mcp_server_versions`, `mastra_mcp_servers`, `mastra_messages`, `mastra_observational_memory`, `mastra_prompt_block_versions`, `mastra_prompt_blocks`, `mastra_resources`, `mastra_schedule_triggers`, `mastra_schedules`, `mastra_scorer_definition_versions`, `mastra_scorer_definitions`, `mastra_scorers`, `mastra_skill_blobs`, `mastra_skill_versions`, `mastra_skills`, `mastra_threads`, `mastra_workflow_definitions`, `mastra_workflow_snapshot`, `mastra_workspace_versions`, `mastra_workspaces`.

RLS: **enabled** on all 34 (local `relrowsecurity`; hosted `rls_enabled`). **This does not prove tenant isolation.** Docs and local `pg_policies` record `hyperdrive_mastra_runtime_all` as **`USING (true)`** for `hyperdrive_mastra_runtime` (see `docs/data/04-rls-security.md`, `docs/data/07-mastra-storage.md`). That role can see every row; current storage RLS is **not** a tenant boundary. Isolation is **server-derived `resourceId` plus application authorization**. Hosted policy/role auditing and Org A / Org B cross-resource read/write denial tests are required before any isolation claim.

---

## Core memory tables (load-bearing)

Required columns from `TABLE_SCHEMAS` vs local `information_schema.columns`: **all MATCH** (type + nullability). Hosted MCP `list_tables` includes `data_type` and nullable `options`. For the four Core tables those hosted types/nullability **MATCH** local.

Hosted indexes (2026-08-25 `pg_indexes` SELECT): `mastra_threads_resourceid_createdat_idx`, `mastra_messages_thread_id_createdat_idx`, `public_mastra_workflow_snapshot_workflow_name_run_id_key` — **MATCH** local names and columns. Hosted row counts were **not** re-selected (avoid extra production reads). Prior probe: threads 45 / messages 103 / snapshots 6140. Local Core counts: **0**.

### `mastra_threads`

| Column | Required type / null | Local | Hosted vs local | Status |
|--------|----------------------|-------|-----------------|--------|
| `id` | text NOT NULL PK | text NOT NULL | MATCH | **MATCH** |
| `resourceId` | text NOT NULL | text NOT NULL | MATCH | **MATCH** |
| `title` | text NOT NULL | text NOT NULL | MATCH | **MATCH** |
| `metadata` | jsonb NULL | jsonb NULL | MATCH | **MATCH** |
| `createdAt` | timestamp NOT NULL | `timestamp without time zone` NOT NULL | MATCH | **MATCH** |
| `updatedAt` | timestamp NOT NULL | same | MATCH | **MATCH** |
| `createdAtZ` | — not in `TABLE_SCHEMAS` | `timestamptz` NULL default `now()` | MATCH | **CHANGE** (additive) |
| `updatedAtZ` | — | `timestamptz` NULL default `now()` | MATCH | **CHANGE** (additive) |

PK: `id` (hosted + local).  
Required index from MemoryPG `getDefaultIndexDefs`: `mastra_threads_resourceid_createdat_idx` on (`resourceId`, `createdAt DESC`) — **MATCH** locally.

### `mastra_messages`

| Column | Required | Local / hosted | Status |
|--------|----------|----------------|--------|
| `id` | text NOT NULL PK | MATCH | **MATCH** |
| `thread_id` | text NOT NULL | MATCH | **MATCH** |
| `content` | text NOT NULL | MATCH | **MATCH** |
| `role` | text NOT NULL | MATCH | **MATCH** |
| `type` | text NOT NULL | MATCH | **MATCH** |
| `createdAt` | timestamp NOT NULL | MATCH | **MATCH** |
| `resourceId` | text NULL | MATCH | **MATCH** |
| `createdAtZ` | extra | timestamptz NULL default `now()` | **CHANGE** (additive) |

Required index: `mastra_messages_thread_id_createdat_idx` on (`thread_id`, `createdAt DESC`) — **MATCH** locally.

### `mastra_resources`

| Column | Required | Status |
|--------|----------|--------|
| `id` | text NOT NULL PK | **MATCH** |
| `workingMemory` | text NULL | **MATCH** |
| `metadata` | jsonb NULL | **MATCH** |
| `createdAt` / `updatedAt` | timestamp NOT NULL | **MATCH** |
| `createdAtZ` / `updatedAtZ` | extra timestamptz | **CHANGE** (additive) |

### `mastra_workflow_snapshot`

| Column | Required | Status |
|--------|----------|--------|
| `workflow_name` | text NOT NULL | **MATCH** |
| `run_id` | text NOT NULL | **MATCH** |
| `resourceId` | text NULL | **MATCH** |
| `snapshot` | jsonb NOT NULL | **MATCH** |
| `createdAt` / `updatedAt` | timestamp NOT NULL | **MATCH** |
| `createdAtZ` / `updatedAtZ` | extra | **CHANGE** (additive) |

Hosted `primary_keys` on this table: **[]**. Uniqueness is `public_mastra_workflow_snapshot_workflow_name_run_id_key` on (`workflow_name`, `run_id`) — **MATCH** locally and hosted (2026-08-25). Adapter default base name is `mastra_workflow_snapshot_workflow_name_run_id_key`. Status: **CHANGE** (name / `public_` prefix leftover) and **MATCH** on indexed columns.

---

## Indexes (local vs adapter defaults vs hosted Core)

Source: `@mastra/pg@1.12.1` MemoryPG defaults vs local `pg_indexes` vs hosted `pg_indexes` SELECT (2026-08-25). `disableInit: true` cannot create missing indexes.

### Core Memory + workflow uniqueness (PG-001 load-bearing)

| Adapter default (schemaPrefix empty) | Local name | Hosted | Status |
|--------------------------------------|------------|--------|--------|
| `mastra_threads_resourceid_createdat_idx` | same | same | **MATCH** |
| `mastra_messages_thread_id_createdat_idx` | same | same | **MATCH** |
| `mastra_workflow_snapshot_workflow_name_run_id_key` | `public_mastra_workflow_snapshot_workflow_name_run_id_key` | same as local | **CHANGE** (name; columns MATCH) |
| `idx_om_lookup_key` (observational memory) | same | not re-probed | **MATCH** locally |

### Other installed adapter defaults vs local catalog

| Adapter default | Local | Status |
|-----------------|-------|--------|
| `mastra_bg_tasks_*` (4 indexes) | same names on `mastra_background_tasks` | **MATCH** locally |
| `idx_channel_installations_platform_agent` / `_webhook` | same | **MATCH** locally |
| `idx_mcp_client_versions_client_version` / server equivalent | same | **MATCH** locally |
| `idx_prompt_block_versions_block_version` | same | **MATCH** locally |
| `idx_scorer_definition_versions_def_version` | same | **MATCH** locally |
| `idx_skill_versions_skill_version` | same | **MATCH** locally |
| `idx_workspace_versions_workspace_version` | same | **MATCH** locally |
| `idx_mastra_schedule_triggers_schedule_fire` / `idx_mastra_schedules_status_next_fire` | same | **MATCH** locally |
| Observability `mastra_ai_spans_*` (10 named indexes) | same | **MATCH** locally |
| `mastra_ai_spans_traceid_spanid_pk` | `public_mastra_ai_spans_traceid_spanid_pk` | **CHANGE** (name) |
| `mastra_scores_trace_id_span_id_created_at_idx` | `mastra_mastra_scores_trace_id_span_id_created_at_idx` | **CHANGE** (double `mastra_` prefix) |
| `idx_notifications_*` / `idx_tool_provider_connections_author` | tables **MISSING** | **MISSING** — not a Core Memory blocker with `disableInit` |
| Five `*_events` table indexes | tables **MISSING** | **MISSING** — not a Core Memory blocker |

Enabling observability, datasets, scores, schedules, or workspaces in PG-001 still needs hosted index verification. Local MATCH does not approve those domains.

If `init()` ran with `schemaName: "mastra"`, MemoryPG would prefix indexes with `mastra_`. Local names are **unprefixed** except accidental `mastra_mastra_scores_*`. **Do not run `init()`** against this catalog; **PG-001** must keep `disableInit: true`, verify hosted metadata read-only, and prove no DDL.

---

## Grants and roles

`PostgresStore` in `@mastra/pg@1.12.1` constructs **MemoryPG** and **WorkflowsPG**. Memory needs `mastra_threads`, `mastra_messages`, and `mastra_resources`. Workflows persist `mastra_workflow_snapshot` with SELECT/INSERT/**UPDATE**/**DELETE**. A grant check that only names threads and messages is incomplete.

**2026-08-25 `has_schema_privilege` / `has_table_privilege` (SELECT only).** Role `hyperdrive_mastra_runtime` — schema `mastra` **USAGE** and SELECT/INSERT/UPDATE/DELETE on all four Core tables:

| Env | USAGE `mastra` | threads | messages | resources | workflow_snapshot |
|-----|----------------|---------|----------|-----------|-------------------|
| Local Docker `127.0.0.1:54342` | true | all four DML true | all four DML true | all four DML true | all four DML true |
| Hosted fashionos `nvdlhrodvevgwdsneplk` | true | all four DML true | all four DML true | all four DML true | all four DML true |

`postgres` has access on both. Hosted `anon` / `authenticated` / `service_role`: schema USAGE **false** (re-checked). **`anon` has no effective USAGE/DML.** Do **not** GRANT schema `mastra` to `anon`.

Local **IPI-1044 · PG-001** may still connect as Docker `postgres` by setup convenience. That is optional, not a workaround: `hyperdrive_mastra_runtime` already has the four-table DML. Never `anon`. Never hosted/production writes from PG-001.

---

## Required migrations

| Item | Required for Core PG-001 + `disableInit: true`? |
|------|--------------------------------------------------|
| Create Core four tables | **No** — they exist |
| Add `TABLE_SCHEMAS` required columns | **No** — all present |
| Create default thread/message indexes | **No** — MATCH local and hosted |
| Unique (`workflow_name`, `run_id`) | **No** — MATCH columns; name CHANGE (`public_` prefix) |
| Drop `*Z` columns | **No** — compatible extras |
| Create `mastra_notifications` / `traces` / `tool_provider_connections` | **No** for Core Memory |
| Create five `*_events` tables | **No** for Core Memory |
| Put `mastra` on `search_path` | **No** if adapter always qualifies; **risk** if any SQL is unqualified |
| GRANT `mastra` to `anon` | **Forbidden** |

Blocking proofs before DB-001 can unlock **local** PG-001: **cleared 2026-08-25** (import PASS on 1.12.1; Core indexes MATCH hosted; `anon`/`authenticated` have no USAGE/DML). Optional unused domains remain NO-GO. Hosted fashionos stays a **read-only** compare target, not a write target.

---

## Go / no-go for IPI-1044 · PG-001 — Make iPix AI Conversations Survive Server Restarts

**PASS / GO for the local schema contract (unlocks [IPI-1044 · PG-001 — Make iPix AI Conversations Survive Server Restarts](https://linear.app/amo100/issue/IPI-1044/ipi-1044-pg-001-make-ipix-ai-conversations-survive-server-restarts) wiring).** **NO-GO for hosted/production writes.** Catalog fingerprint before/after process start is **not** collected here.

Gates:

1. Import `PostgresStore` from `@mastra/pg@1.12.1` without constructing it — **PASS** on `054da4e` (**IPI-1042 · RUNTIME-001 — Pin `@mastra/pg` 1.12.1 so it loads with Core 1.41.0**)
2. Required Core indexes and (`workflow_name`, `run_id`) uniqueness — **MATCH** local and hosted (name CHANGE only on snapshot unique)
3. `has_schema_privilege` / `has_table_privilege`: **`anon` and `authenticated` have no USAGE/DML**; `postgres` has access. Local and hosted `hyperdrive_mastra_runtime` have schema USAGE plus SELECT/INSERT/UPDATE/DELETE on all four Core tables (threads, messages, resources, workflow_snapshot)
4. Hosted RLS `USING (true)` is **not** tenant isolation
5. Constructor (**IPI-1044 · PG-001**): `schemaName: "mastra"`, `disableInit: true`, injected singleton `pool` — **specified here, not constructed**
6. Catalog fingerprint unchanged across process start — **PENDING on IPI-1044 · PG-001 — Make iPix AI Conversations Survive Server Restarts** (requires a live store; out of scope for this **IPI-1043 · DB-001** ticket)
7. Tenant isolation remains `resourceId` + app auth
8. Do not treat fashionos as the first write target

Live Linear still forbids a second hosted preview project. Do not copy GitHub `main`; installed `@mastra/pg@1.12.1` is the contract.

---

## What this ticket did not do

- No `new PostgresStore`, no `init()`, no `src/mastra` change
- No production DML/DDL
- No second hosted Supabase project
- No GRANT to `anon`
