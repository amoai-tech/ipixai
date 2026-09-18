# 23 — Concise Supabase verdict (live recheck)

Status: Complete (01–20 + [21](./21-fix-plan.md) + [22](./22-fix-plan.md); **fourth pass** 2026-09-01 — Cursor execution + PR #23 CONFLICTING)  
Project: `fashionos` / `nvdlhrodvevgwdsneplk` — **ACTIVE_HEALTHY**, Postgres 17.6.1.052  

**Current production readiness: 67/100.**  
**Architecture: 87/100.**  
**Security: 73/100.**  
**Verification confidence: 90/100.**  
**Will it succeed? Yes — if the existing Core proof chain is completed.**

The fix plans are **directionally correct**. Follow them. Remaining work is **proof, RPC authorization, and wiring** — not a schema rebuild.

Prior passes: 20 = 63 · this file first write = 64 · advisor/order pass = 66. **67** is current SSOT (Mastra store on `main` scored higher; weather-agent gap scored product wiring lower).

Official docs (this session, Context7 `/websites/supabase` + Mastra `@mastra/pg`):

- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) — grants **and** policies; `(select auth.uid())`. RLS does **not** wrap function execution.
- [Database functions](https://supabase.com/docs/guides/database/functions) — DEFINER should be exceptional; pin `search_path` (`set search_path = ''` + schema-qualify).
- [Password security](https://supabase.com/docs/guides/auth/password-security) — HIBP, **Pro+**.
- [Connect / serverless](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers) — transaction pooler **6543**; prepared statements unsupported.
- Mastra `disableInit: true` — skips automatic table creation/migrations (CI/CD / least-privilege runtime).

---

## Live verification (advisors this pass)

`get_advisors` security: **43** lints, **0 ERROR**.

| Lint | n | Action |
| --- | ---: | --- |
| `authenticated_security_definer_function_executable` WARN | **34** | Classify + negative-test. Do **not** mass-revoke. |
| `rls_enabled_no_policy` INFO | **5** | Keep fail-closed / deprecated. **Do not add policies to clear the linter.** |
| `extension_in_public` WARN | **3** | `vector`, `pg_trgm`, `btree_gist` — accept for now |
| `auth_leaked_password_protection` WARN | **1** | HIBP still **OFF** (P2; dashboard) |

The five no-policy tables: `chatbot_conversations`, `chatbot_messages`, `chatbot_events`, `media_size_specs`, `processed_firecrawl_webhooks`.

Row counts from prior pass still hold: `public.shoots` 8 / `shoot.shoots` 4; threads 50; messages **119**; snapshots 6140; triggers 6078; migrations 309.

**Mastra on current `main` is strong — do not redesign:** approved project hardcoded, runtime role `hyperdrive_mastra_runtime`, hosted fail-closed (no LibSQL), unsafe TLS rejected, CA verify, hosted pool **max = 1**, singleton pool/store, `schemaName: "mastra"`, `disableInit: true`.

**Agent:** still starter **`weather-agent`**. Prove persist/security first; replace later.

**Shoot grep caveat:** `from("shoots")` is **not** enough. Clients can `.schema("public"|"shoot")` then `.from("shoots")`. Audit **25** must be schema-aware.

---

## Biggest blockers

| Pri | Problem | Smallest fix |
| --- | --- | --- |
| P1 | Mastra live schema vs `@mastra/pg` fingerprint unfinished | **IPI-1042 · RUNTIME-001** |
| P1 | Hosted persistence not proven | **IPI-1124 · MASTRA-HOST-PG-001** |
| P1 | Cross-org thread deny not proven | QA **IPI-1125** + **IPI-1047**. **[PR #23](https://github.com/amoai-tech/ipixai/pull/23) is `mergeable: CONFLICTING` / `DIRTY`** — rebase **before** hosted 403 + merge |
| P1 | First-create thread race | **IPI-1127 · ACCESS-CLAIM-001** |
| P1 | Live/repo migration split | **IPI-1040 · MIGRATION-001** — never `repair` |
| P1 | DEFINER bodies not fully classified / negative-tested | **IPI-1039 · SB-V2-003** + audit **24** |
| P2 | HIBP disabled | **IPI-863 · AUTH-V2-001** (Pro+) |
| P2 | Dual shoot models | Schema-aware proof V2 uses `shoot.shoots` — do not DROP |
| P2 | Production Planner agent not registered | Replace weather **after** Core proofs |

---

## Important correction — dual shoot

**Dual shoot tables are a risk. Their existence alone is not a production blocker.**

The real blocker is:

> Any current V2 code writing or reading `public.shoots` when it should use `shoot.shoots`.

Today a naive `from("shoots")` grep is **empty** in ipixai `src/` — **not sufficient**. Clients can `.schema(...)` first. Audit **25** must record **which schema** each query uses.

You **cannot** DROP `public.shoots` without migrating FKs: `assets.shoot_id` CASCADE, `crm_deals.shoot_id` NO ACTION, `commerce_product_links.shoot_id` SET NULL, plus `public.shoot_*`.

---

## Security

RLS foundation is good (**145/145 enabled**). **RLS enabled ≠ secure.** Grants + policies work together; policies should be explicit per command; wrap `(select auth.uid())` when editing.

Highest-value security work:

1. Open every authenticated-executable `SECURITY DEFINER` body.  
2. Prove `auth.uid()` + org checks.  
3. Prove pinned `search_path`.  
4. Prove no service-role / secret in the browser.  
5. Enable leaked-password protection (Pro+).  

Do **not** mass-revoke DEFINER or rewrite hundreds of FashionOS policies.

**RLS foundation: 91/100.** **RPC/function security: 69/100.** **Overall security: 73/100.**

DEFINER is **not inherently wrong** (Planner / booking / shoot writes). Highest-value remaining DB audit: bodies + negative tests (own org / other org / outsider). Focus: planner mutations, shoot save/commit, booking, CRM convert, shortlist, notifications, org helpers.

---

## Mastra

```text
CopilotKit (user JWT)
  → org_members → resourceId
  → Mastra
  → PostgresStore (schemaName: "mastra", disableInit: true)
  → mastra.*
```

Design is strong. The gap is **proof**. Hosted Vercel should try transaction pooler **6543** first; disable prepared statements if the pooler rejects them.

This repo’s registered agent is still starter **weather-agent** — product planner tools come **after** persist + ACL proofs.

**Mastra implementation: 94/100.** **Hosted persistence proof: 62/100.** **Tenant isolation proof: 64/100.**

---

## Faster path — fix by journey, not by table

### Phase A — Core release (before Brand/Shoot UI)

Three lanes (do not wait for the whole serial queue):

```text
LANE 1  A1 fingerprint → A2 stream/Stop tests → A3 persist → A4 QA orgs
        → A6 exact-SHA Preview → A5 hosted 403 + rebase/merge PR #23
        → A7 stream proof → A8 atomic claim → A9 refresh → Planner → UI → cert

LANE 2  NOW: HIBP · DEFINER bodies (24) · schema-aware map (25) · migration analysis · webhook re-probe

LANE 3  After Core: Brand → Campaign → Shoot HITL → Talent → Assets → Publishing
```

**Cursor now vs wait:** A1 + A2 + 24 + 25 + PR #23 conflict analysis **now**. Hosted 403 **waits** on QA users + Preview + **rebased** PR branch. Production Planner **waits** on persist + tenant security.

PR #23 conflicts (`origin/main` vs `2a29ffc`): `src/app/api/copilotkit/[[...slug]]/route.ts` (thread-persistence vs local `scopedThreadId`) and `tests/stream-001.test.ts`. Adds `thread-acl.ts` + `access-001.test.ts`. **Do not merge until rebase + targeted tests.**

Outcome: **Sign in → chat works → refresh works → recycle works → Org B cannot see Org A.**

Maps to [21-fix-plan](./21-fix-plan.md) Lane A.

### Phase B — Security (parallel with A after A1)

HIBP → planner default privileges → DEFINER body audit → RLS initplan only on touched/hot policies → webhook HMAC negative tests.

Maps to 21 Lane B.

### Phase C — Canonical data paths (code first)

```text
organizations → brands → campaigns → shoot.shoots → talent.* → assets / Cloudinary
```

Resolve every legacy dependency **intentionally**. Do not delete `public.shoots` while FKs remain.

Maps to 21 Lane C + [22-fix-plan](./22-fix-plan.md) P1–P2.

### Phase D — Product MVP (after Core)

```text
Brand URL → approved Brand DNA → campaign
  → AI shoot draft → human approval → shoot.shoots → talent → assets
```

Pipeline occupancy today: crawl yes; **scores / intake / graph / gates / bookings empty**.

### Phase E — Post-MVP

Commerce, publishing, CRM expansion, EventOS retirement, Mastra evals, retention (audit **28**).

---

## Follow-on audits (numbering)

**21** and **22** in this folder are **fix plans**, not new inventory steps. **This file is 23 (verdict).** Do not overwrite them with the names below.

| File | What | When |
| --- | --- | --- |
| [24-security-definer-deep-audit.md](./24-security-definer-deep-audit.md) | Bodies started; negatives still **UNVERIFIED** | **Highest-value remaining Supabase audit** |
| [25-code-database-dependency-map.md](./25-code-database-dependency-map.md) | Schema-aware map on `origin/main`: V2 `src/` has **no** shoot/task/talent queries | Settles legacy SoT for this repo |
| [26-edge-webhook-security.md](../../../data/audit/26-edge-webhook-security.md) | Re-probe HMAC; do not rebuild if 685/692 still hold | Phase B |
| [27-hosted-core-proof.md](../../../data/audit/27-hosted-core-proof.md) | login → stream → Stop → persist → restart → reload → Org B deny → concurrent claim | Moves verification ~49 → 90+ |
| [28-retention-observability.md](../../../data/audit/28-retention-observability.md) | Snapshots 6140, triggers 6078, logs, backups | **After Core** |

Those files: **24** and **25** are started. **26–28** are not written yet. Do not mint Linear issues for the filenames.

---

## Production-ready success criteria (Core)

- [ ] Installed Mastra storage fingerprint matches live schema
- [ ] `schemaName = mastra` and `disableInit = true`
- [ ] Hosted runtime never falls back to LibSQL; TLS + runtime role verified
- [ ] Transaction pooler **6543** tested (or documented fallback)
- [ ] Thread survives process restart
- [ ] Exact deployed SHA recorded **before** ACL proof
- [ ] Stop terminates the correct tenant SSE
- [ ] Org B generic 403, zero Org A data
- [ ] Concurrent first-create → one owner
- [ ] Refresh replays the same conversation
- [ ] HIBP enabled
- [ ] Planner default privileges safe
- [ ] High-risk DEFINER RPCs negative-tested
- [ ] Unsigned/bad-signature webhooks cannot write
- [ ] V2 uses canonical `shoot.shoots` (schema-aware)
- [ ] Shoot reject = zero durable writes
- [ ] Forward migrations only (never repair)
- [ ] No browser service-role credentials
- [ ] Targeted tests + `tsc --noEmit` + `npm run build` green
- [ ] Authenticated browser Core journey on that SHA green

---

## Scores (this verdict)

| Area | Score |
| --- | ---: |
| Architecture | **87/100** |
| Schema design | **85/100** |
| Relationships | **77/100** |
| RLS foundation | **91/100** |
| RPC/function security | **69/100** |
| Authentication | **82/100** |
| Mastra implementation | **94/100** |
| Hosted persistence proof | **62/100** |
| Tenant isolation proof | **64/100** |
| Migration safety | **65/100** |
| Agent/product wiring | **55/100** |
| Production verification | **49/100** |
| **Overall readiness** | **67/100** |

---

## Summary

- **Best decision:** follow [21](./21-fix-plan.md) / [22](./22-fix-plan.md); no database or Mastra-store rebuild.
- **Main blocker:** production proof, not missing tables.
- **Main security gap:** authenticated DEFINER review + negative tests (not mass-revoke).
- **Main product gap:** starter **weather-agent** still registered.
- **Missing proofs:** DEFINER negatives · hosted recycle · Org B 403 · licensed CopilotKit runner test · HIBP.
- **Main new issue:** PR #23 **CONFLICTING** — rebase, do not merge.
- **Next action:** finish A1 typecheck/build on `origin/main` · licensed-branch Stop test · rebase PR #23 · Lane 2 HIBP.
- **Will it succeed:** **Yes, with conditions — 87/100 architecture.**

**Correctness confidence: 90/100** on advisors + `pg-store.ts` this pass. Hosted recycle / Org B / HMAC remain **UNVERIFIED** in browser.
