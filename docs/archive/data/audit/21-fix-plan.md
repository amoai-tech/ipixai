# 21 — Fix plan (errors → solutions, execution order)

Status: Living plan from audits 01–20 + verdict [23-audit-supa.md](./23-audit-supa.md)  
Checked: 2026-09-01 (PR #23 `CONFLICTING`; fingerprint vs `@mastra/pg@1.22.2`; vitest 59 pass)  
Live Linear: iPix1  
Live GitHub: [PR #23](https://github.com/amoai-tech/ipixai/pull/23) **OPEN**, `merged=false`, **`mergeable: CONFLICTING`**, `mergeStateStatus: DIRTY` (8 commits / 6 files). Rebase onto current `main` **before** hosted ACL proof. Do **not** merge dirty.  
Project: `nvdlhrodvevgwdsneplk` — **read-only** unless a named ticket + explicit production approval  

**Mint policy:** **0 new Linear issues.** Every row maps to an existing IPI.  
**Do not:** `db push`, `migration repair`, `mastra migrate`, second Supabase project, mass-revoke DEFINER, bulk indexes, copy `/home/sk/ipix`, combined `npm run dev`, **drop `public.shoots`**.

**Faster path:** three lanes. Lane 1 Core (Preview before ACL). Lane 2 **now**: HIBP + DEFINER 24 + map 25 + PR #23 rebase analysis. Lane 3 after Core. Do **not** rebuild Mastra storage.

**Readiness (23):** **67/100** overall · **87/100** architecture · security **73/100**. Technical layers: [22-fix-plan.md](./22-fix-plan.md).

---

## How to use this file

Work **top to bottom** in each lane. Core lane is sequential (later items need earlier proofs). Parallel lane does **not** wait for Core, but Core does **not** wait for advisor-green.

Skills: `ipix-supabase` · `mastra` · `copilotkit` · `task-verifier` · `graphify` · `ponytail` · `linear` · `pr-workflow` · `deploy-to-vercel` when Preview is in scope.

MCP: Linear (status) · Supabase **read-only** (`get_advisors`, `execute_sql`, `list_edge_functions`) · GitHub (`pull_request_read`) · Mastra / CopilotKit docs when implementing.

---

## Closed — do not restart

| Ticket | Why not in the fix list |
| --- | --- |
| **IPI-1043 · DB-001**, **IPI-1044 · PG-001** | Store/schema work Done. Remaining persist proof is **IPI-1124**. |
| **IPI-1037 · AUTH-001**, **IPI-1046 · AUTH-002** | Sign-in + membership SoT Done. Remaining deny is **IPI-1047**. |
| **IPI-685 · SB-EDGE-002**, **IPI-692 · SB-EDGE-008** | **Done.** Capture-lead harden + Firecrawl HMAC/idempotency already shipped. Audit “HMAC unproven” = **re-probe live**, not a new build. Classify leftovers on **IPI-1039**. |

---

## Lane A — Core (must ship first)

**Execute in this order** (Preview **before** merge ACL — deny must be proven on the SHA you intend to ship):

```text
A1 fingerprint
  → A2 stream/Stop (tests + tenant abort)
  → A3 hosted persistence (recycle)
  → A4 QA Org A/B
  → A6 exact-SHA Preview
  → A5 hosted ACL 403 + merge PR #23
  → A7 authenticated stream proof
  → A8 atomic claim
  → A9 refresh/replay
  → replace weather-agent (after proofs, not before)
  → A10 planner UI
  → A11 Core certification
```

Ticket IDs stay A5 = ACCESS, A6 = Preview. Only **calendar order** changed.

Do **not** redesign `pg-store.ts` (approved project, runtime role, hosted fail-closed, TLS+CA, pool max 1, singleton, `schemaName: "mastra"`, `disableInit: true`). Mastra: `disableInit` skips automatic table creation/migrations.

| # | Error (what is wrong) | Why it matters | Solution (smallest) | Owner (live status) | Done when |
| --- | --- | --- | --- | --- | --- |
| A1 | Installed `@mastra/pg@1.22.2` vs live `mastra.*` | Core tables **compatible** (unique `(workflow_name, run_id)`, **no snapshot PK**). Optional list indexes absent — not uniqueness. `npm ci` required locally. `tsc` OOM here — typecheck/build still due | **[IPI-1042 · RUNTIME-001](https://linear.app/amo100/issue/IPI-1042)** · In Progress. PR #25 merged | Fingerprint on issue + typecheck/build on `origin/main` |
| A2 | Stream + Stop not certified on **both** CopilotKit branches | Unlicensed `TenantAbortRunner` tests **59 passed**. Licensed/`licenseToken` branch still omits `runner`. Browser hosted later | **[IPI-1009 · MASTRA-UPG-004](https://linear.app/amo100/issue/IPI-1009)** · In Progress | Licensed regression + Journey E; D N/A until A3 |
| A3 | Hosted env may still miss `MASTRA_DATABASE_URL` / wrong project | Chat uses LibSQL and dies on recycle | Vercel env: hosted fail-closed path in `src/mastra/pg-store.ts`; pooler **6543** first; role `hyperdrive_mastra_runtime`; TLS | **[IPI-1124 · MASTRA-HOST-PG-001](https://linear.app/amo100/issue/IPI-1124)** · In Progress | `TEST-<uuid>` write → recycle process → **same** messages |
| A4 | No isolated QA Org A / Org B for deny proof | Cannot prove tenant isolation without two memberships | Auth dashboard users + `org_members` on **this** project only. Do not create a second DB | **[IPI-1125 · QA-ORG-001](https://linear.app/amo100/issue/IPI-1125)** · Backlog | Two users, two orgs, no shared membership |
| A5 | ACL not on `main`; PR #23 **CONFLICTING** | Conflicts: `route.ts` + `tests/stream-001.test.ts`. Adds `thread-acl.ts`, `access-001.test.ts`. Rebase; keep generic 403. **Do not merge dirty** | **[IPI-1047 · ACCESS-001](https://linear.app/amo100/issue/IPI-1047)** · In Progress · [PR #23](https://github.com/amoai-tech/ipixai/pull/23) | Rebase + hosted Org B 403, zero leak |
| A6 | Preview SHA not certified | Proof on the wrong deploy | Deploy **exact** git SHA to ipixai Vercel Preview | **[IPI-1126 · HOST-PREVIEW-001](https://linear.app/amo100/issue/IPI-1126)** · Backlog | Preview URL + SHA recorded |
| A7 | Stream safety after auth | Unauthenticated stream | Finish STREAM after Preview | **[IPI-1045 · STREAM-001](https://linear.app/amo100/issue/IPI-1045)** · In Progress | Authed stream only |
| A8 | First-create thread race across instances | Two servers both “create” owner | Unique `thread_id` + `INSERT … ON CONFLICT DO NOTHING` | **[IPI-1127 · ACCESS-CLAIM-001](https://linear.app/amo100/issue/IPI-1127)** · Backlog | Blocks **release**, not PR #23 merge |
| A9 | Refresh UI empty even if DB has rows | Operator thinks chat is gone | Replay from PostgresStore | **IPI-1050 · MEM-001** then **IPI-1088 · COPILOT-REPLAY-001** · Backlog | Refresh shows same thread |
| A10 | No single authenticated planner screen in this repo | Operators have no product shell | One screen; no domain OS yet | **IPI-1051 · UI-001** · Backlog | Login → planner |
| A11 | Foundation exam not run | “Looks done” without evidence | Hosted synthetic + full CORE exam | **IPI-1031** then **IPI-1041 · CORE-001** · Backlog | Refresh + restart + Org B deny recorded |

---

## Lane B — Parallel security (start now, do not block A1–A4)

| # | Error | Solution | Owner (live status) | Done when |
| --- | --- | --- | --- | --- |
| B1 | Advisor `auth_leaked_password_protection` WARN | Dashboard Auth → Email → leaked passwords, or Management API `password_hibp_enabled`. **CLI cannot do this.** Confirm Pro+ first | **[IPI-863 · AUTH-V2-001](https://linear.app/amo100/issue/IPI-863)** · Todo | Advisor clear + existing login still works |
| B2 | Future `planner` tables inherit `authenticated=arwd` on **production**. Staging already applied | After **explicit production approval**, apply existing migration `20260825095051_ipi897_…` via **IPI-1040** procedure — not ad-hoc SQL. Existing 11 tables stay RLS-on | **[IPI-897 · SB-SEC-009](https://linear.app/amo100/issue/IPI-897)** · In Review | Live `pg_default_acl` on `nvdlhrodvevgwdsneplk` matches staging; planner UI still loads |
| B3 | 309 remote versions vs 1 file in ipixai | `migration fetch` in a **disposable** worktree; never `repair`. IPI-897 is the first pending V2 file | **[IPI-1040 · MIGRATION-001](https://linear.app/amo100/issue/IPI-1040)** · In Progress | Documented forward path; production ledger still 309 until approved apply |
| B4 | 34 authenticated DEFINER EXECUTE WARNs + 5 no-policy INFO | **Highest-value remaining DB audit.** Classify each body (keep / tighten / revoke **anon** only). Fail-closed no-policy tables stay **without** JWT SELECT. Per DEFINER: intentional EXECUTE? `auth.uid()`? org/role? pinned `search_path`? schema-qualified names? caller-supplied `org_id`? cross-org negative fails? RLS does **not** wrap function execution | **[IPI-1039 · SB-V2-003](https://linear.app/amo100/issue/IPI-1039)** · Backlog + audit **24** | Register + representative negative tests (own org / other org / outsider) |

### Re-verify only (not new tickets)

| Observation | Action |
| --- | --- |
| JWT-off `capture-lead` / `firecrawl-webhook` | Unsigned POST must 401/422 as in **IPI-685/692** evidence. If HMAC broken, reopen those issues — do not mint. |
| Chatbot RLS-no-policy INFO | Keep fail-closed. Do not add JWT SELECT. |
| `vector` / `pg_trgm` / `btree_gist` in `public` | Temporary accept; investigation owned by **IPI-1040**, must not block **IPI-1124**. |
| `mastra_workflow_snapshot` no PK | Mastra unique `(workflow_name, run_id)` wins. Fingerprint on **IPI-1042**. |

---

## Lane C — Product after Core (do not start as “schema rebuild”)

| # | Error | Solution | Owner |
| --- | --- | --- | --- |
| C1 | Dual shoot models remain (P2) | Schema-aware map (audit **25**): client `.schema()` + `.from("shoots")`, not string grep alone. Canonical **`shoot.shoots`**. **Do not DROP** `public.shoots` (FKs from `assets` / `crm_deals` / `commerce_product_links`). Reject plan = zero durable writes | **IPI-1067** → **IPI-1081** → **IPI-1084** reject = 0 writes → **IPI-1083**. Backlog |
| C2 | Brand DNA/graph/intake empty | Pipeline occupancy, not a new schema | **IPI-1093** then **IPI-1128** (do not mint a third Knowledge ticket) |
| C3 | Domain UI missing in ipixai `src/` | Port per ticket; **never** wholesale copy old operator app | Convert plan + **IPI-1048 · PLANNER-001** (Backlog) when Core chat exists |
| C4 | Talent bookings 0; commerce 0 | Schema-ready. Build when product asks | Existing talent/booking IPIs; no commerce rebuild |
| C5 | Cloudinary sign/register **not** on live Edge list | Use Cloudinary widget/signed upload in the **assets** tickets; do not invent buckets | **IPI-1069 · ASSETS-001** / media children — Backlog |
| C6 | Empty IPI-949 orgs (no members) | Optional ops cleanup; not a migration rewrite | No ticket required unless they confuse QA — then note on **IPI-1125** |

---

## Ordered “do this week”

```text
NOW     A1 fingerprint recorded (1042) — typecheck/build still due (tsc OOM here)
        A2 unlicensed Stop tests green (1009) — licensed branch test still due
        B4 DEFINER bodies started (24) — negatives later
        25 schema-aware map — V2 src has no shoot queries
        PR #23 conflict list — rebase, do not merge
        B1 HIBP (863)  ← dashboard, parallel

NEXT    A3 hosted recycle (1124)
        A4 QA orgs (1125)
        A6 exact-SHA Preview (1126)
        A5 rebase + hosted 403 + merge PR #23 (1047)
```

---

## Hard gates (ipix-supabase)

| Gate | Rule |
| --- | --- |
| Production writes | Named ticket + approval + rollback + dry-run first |
| IPI-897 | Staging applied; **production not applied** until approval |
| RLS | `(SELECT auth.uid())` when editing policies; UPDATE needs SELECT |
| Chatbot | Service-role only; JWT fail-closed is correct |
| Shoot | Canonical `shoot.shoots`; reject must not write |
| Mastra | `schemaName: "mastra"`, `disableInit: true`, no hosted LibSQL |

---

## Verification cheat sheet

| Proof | How (read-only unless ticket says write) |
| --- | --- |
| Fingerprint | MCP `list_tables` schema `mastra` vs `@mastra/pg` types |
| Recycle | Hosted insert → new instance → same `mastra_messages` |
| Org B | Same `threadId` → HTTP 403, empty of Org A content |
| HIBP | `get_advisors` security — leaked-password lint gone |
| 897 | `pg_default_acl` on production after approved apply |
| HMAC | Unsigned `firecrawl-webhook` / `capture-lead` → not 200-with-write |
| Dual shoot | Schema-aware: which client/schema hits `shoots`. String `from("shoots")` is **not** enough. FK map before any DROP |

---

## Will this fix the architecture?

Yes, **if Lane A is executed in the Preview-before-ACL order**. Do not rebuild the DB or Mastra store. Remaining work is **proof + DEFINER negative tests + wiring**.

**Next step:** rebase PR #23 on a clean worktree; licensed Stop test; A3 recycle. Audits **24 / 25** started.
