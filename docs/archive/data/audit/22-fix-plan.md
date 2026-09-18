# 22 — Technical fix plan (schema → wiring)

Status: Living plan from audits **01–20** + verdict [23-audit-supa.md](./23-audit-supa.md)  
Checked: 2026-09-01 (PR #23 CONFLICTING; fingerprint compatible; vitest 59)  
Project: `nvdlhrodvevgwdsneplk` (Postgres 17.6.1, `us-east-2`) — **read-only** unless a named production-write gate is approved  
Companion: [21-fix-plan.md](./21-fix-plan.md) is the Linear mapping. **This file** orders work by Postgres → Edge → Mastra → Next.

**Readiness:** **67/100** overall · **87/100** architecture · security **73/100** (verdict 23, 2026-09-01 third pass). Production verification **49/100**.

**Do not:** rebuild the 191-object ledger · redesign Mastra persistence · `supabase db push` · `migration repair` · `mastra migrate` on production · mass-revoke DEFINER · bulk-add 51 FK indexes · **DROP `public.shoots`** · copy `/home/sk/ipix` · combined `npm run dev`.

**Faster path:** three lanes. Lane 1 Core with Preview before ACL. Lane 2 now (HIBP, DEFINER 24, map 25, PR #23 rebase). Lane 3 after Core. PR #23 is **not mergeable** until rebase.

---

## How to read this

Think of the live project as a **warehouse with locked rooms**, then a **camera that records conversations**, then a **front desk**.

| Layer | Real-world | Live fact |
| --- | --- | --- |
| Schema | Floor plan | 145 app tables, all RLS **on** |
| Relationships | Which boxes sit on which shelves | Dual shoot / dual task ledgers |
| Indexes | Labels on boxes | 634 indexes; do not relabel in bulk |
| RLS | Who the bouncer lets in | JWT vs runtime role vs fail-closed |
| Triggers / RPCs | Staff who can move stock | DEFINER writes; shoot has **0** schema DEFINER |
| Edge functions | Side doors | 7 ACTIVE; 2 JWT-off |
| Agents | The camera (Mastra) | `mastra.*` + starter **weather** agent |
| Wiring | Front desk | Login → CopilotKit; **no** domain CRUD in `src/` |

Work **P0 → P8** in order. Later layers assume earlier ones are frozen or proven. Parallel work is called out.

---

## P0 — Setup (do this before any DDL)

**Error:** This repo is **not** the migration SSOT. Live has **309** applied versions; `supabase/migrations/` here has **1** unapplied file (`ipi897` planner default privileges). Agents that `migration new` against a 1-file folder will fork history.

**Solution:**

1. Treat **live** `supabase_migrations.schema_migrations` as the ledger.
2. Fetch remote history in a **disposable** worktree before writing SQL. Never `repair`.
3. Confirm MCP/CLI is project `nvdlhrodvevgwdsneplk` — ignore other Supabase projects.
4. Split terminals: `npm run dev:ui` (:3000) and `npm run dev:agent` (:4111). Combined `npm run dev` stays blocked.
5. Hosted Mastra: `MASTRA_DATABASE_URL` on the **approved** project; pooler port **6543** first; role `hyperdrive_mastra_runtime`; TLS. Code already fail-closes without that URL (`src/mastra/pg-store.ts`: `schemaName: "mastra"`, `disableInit: true`).
6. No service-role key in the browser. Cloudinary bytes stay out of Supabase Storage (0 buckets — keep it that way).

**Done when:** anyone writing SQL knows they cannot recreate this DB from ipixai files; Preview/prod env points at this project only.

---

## P1 — Schema (canonical rooms)

**Error:** Two maps of the same building. FashionOS and iPix share one project. Duplicate SoTs look like “missing tables” when they are **the wrong table**.

### Canonical (write here)

| Schema / table | Purpose | Live occupancy (audit snapshot) |
| --- | --- | --- |
| `organizations` / `org_members` / `profiles` | Tenant identity | 4 orgs, 3 members, 2 users |
| `brands` (+ crawl / scores / intake) | Brand brain | 7 brands; **0** scores, **0** intake drafts, **0** graph |
| `planner.*` (11 tables) | Production planner OS | 4 workflows, 4 instances, 44 tasks, **0** gate_approvals |
| `shoot.shoots` + children | Canonical shoot | 4 shoots, 16 shot_list, 4 deliverables |
| `talent.*` | Talent OS | 1 profile, **0** bookings |
| `assets` / `cloudinary_assets` / `asset_*` | Media **metadata** | 55 / 27 / links 22 |
| `mastra.*` (34 tables) | Agent memory | 50 threads, **119** messages, 6140 snapshots, 6078 schedule triggers |
| Commerce / social **link** tables | Mercur/Postiz IDs only | **0** product/order duplication |

### Freeze (do not extend, do not dual-write)

| Object | Why |
| --- | --- |
| `public.shoots` (8) vs `shoot.shoots` (4) | Dual SoT. **Existence is not a Core blocker.** Do not DROP — FKs still point here |
| `public.tasks` (0) vs `planner.tasks` (44) | Dual task SoT; public empty |
| `public.model_profiles` (3) vs `talent.talent_profiles` (1) | Dual talent |
| FashionOS `events` / `event_phases` | Legacy coexistence; not iPix MVP |
| `chatbot_*`, `processed_firecrawl_webhooks` | RLS-on, **no policy** = fail-closed |
| `media_size_specs` | Deprecated; `image_specs` is the catalog |

**Solution:** Schema-aware map ([25](./25-code-database-dependency-map.md)): `origin/main` `src/` has **zero** `.schema()` / `.rpc()` / shoot queries; only `public.org_members` + Mastra pg store. New features use schema-qualified `shoot` / `planner` / `talent`. Do **not** add a PK on `mastra.mastra_workflow_snapshot` — uniqueness is `(workflow_name, run_id)`. Do **not** `mastra migrate` on production (`disableInit: true`).

**Done when:** V2 never reads/writes `public.shoots`; FK migration plan exists **before** any DROP.

---

## P2 — Relationships (which boxes sit together)

**Error:** Graphs are internally consistent **inside** planner, shoot, talent. They are **not** one global graph. `mastra` has **0 FKs**. Shoot tenancy is `brand_id` → `brands`, **not** `org_id` on the shoot row.

```text
auth.users ──1:1── profiles
     └── org_members ── organizations
brands ──org── organizations
brands ──CASCADE── shoot.shoots ──CASCADE── shot_list, shoot_deliverables
planner.workflows / instances ── org_id
     └── tasks, assignments, dependencies (tenancy via parent)
talent.bookings ── SET NULL ── shoot.shoots
mastra.* ── no org FK; isolation = resourceId in the app
```

**Risks to keep, not “fix” with new FKs:**

| Finding | Action |
| --- | --- |
| Brand delete CASCADE-wipes shoots | Product warning; do not drop CASCADE without a dedicated design |
| Two memberless orgs (`ipi949-verify-*`) | Ignore or ops-delete later; do not join them for QA |
| `organizations.owner_id` vs `org_members.role = owner` | Two owner concepts; membership is CopilotKit SoT |
| Mastra unreferenced to orgs | **Correct.** Do not add mastra→org FKs |
| **`public.assets.shoot_id` → `public.shoots` CASCADE** | Cannot delete legacy shoots without orphaning/deleting assets |
| **`crm_deals.shoot_id` → `public.shoots` NO ACTION** | Delete of legacy shoot **blocked** while deals reference it |
| **`commerce_product_links.shoot_id` → `public.shoots` SET NULL** | Commerce links survive shoot delete; still a legacy pointer |

**Solution:** Isolate tenants in **application keys** (`org:{orgId}::user:{userId}`). Shoot writes stay RPC. Talent bookings may outlive a deleted **canonical** shoot (SET NULL). Migrate `assets` / `crm_deals` / `commerce_product_links` off `public.shoots` **only** in Phase C with an explicit plan.

**Done when:** new code follows parent FKs; no “add org_id to every child” campaign; no mastra FKs; legacy shoot FKs inventoried (this pass: **verified**).

---

## P3 — Indexes (labels, not a rebuild)

**Error:** Advisors report **328** performance lints (150 unused_index INFO, 124 `auth_rls_initplan` WARN, 51 unindexed FK INFO, 2 duplicate_index WARN, 1 no PK on snapshot). That is a **linter firehose**, not a work queue.

**Solution:**

- **Do not** create 51 FK indexes. Many parents are tiny or empty (`gate_approvals` = 0).
- **Do not** drop 150 “unused” indexes without `pg_stat_statements` (idle tables look unused).
- Wrap `(SELECT auth.uid())` **only when you already edit** that policy (FashionOS majority).
- Watch **snapshot/trigger bloat** (6140 / 6078 rows) as ops, not as a missing btree.
- Add **one** index when a **named slow query** is proven (EXPLAIN).

**Done when:** no bulk index PR exists; the next index has a query + EXPLAIN attached.

---

## P4 — RLS (the bouncer)

**Error:** RLS is already **on 145/145**. The remaining issues are Auth policy, grants, and **unproven** tenant deny in the **app**, not missing `ENABLE ROW LEVEL SECURITY`.

| Surface | JWT today | Keep |
| --- | --- | --- |
| Identity | org helpers + own profile | Membership SoT; never authorize from `user_metadata` |
| `planner.*` | 38 policies; children via parent `org_id` | RLS-on; mutations via DEFINER |
| `shoot.*` | **SELECT only** (8 policies) | Writes only via RPC |
| `talent.*` | 26 policies | Same RPC pattern for bookings |
| `mastra.*` | 34 ALL policies; **no** `authenticated` USAGE | Runtime role only |
| Chatbot / webhook tables | RLS on, **0** policies | Fail-closed; do **not** add JWT SELECT |
| `anon` USAGE on `public` | Schema-level grant | Table grants must stay tight |

**Solutions (smallest):**

1. Enable **Have I Been Pwned** leaked-password protection in **Auth dashboard** (CLI cannot). Re-login still works; advisor lint clears.
2. Apply planner **default ACL** (authenticated should not inherit `arwd` on **future** planner tables) only after production approval. Existing 11 tables stay RLS-on. Staging already applied; live 309 does **not** include this file.
3. When editing policies: `(SELECT auth.uid())`, UPDATE needs SELECT, “managers see all” does **not** imply “user sees own row.”
4. Tenant deny for **chat threads** is **not** an RLS column on `mastra_threads`. It is CopilotKit ACCESS in the Next route. Prove Org A vs Org B with two memberships on **this** project.

**Done when:** HIBP advisor gone; JWT still cannot SELECT chatbot rows; Org B same `threadId` returns generic 403 with **zero** Org A content; planner default ACL on live matches intent.

---

## P5 — Triggers, RPCs, cron (staff who move stock)

**Error:** JWT cannot INSERT `shoot.*`. Writes must live in **SECURITY DEFINER** functions. That is **often correct**, not a bug. `shoot` schema has **0 DEFINER** — commit lives in **`public`** RPCs. **34** advisor WARNs = authenticated EXECUTE surface. RLS **does not** protect function execution ([Supabase functions](https://supabase.com/docs/guides/database/functions)). Pin `search_path` (docs: `set search_path = ''` + schema-qualify). **Do not** mass-revoke.

**Per-RPC checklist:** authenticated EXECUTE intentional? `auth.uid()`? org/role? `search_path` pinned? names schema-qualified? caller-supplied `org_id`? cross-org negative fails?

| Count | Where |
| --- | ---: |
| 48 DEFINER | `public` (planner_*, booking_*, CRM, shoot commit, leads, …) |
| 11 DEFINER | `planner` (all planner functions) |
| 75 user triggers | public 48, planner 13, … |
| 2 cron | `expire_stale_bookings`, `expire_stale_brand_analysis` |

Org helpers `is_org_member` / `is_org_owner` / `is_org_editor_or_above`: DEFINER, `search_path=public` — **keep**.

**Solution:**

1. Classify each of the 34 WARNs: keep / tighten `auth.uid()`+org / revoke **anon** only. Never mass-revoke.
2. Open **shoot write** RPC bodies before any shoot UI: reject draft must be **zero writes**; save must be idempotent.
3. Prove one **gate** approve/discard (`gate_approvals` is 0) before calling planner HITL done.
4. Leave cron as named jobs; do not invent a third scheduler for the same expiry.

**Done when:** each authenticated DEFINER has a one-line purpose + caller + org check; shoot reject QA is recorded; no blanket REVOKE.

---

## P6 — Edge functions (side doors)

**Error:** Seven ACTIVE functions. Skill docs still mention `cloudinary-sign` / `register-asset` — **not on this project**. Function **source is not vendored** in ipixai. JWT-off `capture-lead` and `firecrawl-webhook` must not accept unsigned writes. Mastra does **not** call these edges (Gemini via gateway vs `GEMINI_API_KEY` in Deno).

| Function | JWT | Role |
| --- | --- | --- |
| `health` | off | Liveness — OK |
| `edge-test` | on | Gemini smoke |
| `brand-intelligence` | on | URL → brand profile |
| `audit-asset-dna` | on | Image DNA → `assets` |
| `start-brand-crawl` | on | Firecrawl job |
| `capture-lead` | **off** | Marketing chatbot → chatbot_*, lead drafts |
| `firecrawl-webhook` | **off** | Signed webhook → crawl results |

**Solution:**

1. Re-probe **negative** invokes (no JWT / bad HMAC) — expect 401/422, **not** 200-with-write. If broken, fix those two functions; do not add JWT SELECT on fail-closed tables.
2. Pin or vendor Deno sources in this repo so dashboard ≠ mystery.
3. Do **not** deploy Cloudinary sign/register until an **assets UI** exists. Do **not** create `ipix-assets` buckets.
4. Keep the two Gemini paths separate (edge SDK vs Mastra gateway).

**Done when:** unsigned webhook/lead cannot insert; function list in repo matches dashboard; no fake Cloudinary edges in docs.

---

## P7 — Agents (the camera)

**Error:** Live `mastra` schema is a **PostgresStore** cabinet (threads/messages exist). Isolation is `resourceId`, not FKs. Hosted **recycle** (write → new process → same messages) is **UNVERIFIED**. The agent registered in this repo is still the starter **`weather-agent`** (`src/mastra/agents/index.ts`), not a Production Planner that calls `planner_*` RPCs. Studio tables (skills, datasets, workflow_definitions) are empty — ignore.

**Solution (order):**

1. **Fingerprint** live `mastra.*` columns/indexes vs installed `@mastra/pg@1.22.2`. DDL only if mismatch is real. Do not add snapshot PK for the linter.
2. **Hosted persist:** insert a unique marker message → recycle the Mastra/Node instance → same `mastra_messages`. Pooler 6543; no LibSQL on hosted.
3. **Stream + Stop:** abort keys must include `resourceId` so Stop cannot cancel another tenant (`TenantAbortRunner`).
4. **Thread claim:** first-create `thread_id` unique + `INSERT … ON CONFLICT DO NOTHING` before multi-instance release.
5. **Then** replace weather with compute-only planner tools. Tools that write domain data: **DEFINER RPC + user JWT**, never Mastra as `postgres` on `shoot.*`.
6. Do not copy old Worker/Hyperdrive/ALS/DurableAgent unless a **current** failure requires them.

**Done when:** recycle proof exists; Stop is tenant-safe; planner agent is registered **after** store+ACL proofs — not instead of them.

---

## P8 — Frontend / backend wiring

**Error:** This app is **login + CopilotKit sidebar** (`PlannerApp` in `src/app/planner-app.tsx`) with weather/proverbs cards. `/app` is a **design stub**, not shoot/brand CRUD. Live 145 tables are **disconnected**. Thread ACL for Org B may live on a branch, not `main`.

```text
Browser (user JWT)
  → /login → session
  → /api/copilotkit
       → no session → 401
       → org_members only (ignore client org + user_metadata)
       → 0 orgs → needs_onboarding
       → >1 org → needs_org_selection (no switcher yet)
       → 1 org → resourceId = org:{id}::user:{id}
  → Mastra weather-agent → mastra.* (runtime role)

Live planner/shoot/brand/talent
  → not queried from src/
```

**Solution (order):**

1. Keep fail-closed CopilotKit (no unsigned runtime).
2. Ship **Org B 403** `{ error: "forbidden", reason: "thread_forbidden" }` with no body leak.
3. Refresh must **replay** from PostgresStore (same thread, not a blank chat).
4. One authenticated **planner chat** screen that is the product shell — still no domain OS.
5. Port domain screens **one surface at a time**, always to canonical tables:
   - Planner OS UI → `planner.*` RPCs (optimistic `p_expected_updated_at`)
   - Shoot browse → `shoot.shoots` only; reject = 0 writes
   - Brand → occupancy first (`brand_scores` > 0) via existing edges, not a new graph schema
   - Assets → Cloudinary widget + `assets` metadata; no Storage buckets
6. Never wholesale-copy the old operator app. Never put service role in `NEXT_PUBLIC_`.

**Done when:** login → one org → chat survives refresh/recycle; Org B denied; domain pages only appear after their RPC/RLS proofs.

---

## Setup plan (execute in this order)

Maps to verdict **Phases A–E** in [23-audit-supa.md](./23-audit-supa.md). This is the **single sequence**.

```text
PHASE A  Core (Preview before ACL)
0  Safety — project nvdlhrodvevgwdsneplk; split dev; no db push/repair
1  Fingerprint mastra.* vs @mastra/pg          (A1)
2  Stream/Stop tests + tenant abort             (A2)
3  Hosted persist: marker → recycle             (A3)  pooler 6543 first
4  QA Org A/B                                   (A4)
5  Exact-SHA Preview                            (A6)  ← before deny proof
6  Org B 403 + merge ACCESS                     (A5)
7  Authenticated stream proof                   (A7)
8  Atomic first-owner claim                     (A8)
9  Refresh/replay                               (A9)
10 Replace weather-agent with Production Planner
11 Planner screen                               (A10)
12 Core certification                           (A11)

PHASE B  Security (parallel after A1; HIBP is P2)
   HIBP dashboard (Pro+)
   Planner default ACL (production approval)
   DEFINER body + negative tests (file 24) — keep intentional RPCs
   HMAC re-probe capture-lead / firecrawl-webhook (do not rebuild if still green)
   Do not add JWT policies on the 5 fail-closed tables

PHASE C  Canonical paths (schema-aware code map — file 25)
   route → client schema → RPC/query → table → read/write
   Not just from("shoots")
   Do not DROP public.shoots while assets/crm_deals/commerce FKs remain

PHASE D  Product MVP (after Core)
   Brand URL → DNA → campaign → shoot draft HITL → shoot.shoots → talent → assets

PHASE E  After Core
   Commerce, publishing, EventOS, retention (file 28)
```

### This week

| # | Work | Layer |
| --- | --- | --- |
| 1 | Fingerprint `mastra.*` vs `@mastra/pg@1.22.2` | P7 / Phase A |
| 2 | Enable HIBP in Auth dashboard | P4 / Phase B |
| 3 | Hosted recycle proof | P0 + P7 / Phase A |
| 4 | Two-org deny proof | P4 + P8 / Phase A |

Follow-on **audits** (not tickets): **24** DEFINER bodies · **25** code→table map · **26** edge HMAC · **27** hosted Core proof · **28** retention (after Core).

### Later (do not start as “schema rebuild”)

- Canonical shoot UI + reject = zero writes  
- Brand URL → crawl → **intake → scores → graph** (tables exist, occupancy does not)  
- Planner gates (table empty)  
- Talent bookings / commerce links  
- Cloudinary signed upload in-app  
- FashionOS retirement  

---

## Will this fix the architecture?

**Yes, if Phase A runs Preview-before-ACL.** Keep the warehouse and the Mastra cabinet. Remaining work is **hosted proof**, **RPC authorization tests**, and **wiring** (still `weather-agent` today).

**Correctness confidence: 90/100** for advisors + store code this pass. Hosted recycle / Org B / HMAC remain **UNVERIFIED** in browser.

**Next step:** rebase PR #23; licensed Stop test; hosted recycle. **24** / **25** started.
