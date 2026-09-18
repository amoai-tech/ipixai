# 01 — Current state audit (AI runtime v2)

**SSOT for live counts and schema.** If 12/13/README disagree with this file, this file wins until a newer dated re-audit.

**Date verified:** 2026-08-23  
**After:** [README.md](../../notes/README.md)
**Before:** [02-keep-rebuild-matrix.md](./02-keep-rebuild-matrix.md)
**Scope:** `main` operator app (`app/`) + live Supabase `fashionos` (`nvdlhrodvevgwdsneplk`)  
**Not verified as production-proven:** CopilotKit refresh restore, HITL interrupt/resume, Cloudflare Worker persistence as the live operator path  
**Do not modify live DB** — this audit is read-only.

**Frozen live catalog (this date):** 34 `mastra.*` tables · 45 threads · 101 messages · `mastra_workflow_definitions` **exists, 0 rows** (IPI-1008). Historical `42P01` on 2026-08-22 is **closed**. A new `@mastra/pg` still needs a **preview** contract diff (IPI-V2-005B) because the *new* package may add tables this catalog does not have.

Plain English: the product brain is mostly good (Planner prompts, shoot tools, org auth, Mastra schema). The plumbing between CopilotKit, AG-UI, Mastra, and Cloudflare is the fragile part. Like a lookbook shoot where the shot list and talent are ready, but the walkie-talkie between producer and photographer keeps dropping.

---

## Stack today

```text
Operator UI (Next.js /app)
  → CopilotKit 1.61.2 (provider + chat)
    → AG-UI SSE (@ag-ui/mastra 1.1.1)
      → Mastra (@mastra/core 1.59.0)
        → PostgresStore (@mastra/pg 1.20.0)
          → MASTRA_DATABASE_URL / Hyperdrive
            → Supabase Postgres schema `mastra`
```

