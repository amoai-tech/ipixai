# IPI-476 + IPI-488 — Post-merge forensic audit

**Date:** 2026-07-10 (post-merge verify [#303](https://github.com/amo-tech-ai/lumina-studio/pull/303) + prior [#301](https://github.com/amo-tech-ai/lumina-studio/pull/301))
**Auditor:** Senior Supabase engineer / QA lead / forensic verifier
**Skills:** `ipix-supabase` · `task-verifier` · `gen-test` · `tasks`
**Project:** `nvdlhrodvevgwdsneplk` — remote-only
**Evidence:** `origin/main` @ `e3064f25` (merge of #303) · live grants · rpc-errors vitest · Playwright on `:3002`

---

## 1. Executive verdict

| Track | Verdict | Score |
|-------|---------|------:|
| **IPI-476 Planner** (#295–#298 + **#301**) | 🟢 Ready for Planner UI with follow-ups | **92/100** |
| **IPI-488 Booking QA** (#288–#300 + **#303**) | 🟢 BOOK-E2E-003 verified; POST→401 (not 500) | **94/100** |

**PLAN-TYPES-002 closed:** type-generation script pin + `can_broadcast_instance` sync merged and forensically verified (see §2a). Remaining planner follow-ups: org template bootstrap, CI `verify-planner`, Node/`ws`.

**BOOK-E2E-003 closed:** unauthenticated POST `/api/bookings` maps EXECUTE denial → **401** (never 500). Live grants unchanged (anon no EXECUTE). Remote QA seed still Option C (happy-path fixtures not on shared remote).

---

## 2a. PR #301 post-merge forensic verify (2026-07-10)

| Check | Result | Evidence |
|-------|--------|----------|
| Merged | ✅ | `MERGED` 2026-07-10T11:43:46Z · `bec66252` |
| CI on merge HEAD | ✅ | `app-build`, `supabase-web015`, `booking-gate` **SUCCESS** |
| Script pin | ✅ | `package.json`: `--schema public,planner,graphql_public` |
| Committed `Database["planner"]` | ✅ | top-level `planner:` @ L40 / L7258 |
| `can_broadcast_instance` | ✅ | `planner.Functions` @ L514 |
| Regen includes public/planner/graphql_public | ✅ | `npm run supabase:types` on `bec66252` |
| No top-level `talent` | ✅ | `talent_top_level_count=0` |
| Deterministic regen | ✅ | run A vs B: **zero diff** |
| Committed vs regen | ✅ | **zero diff** (after #301 sync) |
| Planner engine tests | ✅ | `27/27` passed |
| `tsc --noEmit` | ✅ | pass (Node 22, heap 8192) |
| Talent via public RPCs only | ✅ | `.schema("talent")` = 0 calls; ≥7 `search_talent` / `check_talent_availability` RPC sites |

```bash
# Verified on detached origin/main @ bec66252
npm run supabase:types   # ×2 → identical
git diff --exit-code -- app/src/types/supabase.ts   # clean vs regen
cd app && npx vitest run src/lib/planner/engine.test.ts   # 27 passed
NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck  # pass
```

**Verdict:** [#301](https://github.com/amo-tech-ai/lumina-studio/pull/301) **production-ready for types**. Planner type-generation script is no longer a P1 blocker.

---

## 2. Readiness review — suggestion verification (2026-07-10)

| Suggestion | Verdict | Live evidence |
|------------|---------|---------------|
| **P1 Fix `supabase:types`** | ✅ **Correct intent** · ⚠️ **stale failure mode** | Pin `--schema public/planner/graphql_public` is still right (defense in depth). **Today**, bare `gen types --linked` already keeps `planner` because `config.toml` has `schemas = ["public","graphql_public","planner"]`. Claim “bare script removes planner” is **not reproducible on current main**. |
| **P1 Include `talent` schema?** | ❌ **Do not add** | App uses **public RPCs** (`search_talent`, `check_talent_availability`), not `.schema("talent")`. Adding `--schema talent` adds ~400 lines and is unused by typed clients. |
| **P1 Zero-diff after regen** | ✅ **True after #301** | Pre-merge: +1 `can_broadcast_instance`. Post-merge @ `bec66252`: committed ≡ regen (zero diff ×2). |
| **P1 Booking QA seed strategy** | ✅ **Correct** | `qa_talent=0`, `qa_booking=0` on remote. Merge ≠ apply. **Chosen strategy: Option C — local-only fixtures** until a dedicated QA project or dynamic E2E setup exists. Do **not** load synthetic UUIDs into the shared remote without an explicit QA project. |
| **P2 Org planner template bootstrap** | ✅ **Correct** | Live (2026-07-10 re-probe): **685** orgs, **496** with template, **189** missing (was 164 — still growing). Needs IPI-477 org-create hook. |
| **P2 Run Booking E2E on :3002** | ✅ **Ran** · 🔴 **2/5 fail** | Playwright executed vs live `:3002`. GET OK (400). Valid-body POST → **500** (not 401). Root cause: `OPERATOR_AUTH_ENABLED=false` + anon lacks EXECUTE on `create_booking_request` → unmapped RPC error. |
| **P2 Add `verify-planner` to CI** | ✅ **Correct** | CI runs `verify-booking-gate` / web015; **not** `supabase:verify-planner`. |
| **P2 WebSocket / Node 20 polyfill** | ✅ **Correct** | `typeof WebSocket`: Node 20=`undefined`, Node 22=`function`. No script polyfill. Prefer **Node 22** (Option A). |
| **P3 Typecheck OOM** | ✅ **Plausible env issue** | Not a planner logic bug; raise heap or prove on CI Node 22. |
| **P3 Doc claim corrections** | ✅ **Correct** | Docs must not claim “all orgs seeded” or “types regen = zero diff.” |

### Safest next order (updated)

1. ~~**IPI-476 · PLAN-TYPES-002**~~ — ✅ merged [#301](https://github.com/amo-tech-ai/lumina-studio/pull/301) @ `bec66252`
2. ~~**IPI-488 · BOOK-E2E-003**~~ — ✅ merged [#303](https://github.com/amo-tech-ai/lumina-studio/pull/303) @ `e3064f25` (POST→401 verified)
3. ~~**IPI-477 · PLAN-SEED-002**~~ — ✅ merged [#305](https://github.com/amo-tech-ai/lumina-studio/pull/305) @ `b57129ba` (live missing=0)
4. **IPI-476 · PLAN-CI-001** — [#307](https://github.com/amo-tech-ai/lumina-studio/pull/307) gate `verify-planner` in CI
5. **IPI-476 · PLAN-VERIFY-002** — [#309](https://github.com/amo-tech-ai/lumina-studio/pull/309) Node 22 for `app-build`
6. **IPI-476 · PLAN-DOCS-002** — [#308](https://github.com/amo-tech-ai/lumina-studio/pull/308) refresh fix report
7. **IPI-488 · BOOK-QA-SEED-002** — keep **Option C** (later; not blocking Planner)

---

## 3. PR merge confirmation

| PR | Concern | Merged |
|----|---------|--------|
| [#295](https://github.com/amo-tech-ai/lumina-studio/pull/295) | Migrations (grants, seed backfill, realtime helpers) | 2026-07-10T09:48Z |
| [#296](https://github.com/amo-tech-ai/lumina-studio/pull/296) | `verify-rls` planner probes + `verify-planner-scenario` | 2026-07-10T09:11Z |
| [#297](https://github.com/amo-tech-ai/lumina-studio/pull/297) | Generated types | 2026-07-10T09:58Z |
| [#298](https://github.com/amo-tech-ai/lumina-studio/pull/298) | Fix report docs | 2026-07-10T09:59Z |
| [#288](https://github.com/amo-tech-ai/lumina-studio/pull/288) | `supabase/seed.sql` booking QA | 2026-07-10T10:35Z |
| [#299](https://github.com/amo-tech-ai/lumina-studio/pull/299) | Playwright reliability probes | 2026-07-10T10:35Z |
| [#300](https://github.com/amo-tech-ai/lumina-studio/pull/300) | Linear issue spec | 2026-07-10T10:48Z |
| [#301](https://github.com/amo-tech-ai/lumina-studio/pull/301) | `supabase:types` pin + types sync | **2026-07-10T11:43Z** (`bec66252`) |
| [#303](https://github.com/amo-tech-ai/lumina-studio/pull/303) | Map booking RPC EXECUTE denial → 401/403 | **2026-07-10T12:45Z** (`e3064f25`) |

One concern per PR — **✅** respected.

---

## 2b. PR #303 post-merge forensic verify (2026-07-10)

| Check | Result | Evidence |
|-------|--------|----------|
| Merged on `main` | ✅ | `MERGED` 2026-07-10T12:45:06Z · `e3064f25` on `origin/main` |
| Scope (no grant/seed/E2E) | ✅ | Only `rpc-errors.ts`, `rpc-errors.test.ts`, `booking-service.ts` |
| Mapper: no session → 401 | ✅ | `authenticated` omit/false → `UNAUTHORIZED` |
| Mapper: authenticated → 403 | ✅ | `{ authenticated: true }` → `FORBIDDEN` |
| Mapper: never 500 for EXECUTE | ✅ | `42501` / `permission denied for function` matched before fallback |
| Live grants unchanged | ✅ | ACL: `authenticated=X`, `service_role=X`; **no** `anon` / `PUBLIC` EXECUTE |
| Unit tests | ✅ | `rpc-errors.test.ts` **5/5** |
| Playwright | ✅ | `e2e/06-booking-wizard.spec.ts` **5/5** (`OPERATOR_AUTH_ENABLED=false`, `:3002`) |
| Curl POST valid body | ✅ | **401** `UNAUTHORIZED` (not 500) |
| Curl invalid / GET | ✅ | **400** validation; no **500** |

```bash
# Verified @ e3064f25 (mapper identical on ipi/488-book-e2e-500 @ 243aef6b)
cd app && npx vitest run src/lib/booking/rpc-errors.test.ts   # 5 passed
OPERATOR_AUTH_ENABLED=false npm run dev:ui   # :3002
npx playwright test e2e/06-booking-wizard.spec.ts --project=chromium-desktop   # 5 passed
# curl POST /api/bookings (valid body, no cookies) → 401
```

**Verdict:** [#303](https://github.com/amo-tech-ai/lumina-studio/pull/303) **production-ready**. BOOK-E2E reliability probes green; grants correctly deny anon EXECUTE.

---

## 4. IPI-476 — Live probes

### Migrations (✅)

Remote `schema_migrations` includes:

- `20260709000000` planner_schema_rls
- `20260710080000` planner_grants_and_seed_backfill
- `20260710081000` planner_realtime_auth_helper
- `20260710082000` planner_broadcast_contributor_only
- `20260710083000` planner_realtime_uuid_guard

### Schema / grants / PostgREST (✅)

- 10 tables in `planner.*`, RLS on
- `authenticated` USAGE + table DML; `anon` USAGE **false**
- `user.schema('planner').from('workflows')` → **HTTP 200** (authenticated)
- Anon `Accept-Profile: planner` → `42501` (expected; not PGRST106)

### Realtime (✅)

- `planner_channel_subscribe` → `can_subscribe_instance` (viewer+)
- `planner_channel_broadcast` → `can_broadcast_instance` (contributor+)
- `npm run supabase:verify-planner` (via tsx + `ws` polyfill on Node 20): **passed**

### RLS role matrix (✅)

```text
ok: org A cannot read org B planner.workflows
ok: viewer UPDATE on planner.tasks returns 0 rows under RLS
ok: contributor can update assigned planner.tasks
ok: non-member cannot read planner.workflows
RLS verification passed
```

### Seed templates (🟡 drift — updated counts)

| Metric | Live now | Stale doc claim |
|--------|----------|-----------------|
| Orgs | **660** | — |
| Orgs with `5-Week Product Shoot` | **496** | all |
| Missing | **189** | **0** (at last backfill; drift since) |
| Dupes per org | **0** | 0 |

Idempotent (no dupes) ✅. Coverage incomplete — new orgs since backfill lack template (**IPI-477**).

### Types (✅ after #301)

| Check | Result |
|-------|--------|
| Committed types include `Database["planner"]` | ✅ |
| `can_broadcast_instance` present | ✅ |
| `npm run supabase:types` pin | ✅ `--schema public,planner,graphql_public` |
| Deterministic regen / zero-diff vs committed | ✅ |
| Include `--schema talent`? | ❌ not needed (public RPCs) |

Working command (also the `package.json` script):

```bash
npm run supabase:types
# → supabase gen types typescript --linked --schema public,planner,graphql_public > app/src/types/supabase.ts
```

### Engine tests (✅)

```text
cd app && npx vitest run src/lib/planner/engine.test.ts
→ 27 passed (27)
```

---

## 5. IPI-488 — Booking QA

### Seed file on `main` (✅ code)

- `rates.half_day` · inclusive dateranges · far-future `expires_at` · `on conflict do nothing`

### Remote DB (🔴 for live QA)

| Probe | Result |
|-------|--------|
| QA talent `…0801`/`…0802` | **0 rows** |
| QA booking `…0a01` | **0 rows** |
| Talent tables overall | other production-like data present |

### Seed strategy decision — **Option C (local-only)**

```text
IPI-488 QA fixtures are local-only / repo seed.sql until applied.
Do not load synthetic UUIDs into the shared remote (nvdlhrodvevgwdsneplk)
without a dedicated QA Supabase project.
Remote Booking Wizard QA must use temporary fixtures (setup/teardown)
or a separate QA project (Option A).
```

### Playwright (#299 + #303) (✅ runtime)

| Run | Result |
|-----|--------|
| Pre-#303 | 3 pass / 2 fail (POST→**500**) |
| Post-#303 @ `e3064f25` | **5/5 pass**; POST→**401**; invalid→**400**; no **500** |

---

## 6. Doc vs reality (corrected claims)

| Claim | Truth |
|-------|-------|
| All organizations have planner templates | **False** — **189** missing (2026-07-10 MCP) |
| `npm run supabase:types` produces zero diff | **False** — was missing `can_broadcast_instance`; bare does **not** currently drop planner |
| Type generation must explicitly include planner | **True** as hardening (match config.toml) |
| Planner API / RLS / Realtime operational | **True** |
| Template coverage needs org-create bootstrap | **True** (IPI-477) |

---

## 7. Follow-ups (separate issues / PRs)

1. ~~Merge [#301](https://github.com/amo-tech-ai/lumina-studio/pull/301)~~ — ✅ done.
2. ~~Merge [#303](https://github.com/amo-tech-ai/lumina-studio/pull/303)~~ — ✅ done; BOOK-E2E-003 verified.
3. **BOOK-QA-SEED-002** — Option C; later QA project or E2E fixture lifecycle.
4. **IPI-477 · PLAN-SEED-002** — org-create hook; see [#305](https://github.com/amo-tech-ai/lumina-studio/pull/305).
5. **PLAN-CI-001** — CI gate for `supabase:verify-planner`.
6. **PLAN-VERIFY-002** — standardize Node 22 (no polyfill).
7. **DEV-CI-001** — typecheck heap / CI consistency (P3) — only if reproducible.

---

```text
Final verdict (post-#303 verify @ e3064f25):
  IPI-476  🟢 92/100 — Types pin verified; Planner UI unblocked; next IPI-477 + CI
  IPI-488  🟢 94/100 — BOOK-E2E-003: 5/5 Playwright; POST→401; grants unchanged; Option C seed remains
```
