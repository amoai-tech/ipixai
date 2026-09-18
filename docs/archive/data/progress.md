# Supabase progress tracker

**Verified:** 2026-08-24 (this session)  
**Live project:** `nvdlhrodvevgwdsneplk` (`fashionos`, Postgres **17.6**, `ACTIVE_HEALTHY`)  
**Local:** `/home/sk/ipixai/supabase` · Docker **up** · API `54341` · DB `54342`  
**Plans:** [supa-fix-plan.md](./supa-fix-plan.md) · [data pack](./README.md) · [supabase-mastra.md](../mastra/supabase-mastra.md) · [todo.md](../../data/todo-draft.md)

**Mode:** read-only against production. No `db push`, no `db reset --linked`.

Legend: 🟢 completed · 🟡 in progress / partial · 🔴 failed / broken · ⚪ not started

---

## Scoreboard

| Track | Complete | Proof this session |
|-------|----------|--------------------|
| Local Docker baseline | **90%** | `supabase status` healthy; `db reset` replayed; pgTAP **24/24 PASS**; types **8924** lines |
| Wave 0 live SQL (0.1–0.9) | **72%** | Live MCP: anon `get_brand_assets` EXECUTE **false**; `function_search_path_mutable` **0**; chatbot JWT SELECT **false** |
| Wave 0 remaining (Auth / preview / Mastra gold) | **8%** | Leaked-password still WARN; no `ipix-v2` preview wired; app still **LibSQL `:memory:`** |
| Data/SoT audit pack | **100%** | Docs exist; audit-only (not runtime) |
| App ↔ Supabase wiring | **5%** | Types generated; no Auth, no `PostgresStore`, no env client |

**Overall (local + Wave 0 + Mastra store): ~62%.**  
Local replay is production-*testable*. Production is **not** Wave 0 complete. Do not treat this repo’s dump as a remote migration ledger.

---

## A. Local iPix V2 foundation (`/home/sk/ipixai/supabase`)

| Status | % | Task | Proof | Attention |
|--------|---|------|-------|-----------|
| 🟢 | 100 | `supabase init` + `config.toml` (PG 17, offset ports, no secrets) | `config.toml` `major_version = 17`; ports 54341–54344 | Keep `mastra` **off** Data API schemas |
| 🟢 | 100 | Linked to live ref, dump as 2-file baseline | `20260824115900_local_prereqs.sql` + `20260824120000_remote_schema.sql` | **Never push these two files** |
| 🟢 | 100 | `supabase start` | Status JSON: DB `127.0.0.1:54342` | `gen types --local` hits **:5432** — use `$DB_URL` |
| 🟢 | 100 | Repeatable `db reset` | Two resets succeeded this build | Local only |
| 🟢 | 100 | Synthetic seed (Org A/B, brand, `shoot.shoots`, planner) | Live local counts: **2** orgs, **1** `shoot.shoots` | Not a prod dump |
| 🟢 | 100 | pgTAP Org A/B + RPC/security | **2026-08-24 re-run: 5 files, 24 tests, PASS** | Isolation is **local JWT claims**, not hosted Auth |
| 🟢 | 100 | Local TypeScript types | `src/types/database.ts` includes `planner`/`shoot`/`talent`/`mastra` | Do not use MCP typegen |
| 🟡 | 40 | `db push --linked --dry-run` “clean” | CLI **errors**: 309 remote versions vs 2 local files | **Expected.** Do **not** `migration repair` |
| 🟢 | 100 | Production schema unchanged by this work | No apply; dry-run aborted before DDL | Keep it that way |
| 🟢 | 100 | `functions/` empty on purpose | `.gitkeep` only | Deploy Edge from old/lumina until rewritten |
| ⚪ | 0 | App uses local URL / cookies | Starter still in-memory Mastra | Next: `.env.local` → `54341` |
| ⚪ | 0 | First **new** V2 delta migration | Only dump + prereqs | Next real schema change goes here |

---

## B. Wave 0 — live harden ([supa-fix-plan.md](./supa-fix-plan.md))

SQL that already shipped is in **lumina-studio** PRs, not as 309 files in this repo. Live checks below are MCP on `fashionos`.