**Hosting split (do not oversimplify):** operator UI on **Vercel** is still the live app path. Cloudflare OpenNext + Hyperdrive exist and have merged spikes, but **whole-app cutover is not Done** ([IPI-631 · CF-MIG-810](https://linear.app/amo100/issue/IPI-631) Backlog). AI Gateway / DNS / R2 / WAF are useful Cloudflare pieces; the Worker is not the proven golden chat path.

---

## 1. Component matrix

| Component | Current setup | Status | Why | Reuse in v2? |
| --------- | ------------- | ------ | --- | ------------ |
| Operator UI / Copilot chat | Next.js App Router, CopilotKit provider gated on session | 🟡 ADAPT | Product UX exists; threadId restore + Intelligence UI incomplete | Chat shells, layouts, brand/shoot screens |
| CopilotKit runtime route | `app/src/app/api/copilotkit/[[...slug]]/route.ts` (~681 lines) | 🔴 REBUILD | Custom ALS, org resourceId, Bearer strip, interrupt mutation, 5xx sanitizer, idle timeout | Keep **ideas** (auth fail-closed, org scope). Do not copy the file |
| Runtime import shim | `runtime-v2-fetch.ts` — avoid `@copilotkit/runtime/v2` Express barrel on Workers | ❌ REMOVE from Core | Workers workaround; official Node starter uses `createCopilotRuntimeHandler` from `/v2` | No |
| SSE / stream wrappers | `withStreamIdleTimeout` (20s), `normalizeRuntimeErrorResponse` | 🔴 REBUILD | Compensates for hung PG / opaque 500s; not official AG-UI | Idle timeout only if Core still hangs — after proving official stream |
| Thread persistence (CopilotKit) | Intelligence env keys exist; **`isCopilotIntelligenceRuntimeWired() === false`** | 🔴 REBUILD | License token ≠ threads. `InMemoryAgentRunner` is process-local | Explicit `threadId` + Mastra memory first; Intelligence later |
| Thread persistence (Mastra) | `PostgresStore` + `Memory` (`lastMessages: 40`, planner working-memory schema) | ✅ KEEP | Live rows exist; org-scoped `resourceId` ([IPI-146](https://linear.app/amo100/issue/IPI-146) Done) | Direct reuse |
| HITL | `emitInterruptOutcome = false` mutated on agent **and** private `config` so clones keep it | 🟡 ADAPT | Workaround for `@ag-ui/mastra` clone dropping instance fields ([IPI-1010](https://linear.app/amo100/issue/IPI-1010) Backlog — unproven) | Business HITL gates in Planner tools/workflows; not the clone hack |
| Agent registry | `getMastra()` + `REQUIRED_AGENT_IDS` (`default`, `production-planner`, `creative-director`) + extras | 🟡 ADAPT | `default` alias is required by CopilotKit prebuilt UI — keep that contract | Registry keys + prompts/tools |
| Mastra bootstrap | Lazy `getMastra()`, Proxy for CLI, observability opt-in | 🟡 ADAPT | Correct lazy-init; too many env/runtime branches | Slim Node bootstrap only |
| Agents / prompts / tools | Planner, Creative Director, Brand Intelligence, CRM, booking, social, visual identity | ✅ KEEP | Tuned fashion/production logic | Copy into v2 after Core golden test |
| Workflows | `shoot-wizard`, `brand-intelligence` | ✅ KEEP | Real product flows | After Core |
| Memory | Planner working memory Zod schema; org/user `makeMemoryResourceId` | ✅ KEEP | Matches canvas shared-state idea | Core uses thread messages; working memory in MVP |
| PostgresStore | `MASTRA_DATABASE_URL` preferred; pool max 4; Workers skip unless `MASTRA_STORAGE_MODE=pg` | 🟡 ADAPT | Right store, too many skip/stub/ALS paths | Node + `schema: mastra` only in Core |
| Env / config | Infisical + many CF/Mastra flags | 🟡 ADAPT | Secrets manager KEEP; flag maze REBUILD | Gemini + Supabase Auth + `MASTRA_DATABASE_URL` + `MASTRA_SCHEMA=mastra` |
| Cloudflare / OpenNext wrappers | `getCloudflareContext`, `pickCfEnv`, Worker PG ALS ([IPI-803](https://linear.app/amo100/issue/IPI-803) Done in code) | ❌ REMOVE from phase 1 | Coupling AI runtime to Workers is the main complexity tax | DNS/CDN/WAF/R2/AI Gateway stay |
| Hyperdrive | Binding + `hyperdrive_mastra_runtime` grants live | 🟡 ADAPT | Good for later Worker path; not required for Node Core | After Core proven |
| Tests | Large Vitest surface on route/storage/agents | 🟡 ADAPT | Unit tests ≠ refresh journey | Keep domain tests; add golden persist test |
| Sentry / observability | Mastra `MastraStorageExporter` opt-in; `mastra.mastra_ai_spans` ~6 rows | 🟡 ADAPT | Underused | MVP+ |

---

## 2. Live Supabase (`fashionos`)

**Project:** `nvdlhrodvevgwdsneplk` · Postgres 17 · **no writes this audit**.

### What is correct

| Area | Evidence |
| ---- | -------- |
| Private `mastra` schema | 34 tables; RLS **on** every table |
| Runtime role | `hyperdrive_mastra_runtime` has SELECT/INSERT/UPDATE/DELETE on all `mastra.*` tables |
| `public.mastra_*` | **0 tables** in `public` matching `mastra%` ([IPI-1011](https://linear.app/amo100/issue/IPI-1011) Done) |
| App data | brands, orgs, `org_members`, CRM, shoots, assets — KEEP |
| Auth | Supabase Auth + operator gate on `/api/copilotkit` | KEEP |

### Live Mastra volumes (exact counts)

| Table | Rows | Note |
| ----- | ---: | ---- |
| `mastra.mastra_threads` | 45 | Reusable conversation ids |
| `mastra.mastra_messages` | 101 | Thin vs snapshot volume |
| `mastra.mastra_workflow_snapshot` | 6140 | **Bloat** — dispatcher/snapshot noise |
| `mastra.mastra_schedule_triggers` | 6078 | Same pattern |
| `mastra.mastra_schedules` | 1 | |
| `mastra.mastra_ai_spans` | 6 | Observability barely used |
| `mastra.mastra_workflow_definitions` | 0 | Added for Studio ([IPI-1008](https://linear.app/amo100/issue/IPI-1008) Done); Shoot Wizard is code-registered |

### Problems (adapt, do not throw away schema)

| Area | Correct | Problem | Keep / Adapt / Rebuild |
| ---- | ------- | ------- | ---------------------- |
| Schema location | `mastra.*` private | — | **Keep** |
| RLS | Enabled | Policies are `USING (true)` for runtime role — **not** org-aware at SQL | **Adapt** (app-level org scope stays; optional tighter RLS later) |
| Grants | Runtime role can CRUD | `anon`/`authenticated` correctly have **no** table grants in this query | **Keep** |
| Tenant isolation | `resourceId` org+user in app ([IPI-146](https://linear.app/amo100/issue/IPI-146)) | DB cannot stop a privileged role from reading all threads | **Keep app checks**; do not assume RLS = tenancy |
| Snapshot volume | Persistence works | ~6k snapshots / ~6k triggers vs 45 threads | **Adapt** — retention/prune before treating snapshots as “clean history” |
| `public.mastra_*` | Zero | Must stay zero in v2 | **Keep** (gate) |

**v2 reuse of live DB:** reuse **`mastra` schema + existing threads/messages** as the durable store. Do not invent `public.mastra_*`. Do not migrate snapshots blindly into a new app until prune/retention is decided.

---

## 3. Progress (Linear + GitHub) — merged ≠ proven

| Bucket | Items |
| ------ | ----- |
| **PROVEN (code + live catalog)** | Mastra package family ([IPI-1006](https://linear.app/amo100/issue/IPI-1006) Done) · runtime API bump ([IPI-1007](https://linear.app/amo100/issue/IPI-1007) Done) · PG schema including `mastra_workflow_definitions` ([IPI-1008](https://linear.app/amo100/issue/IPI-1008) / PR #975) · org-scoped memory ([IPI-146](https://linear.app/amo100/issue/IPI-146)) · pool limits ([IPI-740](https://linear.app/amo100/issue/IPI-740)) · no `public.mastra_*` writes ([IPI-1011](https://linear.app/amo100/issue/IPI-1011)) |
| **PARTIAL** | Hyperdrive/Worker PG ([IPI-803](https://linear.app/amo100/issue/IPI-803), [IPI-1014](https://linear.app/amo100/issue/IPI-1014) Done in Linear; **not** the golden refresh test) · Copilot persist ([IPI-1020](https://linear.app/amo100/issue/IPI-1020) **In Progress**; PR #969 merged, PR #973 **open**) · CF agent routing ([IPI-594](https://linear.app/amo100/issue/IPI-594) In Progress) |
| **BROKEN / UNPROVEN** | Refresh restore as operator journey ([IPI-634](https://linear.app/amo100/issue/IPI-634) Backlog) · HITL `emitInterruptOutcome` ([IPI-1010](https://linear.app/amo100/issue/IPI-1010) Backlog) · post-upgrade Copilot/HITL/CF verify ([IPI-1009](https://linear.app/amo100/issue/IPI-1009) Backlog) · full Copilot→Mastra→CF→PG journey ([IPI-787](https://linear.app/amo100/issue/IPI-787) Backlog) · production DNS cutover ([IPI-631](https://linear.app/amo100/issue/IPI-631) Backlog) |
| **OBSOLETE — do not copy to v2** | `InMemoryAgentRunner` as production persist · `@copilotkit/runtime/v2` Express bypass shim · `emitInterruptOutcome` private-config mutation · OpenNext `@mastra/pg` stubs · `MASTRA_STORAGE_MODE=noop` as a feature · env fallbacks that hide missing `MASTRA_SCHEMA` |

Parent upgrade program [IPI-1005 · MASTRA-UPG-000](https://linear.app/amo100/issue/IPI-1005) is still **Todo** until [IPI-1009](https://linear.app/amo100/issue/IPI-1009) verifies CopilotKit + HITL + CF.

---

## 4. What is correct vs broken (one page)

**Correct**

- Fashion/production agents, tools, HITL *business* gates (deliverables → shot list → budget).
- Supabase Auth, orgs, brands, CRM, shoot records.
- Mastra in `mastra.*` with a dedicated runtime DB role.
- Fail-closed Copilot auth (401 without session; 403 without org).

**Broken / unproven**

- CopilotKit **thread UI / Intelligence** not wired (`runtime` comment: license token is not enough).
- Process-local runner cannot survive Worker isolate or Node restart.
- 681-line route is a compatibility museum (Google dual-auth header strip, CF env, interrupt clone).
- Snapshot table growth vs thin message history.
- Cloudflare as AI runtime still optional/unproven for the golden chat.

---

## 5. Scores (current vs proposed v2)

| Area | Current app | Proposed v2 |
| ---- | ----------: | ----------: |
| Architecture | 48 | 82 |
| CopilotKit | 45 | 85 |
| Mastra | 62 | 84 |
| Supabase | 78 | 86 |
| Persistence | 40 | 88 |
| Streaming | 50 | 82 |
| Auth/tenant safety | 72 | 84 |
| Maintainability | 35 | 86 |
| Testability | 55 | 80 |
| Production readiness | 38 | 70 |

| Metric | Value |
| ------ | ----: |
| **Current overall** | **52%** |
| **Reuse (business + data)** | **~60%** |
| **Rebuild (runtime glue)** | **~40%** |
| **v2 success probability** (if Core golden gate is blocking) | **~75%** |

Proposed v2 production readiness is **70** until the golden journey is proven — not 90.
