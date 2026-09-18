---
title: Data / Supabase — tracker
checked: 2026-09-01
ssot_status: live Linear IPI-1075
ssot_mint: docs/data/todo.md
---

# Data / Supabase — tracker

**How to use:** Work **fingerprint → hosted Postgres → Preview → tenant deny → atomic claim**. Parallel security does not wait for Core, but Core does not wait for advisor green.  
**Status SSOT:** live Linear — [**IPI-1075 · SUPABASE-EPIC**](https://linear.app/amo100/issue/IPI-1075) · [**IPI-1078 · MASTRA COPILOTKIT**](https://linear.app/amo100/issue/IPI-1078)  
**Mint SSOT:** this file (**0** new IPIs on 2026-09-01).  
**Specs:** [prd.md](./prd.md) · [roadmap.md](./roadmap.md) · [tasks.md](./tasks.md) · runbooks: [supabase/ipi-1040-forward-migrations.md](../../data/supabase/ipi-1040-forward-migrations.md) · [supabase/security-advisor-register.md](../../data/supabase/security-advisor-register.md)

If this file disagrees with Linear, **Linear wins**. If it disagrees with **Do not add**, **this file wins** on mint.

**Linear action:**

| Action | Meaning |
| --- | --- |
| **Exists — execute** | Ticket is live. Do the work. |
| **Exists — prove hosted** | Code likely exists. Finish live/preview evidence. |
| **Closed — do not restart** | Done. Remaining proof lives on a **later** ticket. |
| **Do not add** | Invented name. Use the mapped live ticket. |

**Legend:** 🟢 Done · 🟡 In Progress · 🟣 In Review · 🔵 Todo · ⚪ Backlog

Host: **Vercel**. Split `dev:ui` / `dev:agent`. No production Supabase writes unless the named ticket says so. Repo: **amoai-tech/ipixai**.

Checked Linear **2026-09-01:** **IPI-1043 / 1044 / 1037 / 1046** 🟢 · **IPI-1042 / 1124 / 1045 / 1047 / 1040** 🟡 · **IPI-897** 🟣 · **IPI-863** 🔵 · **IPI-1009 / 1125 / 1126 / 1127 / 1128 / 1039** ⚪.

---

## Next (do this)

1. **[IPI-1042 · RUNTIME-001 — Make the New iPix AI Runtime Compile and Build Cleanly](https://linear.app/amo100/issue/IPI-1042)** — 🟡 **Exists — execute**. Post-merge fingerprint vs `@mastra/pg@1.22.2`.  
2. **[IPI-1124 · MASTRA-HOST-PG-001 — Run Mastra Memory on Shared Supabase Postgres in Hosted iPix](https://linear.app/amo100/issue/IPI-1124)** — 🟡 **Exists — prove hosted**. After 1009 stream/Stop as required by Linear.  
3. **[IPI-863 · AUTH-V2-001 — Block Known Leaked Passwords for iPix Accounts](https://linear.app/amo100/issue/IPI-863)** — 🔵 **Exists — execute** in parallel (Dashboard/API; not a migration).

---

## Core path

```text
1042 → 1009 → 1124 → 1125 → 1126 → 1045 → 1047 → 1127
     → 1050 → 1088 → 1051 → 1031 → 1041
```

| Status | Task | Linear action | Phase |
| :---: | --- | --- | --- |
| 🟡 | **[IPI-1042 · RUNTIME-001 — Make the New iPix AI Runtime Compile and Build Cleanly](https://linear.app/amo100/issue/IPI-1042)** | Exists — execute (fingerprint) | Core |
| 🟢 | **[IPI-1043 · DB-001 — Prove Mastra Can Use the iPix Postgres Schema Safely](https://linear.app/amo100/issue/IPI-1043)** | Closed — do not restart | Core |
| 🟢 | **[IPI-1044 · PG-001 — Make iPix AI Conversations Survive Server Restarts](https://linear.app/amo100/issue/IPI-1044)** | Closed — do not restart | Core |
| 🟢 | **[IPI-1037 · AUTH-001 — Let Real iPix Users Sign In Before Using the AI Planner](https://linear.app/amo100/issue/IPI-1037)** | Closed — do not restart | Core |
| 🟢 | **[IPI-1046 · AUTH-002 — Keep Every iPix User Inside the Correct Organization](https://linear.app/amo100/issue/IPI-1046)** | Closed — do not restart | Core |
| ⚪ | **[IPI-1009 · MASTRA-UPG-004 — Verify CopilotKit Streaming, Stop, Tenant Isolation, and Runtime After Mastra Upgrade](https://linear.app/amo100/issue/IPI-1009)** | Exists — execute | Core |
| 🟡 | **[IPI-1124 · MASTRA-HOST-PG-001 — Run Mastra Memory on Shared Supabase Postgres in Hosted iPix](https://linear.app/amo100/issue/IPI-1124)** | Exists — prove hosted | Core |
| ⚪ | **[IPI-1125 · QA-ORG-001 — Provision Two Isolated QA Organizations and Users for Cross-Org Planner Proof](https://linear.app/amo100/issue/IPI-1125)** | Exists — execute | Core |
| ⚪ | **[IPI-1126 · HOST-PREVIEW-001 — Deploy an Exact iPix PR SHA to a Vercel Preview](https://linear.app/amo100/issue/IPI-1126)** | Exists — execute | Core |
| 🟡 | **[IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely](https://linear.app/amo100/issue/IPI-1045)** | Exists — execute | Core |
| 🟡 | **[IPI-1047 · ACCESS-001 — Stop One Organization From Opening Another Organization’s Planner Thread](https://linear.app/amo100/issue/IPI-1047)** | Exists — merge [PR #23](https://github.com/amoai-tech/ipixai/pull/23) + hosted generic 403 | Core |
| ⚪ | **[IPI-1127 · ACCESS-CLAIM-001 — Make Planner Thread Ownership an Atomic Shared Claim](https://linear.app/amo100/issue/IPI-1127)** | Exists — execute (blocks RELEASE) | Core |
| ⚪ | **[IPI-1050 · MEM-001 — Let the Planner Remember the Conversation After Refresh and Restart](https://linear.app/amo100/issue/IPI-1050)** | Exists — execute after 1124 | Core |
| ⚪ | **[IPI-1088 · COPILOT-REPLAY-001 — Reload the Planner UI from the saved conversation after refresh](https://linear.app/amo100/issue/IPI-1088)** | Exists — execute | Core |
| ⚪ | **[IPI-1051 · UI-001 — Let an iPix Operator Use the Planner in One Simple Authenticated Screen](https://linear.app/amo100/issue/IPI-1051)** | Exists — execute | Core |
| ⚪ | **[IPI-1031 · CORE-HOST-REF — Hosted synthetic Core proof on existing project (not a second preview)](https://linear.app/amo100/issue/IPI-1031)** | Exists — execute | Core |
| ⚪ | **[IPI-1041 · CORE-001 — Prove the New iPix AI Foundation Survives Refresh, Restart, and Cross-Org Access Attempts](https://linear.app/amo100/issue/IPI-1041)** | Exists — execute | Core |

---

## Parallel security / migrations

| Status | Task | Linear action |
| :---: | --- | --- |
| 🔵 | **[IPI-863 · AUTH-V2-001 — Block Known Leaked Passwords for iPix Accounts](https://linear.app/amo100/issue/IPI-863)** | Exists — execute now |
| 🟣 | **[IPI-897 · SB-SEC-009 — Lock Down Default Planner Privileges for New Tables](https://linear.app/amo100/issue/IPI-897)** | Exists — production proof (not a new ticket) |
| ⚪ | **[IPI-1039 · SB-V2-003 — Give Every Supabase Security Warning an Owner and Clear Action](https://linear.app/amo100/issue/IPI-1039)** | Exists — execute (classify; no mass-revoke) |
| 🟡 | **[IPI-1040 · MIGRATION-001 — Prove New iPix Database Changes Can Be Added Without Replaying Old Migrations](https://linear.app/amo100/issue/IPI-1040)** | Exists — execute |

---

## Brand / shoot (after Core, or when Linear unblocks)

| Status | Task | Linear action |
| :---: | --- | --- |
| ⚪ | **[IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile](https://linear.app/amo100/issue/IPI-1093)** | Exists — execute; no extra approval ticket |
| ⚪ | **[IPI-1128 · BRAND-KNOWLEDGE-001 — Give AI Decisions Approved Brand Evidence With Citations](https://linear.app/amo100/issue/IPI-1128)** | Exists — execute after 1093; **Do not add** a second Knowledge IPI |
| ⚪ | **[IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records](https://linear.app/amo100/issue/IPI-1067)** | Exists — `shoot.shoots` only |
| ⚪ | **[IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan](https://linear.app/amo100/issue/IPI-1081)** | Exists — execute |
| ⚪ | **[IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved](https://linear.app/amo100/issue/IPI-1084)** | Exists — execute |
| ⚪ | **[IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization](https://linear.app/amo100/issue/IPI-1083)** | Exists — execute |
| ⚪ | **[IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot](https://linear.app/amo100/issue/IPI-1085)** | Exists — execute |
| ⚪ | **[IPI-1091 · RELEASE-001 — Deploy the New iPix App to Vercel and Prove the Complete Production Journey](https://linear.app/amo100/issue/IPI-1091)** | Exists — after Core checklist |

---

## Do not add

| Invented | Use instead |
| --- | --- |
| New Mastra storage design / second hosted Supabase | **IPI-1124** |
| Brand Knowledge v2 ticket | **IPI-1128** |
| Dual-write `public.shoots` | **IPI-1083** + canonical `shoot.shoots` |
| Snapshot PK “because advisor” | **IPI-1042** fingerprint first |
| Mass-revoke DEFINER RPCs | **IPI-1039** classify |
| Replay `docs/data/00`–`11` as SQL | Evidence only |

---

## Red flags (keep visible)

1. Hosted persistence proof incomplete (**IPI-1124**).  
2. Thread ACL is **not on `main`** — [PR #23](https://github.com/amoai-tech/ipixai/pull/23) is **OPEN**; hosted Org B proof still missing (**IPI-1047**).  
3. Cross-instance first-create not atomic (**IPI-1127**).  
4. Leaked-password protection still off (**IPI-863**).  
5. Broad DEFINER surface — classify, do not blanket-revoke (**IPI-1039**).  
6. `mastra_workflow_snapshot` no PK — Mastra source wins, not the advisor.  
7. Many performance lints — not Core blockers; no bulk index drop/add.