| Status | % | ID | Task | Proof | Attention |
|--------|---|-----|------|-------|-----------|
| 🟢 | 100 | **0.1** SB-FIX-001 | Revoke anon EXECUTE on `get_brand_assets` | Live `anon_exec=false`, `auth_exec=true`. Advisor `anon_security_definer_function_executable` **0**. lumina #982 | Keep membership checks |
| 🟢 | 100 | **0.2** SB-FIX-002 | Classify DEFINER RPCs (no mass revoke) | Advisor still **34** `authenticated_security_definer_function_executable` WARN — **classified keep**. Linear IPI-1029 Done | Do not mass-revoke planner RPCs |
| ⚪ | 0 | **0.3** SB-FIX-003 | Leaked-password (HIBP) | Advisor `auth_leaked_password_protection` **1 WARN** | Dashboard Auth; Pro plan; Linear IPI-863 Todo |
| 🟢 | 100 | **0.4** SB-FIX-004 | Backend-only deny-all tables | `chatbot_conversations`: anon/auth SELECT **false**, service_role **true**. lumina #983 | Do not add `USING (true)` |
| 🟢 | 100 | **0.4b** SB-FIX-010 | `media_size_specs` comment restore | lumina #986; Linear Done | Not the preview ticket |
| 🟡 | 70 | **0.5** SB-FIX-005 | Canonical `shoot.shoots` | Local test `canonical_shoot.sql` PASS; seed not on `public.shoots`; PRD/ADR language exists | **No shoot UI in this app yet.** `docs/todo.md` still lists 0.5 as todo — **STALE vs local tests** |
| 🟢 | 90 | **0.6** SB-FIX-006 | JWT-off Edge gates | Plan + prior code review (Firecrawl HMAC, capture-lead secret). Functions **not** in this repo | Durable rate limit still follow-up |
| 🟡 | 45 | **0.7** SB-FIX-007 | Re-run advisors + isolation pack | P0 lints gone (`anon` DEFINER + mutable search_path = 0). Leftovers: 34 DEFINER WARN, 3 `extension_in_public`, 5 `rls_enabled_no_policy` | Need a **classified register** in-repo; local pgTAP ≠ hosted RLS suite |
| ⚪ | 20 | **0.8** SB-FIX-008 | Default EXECUTE fail-closed for **creating** role | `postgres` public defaults already tight (plan). `supabase_admin` NOTICE **unfixable** on managed | Prove throwaway RPC on **preview**, not prod. Linear IPI-897 |
| 🟢 | 100 | **0.9** SB-FIX-009 | Lock mutable `search_path` | Live: `public.set_updated_at` / `stamp_analysis_locked_at` / `trigger_set_timestamps` → `search_path=""`. `mastra.trigger_set_timestamps` → `public, pg_temp`. Advisor mutable path **0**. lumina #984 | Linear IPI-864 Backlog is **STALE** vs live |
| ⚪ | 10 | **0.10** SB-PREVIEW-001 | Persistent preview `ipix-v2` | Extra projects exist (`ipix-planner-staging` healthy; `ipix-ipi728-fresh` **INACTIVE**) | Not wired to this app. **Do not** copy prod data. Gates GOLD-001 |
| ⚪ | 15 | **0.11** SB-FIX-011 | Deterministic **preview** seed | **Local** seed exists (Org A/B). Preview seed **not** applied | Apply only after 0.10 |

**Wave 0 leftover advisor snapshot (live, 2026-08-24):** 43 lints · WARN 38 · INFO 5 · leaked-password **still on**.

---

## C. Mastra storage ([supabase-mastra.md](../mastra/supabase-mastra.md))

