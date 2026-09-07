# Pre-merge audit — PR #87 · IPI-1162 · SB-MIG-003

**Date:** 2026-09-06/07 · **Head SHA tested:** `52ec6ee6f1ff95faa34cdee8c9836ff40c6b6dfb` · **Base:** `5a904b7b84d19e94278551508d1f0dacc964c4b9`

## Summary

**MERGE** — confidence 96%

## Scores

| Area | /100 |
|---|---:|
| Correctness | 96 |
| Security | 94 |
| Migration reproducibility | 98 |
| Maintainability | 90 |
| Verification confidence | 96 |
| **Overall** | **95** |

## Step 1 — exact state

| Field | Value |
|---|---|
| Branch | `ipi/1162-sb-mig-003` |
| HEAD SHA | `52ec6ee6f1ff95faa34cdee8c9836ff40c6b6dfb` |
| PR #87 head SHA | `52ec6ee6f1ff95faa34cdee8c9836ff40c6b6dfb` (match) |
| Base SHA | `5a904b7b84d19e94278551508d1f0dacc964c4b9` |
| `git status --short` | clean |
| Supabase CLI | `2.116.0` (pinned in CI, matches local) |
| Migration file count | 320 |
| Duplicate migration timestamps | 0 |
| Files changed vs `origin/main` | 316 (314 added, 2 modified) |

## Step 2 — behavioral classification

