---
title: Data / Supabase — Core task sequence
checked: 2026-09-01
ssot_status: live Linear
---

# Data / Supabase — tasks

**How to use:** this is the **execution order**. Status and titles live in Linear. Do **not** mint tickets from this page.

Product: [prd.md](./prd.md) · board: [roadmap.md](./roadmap.md) · tracker: [todo.md](./todo.md).

**Policy:** 0 new Linear issues. Finish the proof chain.

```text
Stop adding architecture. Prove the existing path.
```

---

## Closed — do not restart

| Linear | Why closed |
| --- | --- |
| **[IPI-1043 · DB-001 — Prove Mastra Can Use the iPix Postgres Schema Safely](https://linear.app/amo100/issue/IPI-1043)** | **Done** — catalog/matrix work. Remaining fingerprint is **IPI-1042** post-merge. |
| **[IPI-1044 · PG-001 — Make iPix AI Conversations Survive Server Restarts](https://linear.app/amo100/issue/IPI-1044)** | **Done** — store wired. Hosted recycle proof is **IPI-1124**. |
| **[IPI-1037 · AUTH-001 — Let Real iPix Users Sign In Before Using the AI Planner](https://linear.app/amo100/issue/IPI-1037)** | **Done** |
| **[IPI-1046 · AUTH-002 — Keep Every iPix User Inside the Correct Organization](https://linear.app/amo100/issue/IPI-1046)** | **Done** |

---

## NOW — Core (in order)

1. **[IPI-1042 · RUNTIME-001 — Make the New iPix AI Runtime Compile and Build Cleanly](https://linear.app/amo100/issue/IPI-1042)** — PR #25 merged. Finish **live** `mastra.*` vs installed `@mastra/pg@1.22.2`. Do **not** add a snapshot PK because the advisor says so.
2. **[IPI-1009 · MASTRA-UPG-004 — Verify CopilotKit Streaming, Stop, Tenant Isolation, and Runtime After Mastra Upgrade](https://linear.app/amo100/issue/IPI-1009)** — stream + Stop on Vercel/Node. Persistence journey honest N/A until 1124.
3. **[IPI-1124 · MASTRA-HOST-PG-001 — Run Mastra Memory on Shared Supabase Postgres in Hosted iPix](https://linear.app/amo100/issue/IPI-1124)** — `TEST-<uuid>` write → recycle → same messages. Use **existing** proof scripts.
4. **[IPI-1125 · QA-ORG-001 — Provision Two Isolated QA Organizations and Users for Cross-Org Planner Proof](https://linear.app/amo100/issue/IPI-1125)** — two orgs on the **same** project; no second Supabase.
5. **[IPI-1126 · HOST-PREVIEW-001 — Deploy an Exact iPix PR SHA to a Vercel Preview](https://linear.app/amo100/issue/IPI-1126)** — certify the tested SHA on project `ipixai`.
6. **[IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely](https://linear.app/amo100/issue/IPI-1045)**
7. **[IPI-1047 · ACCESS-001 — Stop One Organization From Opening Another Organization’s Planner Thread](https://linear.app/amo100/issue/IPI-1047)** — merge **open [PR #23](https://github.com/amoai-tech/ipixai/pull/23)** (ACL + tests, **not on `main` yet**) then hosted Org B **generic 403** (`thread_forbidden`); zero tenant leak — not an empty body.
8. **[IPI-1127 · ACCESS-CLAIM-001 — Make Planner Thread Ownership an Atomic Shared Claim](https://linear.app/amo100/issue/IPI-1127)** — unique `thread_id` + `INSERT … ON CONFLICT DO NOTHING`. Blocks production release.

Then:

9. **[IPI-1050 · MEM-001 — Let the Planner Remember the Conversation After Refresh and Restart](https://linear.app/amo100/issue/IPI-1050)**
10. **[IPI-1088 · COPILOT-REPLAY-001 — Reload the Planner UI from the saved conversation after refresh](https://linear.app/amo100/issue/IPI-1088)**
11. **[IPI-1051 · UI-001 — Let an iPix Operator Use the Planner in One Simple Authenticated Screen](https://linear.app/amo100/issue/IPI-1051)**
12. **[IPI-1031 · CORE-HOST-REF — Hosted synthetic Core proof on existing project (not a second preview)](https://linear.app/amo100/issue/IPI-1031)**
13. **[IPI-1041 · CORE-001 — Prove the New iPix AI Foundation Survives Refresh, Restart, and Cross-Org Access Attempts](https://linear.app/amo100/issue/IPI-1041)**

---

## Parallel (Supabase lane)

- **[IPI-863 · AUTH-V2-001 — Block Known Leaked Passwords for iPix Accounts](https://linear.app/amo100/issue/IPI-863)** — enable HIBP now.
- **[IPI-897 · SB-SEC-009 — Lock Down Default Planner Privileges for New Tables](https://linear.app/amo100/issue/IPI-897)** — In Review; production apply still required.
- **[IPI-1039 · SB-V2-003 — Give Every Supabase Security Warning an Owner and Clear Action](https://linear.app/amo100/issue/IPI-1039)** — refresh register; classify DEFINER one-by-one.
- **[IPI-1040 · MIGRATION-001 — Prove New iPix Database Changes Can Be Added Without Replaying Old Migrations](https://linear.app/amo100/issue/IPI-1040)** — forward-only; never repair 309 vs local.

---

## Brand (no schema rebuild)

1. **[IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile](https://linear.app/amo100/issue/IPI-1093)**
2. **[IPI-1128 · BRAND-KNOWLEDGE-001 — Give AI Decisions Approved Brand Evidence With Citations](https://linear.app/amo100/issue/IPI-1128)** — already exists; do not mint another.

---

## Shoot (canonical `shoot.shoots`)

1. **[IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records](https://linear.app/amo100/issue/IPI-1067)**
2. **[IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan](https://linear.app/amo100/issue/IPI-1081)**
3. **[IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved](https://linear.app/amo100/issue/IPI-1084)**
4. **[IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization](https://linear.app/amo100/issue/IPI-1083)**
5. **[IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot](https://linear.app/amo100/issue/IPI-1085)**

---

## Before **IPI-1091 · RELEASE-001**

- [ ] IPI-1042 package ↔ live `mastra.*` fingerprint
- [ ] No runtime Mastra DDL
- [ ] IPI-1009 stream + Stop
- [ ] IPI-1124 hosted recycle of `TEST-<uuid>`
- [ ] TLS verified; `hyperdrive_mastra_runtime` only
- [ ] No browser role on Mastra schema
- [ ] IPI-1125 two isolated QA orgs
- [ ] IPI-1126 exact SHA on Vercel Preview
- [ ] [PR #23](https://github.com/amoai-tech/ipixai/pull/23) merged
- [ ] IPI-1047 Org B → generic HTTP 403; **zero** tenant-data leak
- [ ] IPI-1127 one winner on concurrent first claim
- [ ] IPI-1050 + IPI-1088 refresh/restart
- [ ] IPI-863 HIBP on
- [ ] IPI-897 production default-ACL proof
- [ ] IPI-1039 every warning classified
- [ ] IPI-1040 forward-only without replay/repair
- [ ] IPI-1031 + IPI-1041 Core proofs
- [ ] Brand cannot self-approve; shoot reject = zero writes; save idempotent to `shoot.shoots` only
- [ ] CI, typecheck, tests, build, authenticated browser on the release SHA