| Status | % | Task | Proof | Attention |
|--------|---|------|-------|-----------|
| 🟢 | 100 | Live `mastra` schema inventory (34 tables, RLS, no JWT grants) | MCP `mastra_tables=34`; matches local dump | Empty Studio tables = **KEEP**, not drop |
| 🟢 | 100 | Prod must not get new `PostgresStore` until gold | Doc + `disableInit` guidance | Prod already has ~45 threads / noisy snapshots |
| 🔴 | 0 | Runtime uses preview `PostgresStore` | `src/mastra/index.ts` is **`LibSQLStore({ url: ":memory:" })`** | **Blocking** GOLD-001 / Wave 2.2 |
| ⚪ | 0 | Diff pinned `@mastra/pg` vs preview catalog | This starter may not pin `@mastra/pg` yet | IPI-V2-005B |
| ⚪ | 0 | Gold TEST-`<uuid>` persist → refresh → restore; Org B denied | Not run | Needs 0.10 + 0.11 |

---

## D. Data pack (`docs/data/`) — audit artifacts

These are **read-only SoT docs**, not shipped code. Complete as documentation.

| Status | % | Artifact | Notes |
|--------|---|---------|-------|
| 🟢 | 100 | `00-executive-report.md` … `11-table-inventory.md` | KEEP/PORT, ERD, RLS, RPCs, Edge, auth, findings |
| 🟢 | 100 | `supa-fix-plan.md` | Execution order still correct; some Linear statuses **STALE** |
| 🟡 | 50 | `docs/todo.md` Wave 0 table | Still says this tree has **no** `supabase/migrations` — **wrong** after local baseline |

---

## E. Breaking / failing / drift (act on these)

| Sev | Item | Why it matters |
|-----|------|----------------|
| P0 | App Mastra = in-memory LibSQL | Chat will not survive refresh; not the live `mastra` contract |
| P1 | Leaked-password protection **off** | Advisor WARN; blocks “production-ready Auth” |
| P1 | No preview DB wired to this repo | Cannot gold-test PostgresStore without pointing at prod (forbidden) |
| P2 | 309 vs 2 migration ledger | A naive `db push` is dangerous; process must stay “new deltas only” |
| P2 | `docs/todo.md` vs local `supabase/` | Agents will skip local Docker if they trust the todo line |
| P3 | Extensions in `public` (`btree_gist`, `pg_trgm`, `vector`) | Classified defer; do not move in Wave 0 |
| P3 | `gen types --local` vs custom DB port | Use `supabase status -o env` → `--db-url "$DB_URL"` |

Nothing in the **local reset/test path** is 🔴. The 🔴 is **runtime storage**, not the Docker baseline.

---

## F. Production-ready gate (must all be 🟢)

| Gate | Now |
|------|-----|
| Anon cannot EXECUTE `get_brand_assets` | 🟢 |
| Org A / Org B isolation proven | 🟡 local pgTAP only · ⚪ hosted preview |
| Canonical `shoot.shoots` in new product code | 🟡 docs+local · ⚪ UI |
| Leaked-password on | ⚪ |
| Preview branch + synthetic seed | ⚪ |
| `PostgresStore` on **preview** `mastra` + gold test | ⚪ |
| New V2 migrations only from this repo; dump never pushed | 🟢 process · ⚪ first delta |
| Combined `npm run dev` still blocked | (host rule; not re-verified here) |

---

## G. Next tasks (order)

1. Fix **docs/todo.md** Wave 0 intro (this repo **does** have a local baseline).  
2. **0.10** persistent preview (empty) + record URLs; do not clone prod.  
3. **0.11** apply `supabase/seed.sql` (or a preview-only copy) on that branch.  
4. Swap `LibSQLStore` → `@mastra/pg` with `schemaName: "mastra"`, `disableInit: true`, **preview URL only**.  
5. Gold TEST-`<uuid>` + Org B deny.  
6. Dashboard **0.3** leaked-password.  
7. First **forward** V2 migration in this tree (not a dump push).

---

## Evidence log (2026-08-24)

| Check | Result |
|-------|--------|
| `supabase test db` | PASS 24/24 |
| Local `shoot.shoots` / `organizations` | 1 / 2 |
| Live `get_brand_assets` anon EXECUTE | false |
| Live Security Advisor | 43 lints; anon DEFINER 0; mutable search_path 0; leaked-password 1 |
| Live `mastra` tables | 34 |
| `src/mastra/index.ts` storage | LibSQL memory |

**Confidence in this tracker: 88%** (live SQL + local tests this session; Edge JWT-off not re-probed from this repo; preview projects exist but are not this app’s configured target).
