---
title: Data / Supabase — layer PRD (ipixai)
status: Canonical for this folder
checked: 2026-09-01
parent: docs/prd.md
epic: IPI-1075
---

# Data / Supabase — product requirements

Think of Postgres as the **studio ledger**: who owns the thread, which brand DNA is approved, which shoot actually exists. CopilotKit is the **intercom**. Mastra is the **crew**. Vercel is the **stage**. Cloudinary is the **photo lab** (bytes), not this ledger.

This deepens [docs/prd.md](../../prd.md). It does **not** replace it. Canonical repo: [amoai-tech/ipixai](https://github.com/amoai-tech/ipixai). Hosted project: `nvdlhrodvevgwdsneplk`. Do **not** mutate production from docs work.

If this file disagrees with [live Linear](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2) or `package.json`, **Linear and the lockfile win**. Mint: [todo.md](./todo.md). Order: [roadmap.md](./roadmap.md) · [tasks.md](./tasks.md).

**Today (2026-09-01):** architecture is sound; production readiness is **~77/100** — **not production-certified**. After the existing Core gates: **~93/100**. The gap is **hosted proof**, not missing tables. Do **not** execute the August task order literally. **PR #23** (thread ACL) is **OPEN**, not on `main`.

---

## 1. Problem

Operators need one trusted closet: sign in → talk to the Planner → refresh and still see SS26 chat → Org B cannot peek.

**On `main` today:** Mastra/Postgres guard (PR #25 merged), Auth foundation, TLS, `schemaName: "mastra"`, `disableInit: true`. **Application thread ACL is not on `main`.** It is implemented on **open [PR #23](https://github.com/amoai-tech/ipixai/pull/23)** (targeted tests included; hosted Org A/B proof and merge still missing). **Code on a branch is not Done.**

Without proving **Vercel → authenticated CopilotKit → Mastra → shared Postgres → restart → cross-org denial → atomic first claim**, Core cannot ship.

## 2. Outcome

A signed-in Org A operator:

1. Streams Planner replies on a real session (not `demo-user`).
2. Writes a `TEST-<uuid>` thread to **shared** Supabase Postgres.
3. Recycles the process; the **same** messages reload.
4. Org B opening that thread gets **HTTP 403** with a **generic** error only (`error` / `reason` such as `thread_forbidden`) — **zero** Org A messages, title, or tools leaked. Do **not** require an empty body.
5. Two Vercel instances racing first-create: **exactly one** winner (`INSERT … ON CONFLICT DO NOTHING`).
6. Browser refresh restores the conversation (**IPI-1088**).
7. Approved Brand DNA and approved shoots are human-gated; reject writes **nothing** durable on `shoot.shoots`.

**IPI-1091 · RELEASE-001** is the production journey. It must not start until the [tasks.md](./tasks.md) Core checklist is green.

## 3. Who owns what

| System | Owns | Must not own |
| --- | --- | --- |
| **Supabase Postgres + RLS** | Orgs, membership, `shoot.shoots`, `brands.ai_profile` after human approval, advisor register | Image pixels; CopilotKit stream protocol |
| **Mastra `mastra` schema** | Threads, messages, memory, snapshots (runtime store) | Org membership; browser JWT |
| **Next.js on Vercel** | Auth cookies, CopilotKit route, signed-in UI | Combined `npm run dev`; service-role in the browser |
| **CopilotKit** | Stream, Stop, replay UI | Direct table GRANT as authorization |
| **Runtime role** | `hyperdrive_mastra_runtime` (never `postgres`, never browser service-role) | DDL on boot (`disableInit: true`) |

**Grants ≠ RLS.** A table can have RLS on and still be a PostgREST gun if `authenticated` inherits `arwd` on **new** tables (**IPI-897**).

## 4. Sources of truth (do not dual-write)

| Domain | Canonical | Legacy / never |
| --- | --- | --- |
| Shoots | `shoot.shoots` | `public.shoots` — do not write |
| Planner memory | `mastra.*` via PostgresStore | LibSQL `:memory:` for hosted Core proof |
| Brand approved DNA | `brands.ai_profile` after HITL | Firecrawl / edge / model must not self-promote |
| Thread first-create | Dedicated unique `thread_id` claim | Process-local `localOwners` across Vercel instances |

```text
AI draft → human approves → one idempotent commit → shoot.shoots
Reject = zero durable shoot writes
```

```text
Brand crawl → draft only → human approves → atomic RPC → brands.ai_profile
Vector similarity is retrieval, never authorization
```

## 5. Environment (paste into stale tickets)

```text
1. Local Supabase in this repo first (`supabase start` / `db reset` — never `--linked`).
2. Then the existing approved hosted project `nvdlhrodvevgwdsneplk` with synthetic TEST-<uuid> data only.
3. Do not create a second hosted preview/staging Supabase project.
4. Do not point new PostgresStore / Mastra writes at production mastra threads until that task’s explicit safety gate.
5. Fail closed if the connection string is production and the task is not the hosted synthetic proof.
```

Pooler: try **transaction mode port 6543** first for serverless; fall back only after a real incompatibility (prepared statements). TLS must be verified on the actual connection.

## 6. Constraints

- **0 new Linear issues** for env strategy, dual shoot tables, Mastra durability, or Brand Knowledge. **IPI-1124–1128** already exist.
- Do **not** restart **IPI-1043 · DB-001**, **IPI-1044 · PG-001**, **IPI-1037 · AUTH-001**, or **IPI-1046 · AUTH-002** (all **Done**).
- Do **not** add a PK on `mastra_workflow_snapshot` because the performance advisor complains. Compare **installed** `@mastra/pg@1.22.2` first.
- Do **not** mass-revoke `SECURITY DEFINER` RPCs. Classify: intentional API → prove caller/org auth; internal helper → revoke EXECUTE / private schema; RLS-compatible → `SECURITY INVOKER`.
- Do **not** bulk-drop unused vector/Mastra indexes.
- Do **not** replay numbered dump `00`–`11` as migrations. They are evidence, not a ledger.
- Forward-only DDL via **IPI-1040 · MIGRATION-001**. Never `migration repair` to fake alignment.
- Split `dev:ui` / `dev:agent`. Combined `npm run dev` stays blocked.

## 7. Official references (max 5 — fetch before code)

| # | URL | Critical fact |
| --: | --- | --- |
| 1 | [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) | `(select auth.uid())` for stable per-statement policies; grants and RLS are separate |
| 2 | [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) | Transaction pooler `6543` for serverless; session/direct for persistent clients |
| 3 | [Mastra PostgresStore source](https://github.com/mastra-ai/mastra/blob/main/stores/pg/src/storage/index.ts) | External schema + `disableInit`; installed `1.22.2` still wins over `main` |
| 4 | [Password / HIBP](https://supabase.com/docs/guides/auth/password-security) | Leaked-password protection is an Auth setting, not a migration |
| 5 | [INSERT … ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html) | Atomic thread claim for **IPI-1127** |

## 8. Scores (provisional — no production writes in this audit)

| Area | Score | Comment |
| --- | ---: | --- |
| Architecture | **94** | Ownership boundaries are clear |
| Runtime / packages | **88** | PR #25 on `main`; live fingerprint pending |
| Schema | **90** | Strong existing schema; no rebuild |
| Auth | **90** | AUTH-001/002 Done; HIBP off |
| Tenant isolation | **70** | ACL on **open PR #23**, not `main`; hosted + atomic claim pending |
| Mastra durability | **83** | Implementation strong; hosted restart proof pending |
| Supabase security | **72** | Advisor classify / default ACL / HIBP remain |
| Migration safety | **76** | Forward-only correct; IPI-1040 unfinished |
| Brand governance | **78** | Model good; human promotion incomplete |
| Production verification | **62** | Biggest deficiency |
| **Overall** | **77** | Good architecture, not certified |

## 9. Acceptance (human-readable)

- [ ] Installed `@mastra/pg@1.22.2` matches live `mastra.*` (including snapshot **no-PK** if that is what Mastra requires).
- [ ] No runtime Mastra DDL.
- [ ] Hosted `TEST-<uuid>` thread survives process recycle.
- [ ] TLS verified; role is `hyperdrive_mastra_runtime`.
- [ ] No browser role on `mastra`.
- [ ] Org B → HTTP 403 with generic error only; **zero** tenant content leaked (not an empty body).
- [ ] [PR #23](https://github.com/amoai-tech/ipixai/pull/23) merged before release.
- [ ] Cross-instance first claim: one winner.
- [ ] HIBP enabled (**IPI-863**).
- [ ] Brand AI cannot self-approve. Shoot reject writes zero `shoot.shoots` rows.
- [ ] CI, typecheck, targeted tests, build, authenticated browser journey on the release SHA.