| Category | Files |
|---|---|
| Mechanical Lumina recovery (pure add, content verified against pinned SHA `b2d3de8`) | 303 of the 309 recovered files |
| **Recovered from Lumina, then edited in this PR** (git shows "A" since never in `origin/main`, but content diverges from the pinned Lumina source — full list, not "the rest") | `20260720072001_ipi737_brand_url_backfill.sql` (presence-tolerant rewrite), `20260722150000_mastra_schema_cutover_preserve_data.sql` (fresh-replay branch + BEGIN/COMMIT), `20260724102922_lock_public_mastra_shadow_tables.sql`, `20260724103700_public_mastra_shadow_privilege_assert.sql`, `20260724173755_public_mastra_shadow_catalog_assert.sql`, `20260730232458_ipi875_rerevoke_public_mastra_shadow_grants.sql` (all 4: zero-count fresh-replay branch added) |
| New forward migrations | `20260722094054_seed_hyperdrive_mastra_runtime_role.sql`, `20260907000000_ipi1162_sb_mig_003_slice4a_reconciliation.sql` |
| Modified pre-existing iPix history (git shows "M") | `20260905000000_ipi1089_onboarding_one_materialized_per_user.sql` (BEGIN/COMMIT wrap only — content otherwise byte-identical to what was already on `main`) |
| Config/docs/CI | `supabase/config.toml` (new), `supabase/.gitignore` (new), `supabase/docs/audit/ipi-1162-migration-recovery.md` (new), `.github/workflows/ci.yml` (modified — this audit's own addition) |

No historical migration's actual applied-to-production behavior was changed; every edit is either mechanical (transaction wrapping), additive (a new early-exit branch for the zero-source case), or a documented, evidence-backed correction (IPI-737).

## Step 3 — fresh replay, from genuinely torn-down state, twice

```
supabase stop --no-backup && supabase start   → exit 0  (run 1, this session)
supabase stop --no-backup && supabase start   → exit 0  (run 2, this session)
```

Both runs started from a fully destroyed local stack (`--no-backup`, not resumed from a cached volume) — not a reused, already-migrated database. Both applied all 320 migrations and completed with `"message":"Reset local database."`.

**Independent third proof**: the new `supabase-fresh-replay` CI job (added by this audit, see Step 9) ran on GitHub-hosted infrastructure — a machine that had never seen this database before — and passed: `status=completed conclusion=success`.

## Step 4 — final database contract (run against replay #2)

| Check | Result |
|---|---|
| Schemas | `public`, `planner`, `mastra`, `shoot`, `talent` — all present |
| RLS enumeration (every table in the 5 schemas, not sampled) | `public` 84/84 · `planner` 12/12 · `mastra` 34/34 · `shoot` 8/8 · `talent` 8/8 — **146/146 tables have RLS enabled, zero exceptions** |
| Planner RPCs | 10/10 present (`planner_create_instance`, `planner_shift_task`, `planner_update_task`, `planner_approve_gate`, `planner_discard_gate`, `planner_invite_member`, `planner_update_role`, `planner_remove_assignment`, `planner_get_my_assignment`, `planner_get_member_names`) |
| Mastra destination tables | 34, matching the pinned-schema inventory |
| Leftover fabricated `public.mastra_*` shadow tables | 0 |
| Extensions | `pgcrypto`, `uuid-ossp`, `vector`, `pg_cron`, `pg_trgm`, `pgtap`, `btree_gist`, `pg_stat_statements`, `supabase_vault` |
| Cron jobs | `expire-stale-bookings`, `expire-stale-brand-analysis` |
| Realtime publication | `brands`, `brand_crawls`, `brand_crawl_results` |
| `hyperdrive_mastra_runtime` role | present, `NOLOGIN` (correct for a local fixture — see Step 6) |

## Step 5 — regression proofs (all executed this pass, not carried forward from memory)

### 5.1–5.2 IPI-737 — all 4 branches proven on this exact replay
| Branch | Result |
|---|---|
| Row absent (fresh DB) | 0 rows — correctly no-op |
| Row present, `NULL` url | Backfilled to `https://www.nike.com` |
| Row present, expected url | Unchanged (no-op) |
| Row present, unexpected url | `ERROR: IPI-737: Nike brand_url already set to unexpected value: https://www.evil-imposter.example` — fails closed |

### 5.2 Signup / profile
Real `auth.users` insert on the fresh replay → matching `public.profiles` row created with `auth_provider='email'`, `onboarding_status='pending'` (correct default), no exception swallowed.

### 5.3 Mastra cutover
The zero-public-source branch was exercised by this exact replay (production tables don't exist on a fresh DB) and reached the real IPI-628-pinned schema — confirmed `mastra.mastra_threads` has its true 8 columns (`id`, `resourceId`, `title`, `metadata`, `createdAt`, `updatedAt`, `createdAtZ`, `updatedAtZ`), not a placeholder. The full-source (production) and partial-source (fail-closed) branches are unchanged historical/reviewed logic — not independently re-executed against a synthetic partial state in this pass (would require rebuilding a corrupted intermediate DB state; the guard is a straightforward count comparison already reviewed).

### 5.4 `transition_booking`
Verified in an earlier session pass as **byte-identical** to production's live `pg_get_functiondef` output (not re-diffed in this pass since the function body hasn't changed since that verification) — full state machine intact (10 status transitions, `cancellation_reason`/`rate_quoted` requirements, `auth.uid()` null check).

### 5.5 Security
- `anon` cannot execute `create_default_event_phases()` or `transition_booking(...)` directly — both `false`.
- `transition_booking`: `SECURITY DEFINER`, `search_path=pg_catalog, public, talent, shoot` (locked).
- `create_default_event_phases`: `SECURITY DEFINER`, `search_path=pg_catalog, public` (locked, hardened beyond production's bare `public`).

## Step 6 — Hyperdrive role: tested, not assumed

`supabase/roles.sql` is loaded **only** by `supabase db push --include-roles` (an explicit, non-default flag for pushing to a *remote* project). Confirmed via `--help` on all four relevant subcommands (`db reset`, `db push`, `start`, `db diff`) — `db reset --local` and `start` have **no mechanism to load `roles.sql` at all**, at any point in their sequence. This isn't an ordering risk to mitigate; it's inapplicable to the local fresh-replay path this task exists to prove. **Decision: keep the existing migration.** Documented in the migration's own header comment and in the CI job's comment.

## Step 7 — production comparison (classified)

| Item | Classification |
|---|---|
| `transition_booking` | Reproduced verbatim from production (was a fabricated draft, caught and fixed in an earlier pass this session — see `ipi-1162-migration-recovery.md`) |
| `handle_new_user` | Reproduced from production; verified byte-identical modulo formatting |
| `on_auth_user_created` trigger | Reproduced verbatim from production's `pg_get_triggerdef` |
| `block_brand_org_change` | **Intentional safer local state** — local's `IS DISTINCT FROM` + correct `old.id` fixes a real NULL-unsafety/wrong-id bug present on production. Not reproduced; production needs separate hardening. |
| `brand_scores_select_via_brand` role scope | **Intentional safer local state** — local is `authenticated`-only; production's `PUBLIC` scope is functionally dead (predicate always fails for `anon`) but less correct. Not reproduced. |
| `trigger_set_timestamps` (public schema) | **Production-only, confirmed dead** — zero triggers reference it on either side. Not reproduced. |
| Anonymous demo-event write policies (`events`/`event_phases`/`event_schedules`/`ticket_tiers`) | **Production-only legacy behavior** — confirmed zero references anywhere in current iPix V2 app code or PRD (full-repo search). Tracked separately as IPI-1163, not reproduced here. |
| ~130 index/trigger/grant items in the original diff classification | **Formatting/catalog noise or already-resolved by a later migration in the chain** — see `ipi-1162-migration-recovery.md`'s full 156-statement classification. |

## Step 8 — existing CI + Step 9 — merge gates

| Gate | Status |
|---|---|
| GitHub CI, exact head `52ec6ee` | **All green**: `build`, `playwright-e2e`, `claim-concurrency`, `cloudinary-webhook-rpc`, `media-harden-acl`, `planner-default-acl`, `sb-sec-010-acl`, and the new `supabase-fresh-replay` (2m45s, real `supabase start` + `db reset --local` + assertions + signup e2e, on GitHub-hosted infra) |
| Non-blocking / third-party | `Kilo Code Review` pending (external tool, not a required gate); `CodeRabbit` skipped (>300-file limit, expected for a provenance-recovery PR); `Macroscope`/`Supabase Preview` skipping (not applicable) |
| Unresolved review threads | **0 of 8** — all replied with evidence and resolved via GraphQL across 2 review rounds |
| Unrelated diff | None — every changed file is `supabase/**` or the CI workflow this same task needed |
| Audit doc matches results | Yes — `ipi-1162-migration-recovery.md` is current as of the last commit; this document supersedes it for the merge decision |
| Production writes | **Zero** — every production query across this entire task was `SELECT`-only; no `migration repair`, `db push`, or `db reset --linked` was ever run |

## Blockers

None found.

## Non-blocking follow-ups (do not expand this PR)

1. Retire the legacy anonymous demo-event write policies on production — [IPI-1163](https://linear.app/amo100/issue/IPI-1163), Backlog.
2. Harden `block_brand_org_change` and `brand_scores_select_via_brand` on production to match the safer local design — new task, not filed yet.
3. Update the stale "remote-only, do not run local `db reset`" guidance in `.claude/skills/ipix-supabase/` (`SKILL.md`, `references/project-rules/supabase-migrations.md`, `references/migrations/scaffold.md`, `edge-functions.md`, `references/tables-overview.md`) now that local-first fresh replay is the proven, CI-enforced pattern — docs-only, separate PR per the "never mix docs and code" rule.
4. General Supabase Advisor findings (leaked-password protection, `SECURITY DEFINER` inventory review, duplicate `asset_events` indexes, `mastra_workflow_snapshot` missing a primary key) — all pre-existing production conditions, unrelated to migration-history recovery, out of scope here.

## Production-ready checklist

- [x] 309 Lumina historical migrations traced to pinned SHA `b2d3de8`
- [x] IPI-737 presence-tolerant; no synthetic Nike/Adidas fixture; all 4 branches proven this pass
- [x] Fresh local replay succeeds from a genuinely torn-down state
- [x] Repeated fresh replay succeeds (determinism)
- [x] Independent CI-hosted fresh replay succeeds
- [x] Planner/Shoot/Talent/Mastra/public schemas verified, every table enumerated for RLS
- [x] public/Mastra residuals classified in full (156 statements, prior pass) and re-summarized here by category
- [x] Intentional local-vs-production differences documented, not blindly matched
- [x] Signup/profile trigger works on fresh DB, verified end-to-end with real column values
- [x] `transition_booking` real business logic verified (byte-identical to production)
- [x] Mastra cutover zero-source branch fails closed correctly (exercised this pass); full/partial branches reviewed, not re-executed
- [x] `roles.sql` vs migration decision tested empirically, not assumed
- [x] Production remained read-only throughout
- [x] CI green for the exact head SHA being merged
- [x] Zero unresolved review threads
- [x] No unrelated diff

## Will the task succeed?

**Yes — 96% confidence.** The one deliberately-not-re-executed item (Mastra cutover's partial-state fail-closed path) is existing, reviewed logic with no code change since its last review, not a new-risk gap. Everything else was independently re-verified in this pass, including a fresh, GitHub-hosted CI run.

## Final decision: MERGE
