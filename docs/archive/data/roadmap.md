---
title: Data / Supabase — product roadmap
horizon: Now / Next / Later
checked: 2026-09-01
ssot_status: live Linear IPI-1075
---

# Data / Supabase — roadmap

Season board, not a calendar. Status: live Linear — epic **[IPI-1075 · SUPABASE-EPIC — Make iPix User Accounts, Data, and AI Memory Safe and Reliable](https://linear.app/amo100/issue/IPI-1075)**. Runtime parent: **[IPI-1078 · IPI-EPIC · MASTRA COPILOTKIT — Secure Planner Runtime Sequence](https://linear.app/amo100/issue/IPI-1078)**.

Mint: [todo.md](./todo.md). Product: [prd.md](./prd.md). Check-off sequence: [tasks.md](./tasks.md). Whole-app: [docs/roadmap.md](../../roadmap.md).

**Mint:** create **0** extra tickets for hosted Postgres, Brand Knowledge, dual-write shoots, or “missing `@mastra/pg`.” **IPI-1124–1128** already exist. Do **not** reopen **IPI-1043 / 1044 / 1037 / 1046**.

August pack assumed no usable Postgres adapter and pending AUTH. **Current `main` already has the store.** Prove the hosted path.

---

## Now (Core critical path — sequential)

Do **not** restart DB-001 / PG-001.

```text
1042 fingerprint vs @mastra/pg@1.22.2
       ↓
1009 stream + Stop (Vercel/Node — not Cloudflare)
       ↓
1124 hosted Postgres TEST-<uuid> recycle
       ↓
1125 two isolated QA orgs
       ↓
1126 exact-SHA Vercel Preview
       ↓
1045 authenticated stream (if still open after 1009)
       ↓
1047 hosted Org B 403
       ↓
1127 atomic cross-instance claim
       ↓
1050 memory + 1088 replay
       ↓
1051 one authenticated Planner screen
       ↓
1031 hosted synthetic Core
       ↓
1041 Core certification
```

| Initiative | Why | Linear (2026-09-01) |
| --- | --- | --- |
| Live schema fingerprint | PR #25 merged ≠ Done | **IPI-1042 · RUNTIME-001** 🟡 — resolve `mastra_workflow_snapshot` no-PK vs installed adapter |
| Stream / Stop / tenant abort | Upgrade certification | **IPI-1009 · MASTRA-UPG-004** ⚪ — Journey D persistence **N/A** until 1124 |
| Hosted memory | Highest persistence gate | **IPI-1124 · MASTRA-HOST-PG-001** 🟡 — run existing proof scripts, do not rebuild store |
| QA identities | Hosted Org A/B needs two users | **IPI-1125 · QA-ORG-001** ⚪ |
| Exact SHA on Vercel | Preview must match tested commit | **IPI-1126 · HOST-PREVIEW-001** ⚪ |
| Auth stream | Identity before SSE | **IPI-1045 · STREAM-001** 🟡 |
| Cross-org deny | ACL + tests on **open PR #23** (not `main`); hosted Org B 403 still missing | **IPI-1047 · ACCESS-001** 🟡 |
| Atomic claim | Process-local first-create is not multi-instance | **IPI-1127 · ACCESS-CLAIM-001** ⚪ — **blocks IPI-1091** |

## Now (parallel — do not block runtime)

| Initiative | Why | Linear |
| --- | --- | --- |
| HIBP | Advisor still disabled | **IPI-863 · AUTH-V2-001** 🔵 **do now** |
| Planner default ACL | Staging applied; **production not applied** | **IPI-897 · SB-SEC-009** 🟣 In Review — finish approved prod proof |
| Advisor register | Refresh from **today’s** lints | **IPI-1039 · SB-V2-003** ⚪ — no mass-revoke DEFINER |
| Forward migrations | History alignment, not Brand product | **IPI-1040 · MIGRATION-001** 🟡 |

## Next (after Core proof)

```text
IPI-1050 · MEM-001
        ↓
IPI-1088 · COPILOT-REPLAY-001
        ↓
IPI-1051 · UI-001
        ↓
IPI-1031 · CORE-HOST-REF
        ↓
IPI-1041 · CORE-001
```

Then product (not a DB rebuild):

**Brand:** **IPI-1093 · BRAND-INTEL-001** (draft → human → `brands.ai_profile`) → **IPI-1128 · BRAND-KNOWLEDGE-001** (cited pgvector; similarity ≠ auth). **No extra Brand Knowledge ticket.**

**Shoot:** **IPI-1067 · SHOOT-001** → **IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan** → **IPI-1084 · APPROVAL-001** → **IPI-1083 · SHOOT-SAVE-001** → **IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot**. Canonical `shoot.shoots` only.

**Release:** **IPI-1091 · RELEASE-001** only after [tasks.md](./tasks.md) production checklist.

## Later

| Spec | When | Notes |
| --- | --- | --- |
| Hot-table `(select auth.uid())` | After 1039 classify | Initplan lint — do not rewrite all policies at once |
| Index `brand_graph_edges(target_node_id)` | When reverse-graph queries are real | Do not bulk-index unindexed FKs |
| Index `processed_firecrawl_webhooks(crawl_id)` | Same | Query-critical only |
| Relocate extensions out of `public` | IPI-1040 investigation | Temporary accept until proven safe |
| PK on `mastra_workflow_snapshot` | Never “because advisor” | Installed Mastra schema is authority |
| Cloudflare Workers host | **IPI-1121** | Not this Core path |

Check-off: [todo.md](./todo.md) · [tasks.md](./tasks.md).
