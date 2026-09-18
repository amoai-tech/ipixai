# Supabase harden plan (Wave 0)

**Project:** `nvdlhrodvevgwdsneplk`  
**Verified live:** 2026-08-24 (read-only MCP Security Advisor + SQL). **No DDL applied in this pass.**  
**Official docs:** [Database Functions](https://supabase.com/docs/guides/database/functions) · [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Branching](https://supabase.com/docs/guides/deployment/branching) · [Securing the API](https://supabase.com/docs/guides/api/securing-your-api) · [Branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching)

Like a lookbook vault: the lock on the door (`auth.uid()` inside the RPC) already works, but you still take the spare key off the public hook (`anon EXECUTE`). Then you label which drawer is the real shoot book, give the new crew a **preview studio** (empty hangers, known sample garments — not a copy of the live wardrobe), and you treat Security Advisor as a **finding list to classify**, not a scoreboard that must hit zero.

**External review (2026-08-24):** Wave 0 architecture **GO** (~96–97/100) after the adjustments below. Proceed.

---

## Live advisor snapshot (2026-08-24)

| Lint | Level | Count | Wave 0 stance |
|------|-------|-------|----------------|
| `anon_security_definer_function_executable` | WARN | **1** — `public.get_brand_assets(uuid, uuid)` | **0.1 — fix** |
| `authenticated_security_definer_function_executable` | WARN | **34** (planner, bookings, talent, CRM, shoot, org helpers) | **0.2 — audit, do not mass-revoke** |
| `function_search_path_mutable` | WARN | **3** — `stamp_analysis_locked_at`, `set_updated_at`, `trigger_set_timestamps` | **0.9 — fix all three** |
| `auth_leaked_password_protection` | WARN | **1** (disabled) | **0.3 — enable** |
| `rls_enabled_no_policy` | INFO | **5** chatbot/Firecrawl/size-spec tables | **0.4 — keep fail-closed; no fake policies** |
| `extension_in_public` | WARN | **3** — `btree_gist`, `pg_trgm`, `vector` | **Classify & defer** (P3; not a Wave 0 blocker) |

EXECUTE on `get_brand_assets`: **anon, authenticated, service_role, postgres**. Body already rejects null `auth.uid()` then org/brand membership.

Default ACLs (live `pg_default_acl`): role **`postgres`** already fail-closes new **public** functions (`service_role` EXECUTE only). Role **`supabase_admin`** still default-grants EXECUTE on new public functions to **anon + authenticated**. **0.8 is not done until the function-creating role is covered** and a **preview/local test function** proves deny-until-grant.

---

## Verdict on the correction note

| Claim | Live check | Plan stance |
|-------|------------|-------------|
| `get_brand_assets` is **not** a proven anon data leak | **Confirmed.** SECURITY DEFINER, `search_path = public, shoot`, **rejects `auth.uid() IS NULL`**, then brand/org membership, then optional shoot∈brand. | **P1 attack surface**, not P0 leak. Still **revoke anon/public EXECUTE**. |
| Chatbot tables fail-closed | **Confirmed.** `service_role` has DML. `anon`/`authenticated` have **no SELECT**. | Document + optional `REVOKE ALL` from JWT roles. **Do not** add `USING (true)`. |
| `shoot.shoots` is product SoT | **Confirmed** (catalog + RPCs). | Freeze `public.shoots` from new iPix code. |
| Preview Mastra first | **Confirmed** (~45 threads, ~6k snapshots). | **P0 for new runtime** — 0.10 then **0.11 seed**, then BOOT. |
| `mastra USING (true)` | Acceptable while schema is **off Data API** and only runtime DB roles. | Do not “fix” with JWT RLS. |
| `planner.assignments` index | Unique `(instance_id, user_id)` exists; **no** `user_id`-leading index. | **P2 after EXPLAIN**, not Wave 0. |
| Default function privileges | Docs: revoke EXECUTE from `public` then from `anon, authenticated`; then grant approved RPCs. Live: **creator role matters**. | **0.8** must set defaults **for every role that creates functions**, prove with a test function **off production**. |
| JWT-off Edge | Live: `health`, `capture-lead`, `firecrawl-webhook` JWT **off**; others **on**. | Verify gates; do not enable JWT on webhooks. |
| Advisor must be fully green | Would force moving extensions / dropping DEFINER APIs. | **0.7 success = classified findings**, not a green dashboard. |

**Do not redesign:** orgs/`org_members`, planner RPCs, HITL keys, `shoot` schema, talent FSM, private `mastra`, user-JWT app client, Mercur-out-of-Supabase.

---

## Execution order (one concern per PR where possible)

```text
0.1  SB-FIX-001  revoke anon EXECUTE on get_brand_assets
→ 0.2  SB-FIX-002  audit SECURITY DEFINER grants (browser? role? definer needed? path? authz? writes?)
→ 0.3  SB-FIX-003  leaked-password protection
→ 0.4  SB-FIX-004  document backend-only deny-all tables
→ 0.5  SB-FIX-005  declare shoot.shoots canonical
→ 0.6  SB-FIX-006  verify JWT-off Edge gates
→ 0.8  SB-FIX-008  default privileges for the *creating* role; prove on preview
→ 0.9  SB-FIX-009  lock all advisor-reported mutable search_path
→ 0.7  SB-FIX-007  re-run advisors + isolation tests (classify leftovers)
→ 0.10 SB-FIX-010  persistent preview branch (empty by default; billable)
→ 0.11 SB-FIX-011  deterministic preview seed (Org A / Org B)
→ Wave 1 BOOT (CopilotKit/Mastra starter on preview)
```

Check-off copy lives in [../todo.md](../../data/todo-draft.md).

---

## 0.1 · IPI-V2-000 · SB-FIX-001 — Remove unnecessary anonymous EXECUTE on brand assets RPC

**Severity:** P1 (defense in depth). **Start here.**  
Advisor (live): `public.get_brand_assets(uuid, uuid)` can be executed by **`anon`** as SECURITY DEFINER.

Repo app already calls the RPC with the **user** client (`app/src/lib/shoot/get-brand-assets.ts`).

**Migration (production, after review):**

```sql
revoke execute
on function public.get_brand_assets(uuid, uuid)
from public, anon;

grant execute
on function public.get_brand_assets(uuid, uuid)
to authenticated;
```

Keep membership checks. Do not rely on the `unauthorized` raise alone. Docs: revoke from both `public` and the unwanted role.

**Prove:**

| Caller | Expect |
|--------|--------|
| anon / publishable key, no JWT | EXECUTE denied (not just exception) |
| Org A member, Org A brand | JSON list (≤100) |
| Org B member, Org A brand | `not_found` / no rows |

**SB-FIX-001: keep as written.**

---

## 0.2 · IPI-V2-000 · SB-FIX-002 — Audit public SECURITY DEFINER grants

**Broader than the original spot-check.** Advisor now flags **34 authenticated** DEFINER RPCs. That is **not** 34 vulnerabilities. DEFINER runs as the owner — which is why EXECUTE role, `search_path`, and `auth.uid()` / org checks must be proven.

**Do not** revoke every DEFINER RPC. Planner, booking, talent, CRM, and org helpers **are** the API.

Examples currently flagged (authenticated EXECUTE + DEFINER):

```text
planner.can_broadcast_instance
planner.can_subscribe_instance
planner.is_assigned
planner.is_at_least
create_booking_request / transition_booking / get_booking
planner_create_instance / planner_update_task / planner_approve_gate
get_shoot_detail / get_brand_assets
search_talent / toggle_shortlist_item / crm_convert_deal
```

**Audit matrix (every DEFINER RPC, including planner schema):**

```text
RPC
↓ Does the browser need it?
↓ EXECUTE role correct? (no anon unless proven public)
↓ SECURITY DEFINER actually necessary? (prefer INVOKER + RLS when it works)
↓ search_path fixed / relations schema-qualified?
↓ auth.uid() enforced?  (prefer (SELECT auth.uid()))
↓ org/resource ownership enforced?
↓ writes idempotent / concurrency-safe?
```

Ship a table in the PR. Revoke only extras (anon, leftover `public`, RPCs that should be service-role-only). **Do not** chase a green advisor by converting working planner helpers to INVOKER.

---

## 0.3 · IPI-V2-000 · SB-FIX-003 — Enable leaked-password protection

Dashboard: Authentication → password security → HaveIBeenPwned.  
**P1** before public signup at scale. Does not block starter bootstrap, **does** block “production-ready Auth.”

---

## 0.4 · IPI-V2-000 · SB-FIX-004 — Backend-only deny-all tables

**Live grants:** chatbot + `processed_firecrawl_webhooks` → **service_role only**. JWT roles: **no SELECT**. Advisor INFO is expected.

**Correct fix:** document as Edge/service-role only. Optionally `REVOKE ALL` from `anon, authenticated`.

**Do not** add `USING (true)` or “service_role policies” to silence the advisor. `service_role` bypasses RLS. Keep fail-closed.

---

## 0.5 · IPI-V2-000 · SB-FIX-005 — Canonical shoots = `shoot.shoots`

**Use:** `shoot.shoots`, `shoot.shot_list`, `shoot.shoot_deliverables`, `shoot.shoot_assets`, `shoot.shoot_crew` + RPCs `commit_shoot_draft`, `get_shoot_detail`, `get_brand_assets`.

**Do not use in new iPix:** `public.shoots`, `public.shoot_assets`, `public.shoot_items`, `public.shoot_payments`.

Docs/code rule, not a risky DB drop.

---

## 0.6 · IPI-V2-000 · SB-FIX-006 — JWT-off Edge gates

| Slug | JWT | Gate (repo) | Wave 0 result |
|------|-----|-------------|---------------|
| `health` | off | Liveness only | Confirm no secrets in body |
| `firecrawl-webhook` | off | `FIRECRAWL_WEBHOOK_SECRET` + `X-Firecrawl-Signature` HMAC SHA-256 | **PASS** (code + tests) |
| `capture-lead` | off | `CAPTURE_LEAD_PROXY_SECRET` + origin/size/shape + **in-memory** rate limit | **PASS WITH FOLLOW-UP** (durable limiter / Turnstile later) |
| `edge-test`, `brand-intelligence`, `audit-asset-dna`, `start-brand-crawl` | on | User JWT | Leave JWT on |

JWT off is **not** a vulnerability if the function has a real secret/HMAC story.

---

## 0.8 · IPI-V2-000 · SB-FIX-008 — New RPCs private by default (creator role)

Docs recommend:

```sql
alter default privileges in schema public
  revoke execute on functions from public;

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;
```

Then explicit `grant execute … to authenticated` on approved RPCs.

**PostgreSQL detail:** default privileges apply to objects created **by a specific role**. Live `pg_default_acl` shows **`postgres`** already tight on `public` functions, while **`supabase_admin`** still grants anon + authenticated EXECUTE.

Incomplete until:

1. `SELECT * FROM pg_default_acl;` (or `\ddp`) for **every role that runs migrations / dashboard SQL**.
2. `ALTER DEFAULT PRIVILEGES FOR ROLE <creator> IN SCHEMA public …` for each such role (`postgres`, `supabase_admin`, CLI role).
3. **Proof off production:** create a throwaway function on **preview or local**, confirm `anon`/`authenticated` cannot EXECUTE until granted, then drop it. Do **not** create that test function on production.

---

## 0.9 · IPI-V2-000 · SB-FIX-009 — Lock every advisor-reported mutable `search_path`

Live targets (exactly three, all INVOKER triggers — P2, still do all of them):

```text
public.stamp_analysis_locked_at
public.set_updated_at
public.trigger_set_timestamps
```

Inspect the body **before** locking. Official guidance: empty `search_path` + schema-qualified names, especially for DEFINER (these three are INVOKER; still lock).

**Live bodies (2026-08-24):** they only assign `NEW` columns (`updated_at`, `analysis_locked_at`, camelCase timestamps). No unqualified `UPDATE brands`. For these, `SET search_path = ''` is enough.

If a later inspect finds `UPDATE brands …`, change to `UPDATE public.brands …` **before** locking.

```sql
alter function public.set_updated_at()
  set search_path = '';
-- same for stamp_analysis_locked_at(), trigger_set_timestamps()
```

**Prove:** one trigger regression (insert/update a row; `updated_at` / lock stamp still writes).

---

## 0.7 · IPI-V2-000 · SB-FIX-007 — Advisors + RLS proof (classify, don’t paint green)

After 0.1–0.6, 0.8, 0.9:

- Re-run Security Advisor.
- `npm run supabase:verify-rls` (or repo script).
- Isolation cases (pgTAP or app tests — currently **missing proof**):

```text
Org A: own brand / shoot / planner instance
Org B: cannot read Org A
anon: no tenant data
member: cannot do owner-only
planner contributor: own assignment RPC; not manager list
get_brand_assets: anon denied; member OK; cross-org denied
```

**Success is not “advisor completely green.”**

**Success:** **zero unexplained P0/P1 security findings**; every remaining advisor notice is **classified, justified, and assigned or explicitly deferred**.

Expected leftovers after Wave 0 SQL/Auth:

| Finding | Classification |
|---------|----------------|
| Authenticated SECURITY DEFINER RPCs that passed 0.2 | **Keep** — product API |
| `btree_gist` / `pg_trgm` / `vector` in `public` | **Defer P3** |
| RLS enabled, no policy on chatbot/Firecrawl tables | **Keep** — fail-closed (0.4) |

No production `mastra` writes.

---

## 0.10 · IPI-V2-000 · SB-FIX-010 — Isolated persistent preview for new iPix

**P0 before PostgresStore.** Production `mastra` has real threads + thousands of snapshots.

Persistent branch is the right shape ([Branching](https://supabase.com/docs/guides/deployment/branching)):

```text
Supabase main     = existing production
Supabase ipix-v2  = new iPix staging (own DB, API keys, Auth, Storage, Edge)
```

Branches are isolated. **New branches are data-less by default** — good here. **Do not copy the production database** to make tests convenient.

Persistent/preview branches consume **billable compute** ([usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching)). Account for that before leaving one running.

New GitHub app → branch DB URL. Prod stays `MASTRA_SCHEMA=mastra` + `disableInit: true` until contract + gold test.

Then **IPI-V2-005B**: diff installed `@mastra/pg` vs **preview** catalog.

---

## 0.11 · IPI-V2-000 · SB-FIX-011 — Deterministic preview seed

**Immediately after 0.10.** Empty preview is useless for RLS/gold tests.

Purpose:

```text
preview DB
    ↓
known QA user
known Org A
known Org B
known brand
known shoot
known planner instance
    ↓
repeatable RLS tests
    ↓
repeatable CopilotKit/Mastra golden tests
```

Minimum seed (synthetic only):

```text
QA user
→ QA organization (Org A) + second org (Org B)
→ QA brand (on A)
→ QA shoot (on A)
→ QA planner instance (on A)
```

Then the gold test is deterministic:

```text
Org A → Production Planner → TEST-<uuid> → persist → refresh → restart → restore
Org B → same thread → DENIED
```

Do **not** dump production. Seed lives in repo (`supabase/seed/` or a documented SQL file applied **only** to the preview branch).

---

## Explicitly not Wave 0

| Item | When |
|------|------|
| Add 30 FK indexes | After EXPLAIN from new Planner queries |
| JWT RLS on `mastra` | Never required if schema stays private |
| Enable JWT on Firecrawl/lead | Would break webhooks |
| Move extensions out of `public` | P3 / disruptive (classify in 0.7) |
| Connect new runtime to prod `mastra` | After gold test on preview |
| Copy production data into `ipix-v2` | Never for convenience |

---

## Suggested PRs (AGENTS.md: one concern)

| PR | Contains |
|----|----------|
| A | 0.1 SQL only (`get_brand_assets` grants) |
| B | 0.2 audit markdown (or same as A if tiny) |
| C | 0.8 default privileges **for creating roles** (apply on preview first) |
| D | 0.4 revoke leftover table grants + comment |
| E | 0.5 + 0.6 docs (no prod data) |
| Dashboard | 0.3 Auth leaked-password (no git) |
| F | 0.9 search_path for the three advisor functions |
| G | 0.7 test harness + **classified advisor register** |
| Ops | 0.10 create persistent branch; record URLs + cost note |
| H | 0.11 seed SQL **preview-only** |

---

## Success bar

Wave 0 is done when:

- anon cannot EXECUTE `get_brand_assets`; Org A OK; Org B denied
- DEFINER RPCs audited with the 0.2 matrix (not mass-deleted)
- leaked-password protection on
- deny-all tables documented; no fake policies
- `shoot.shoots` named in new-plan
- JWT-off Edge gates recorded
- default EXECUTE fail-closed **for the creating role**, proven on preview
- three mutable `search_path` functions locked; triggers still stamp
- **zero unexplained P0/P1**; remaining advisor notices classified
- **preview branch `ipix-v2` exists** (empty of prod data, billable compute noted)
- **deterministic Org A / Org B seed** applied on preview
- nobody pointed the starter at production Mastra
