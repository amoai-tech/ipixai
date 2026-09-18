# MIGRATE · Dash / backend patch specs

**Folder:** `docs/MIGRATE/tasks/dash-backend/`  
**Executable order:** [`../todo.md`](../todo.md)  
**Do not mutate Linear until approved** (except applied addenda noted below).  
Lane index: [`../marketing/README.md`](../marketing/README.md) · Parent: [`../README.md`](../README.md)

## Start order (Dashboard first)

```text
0. APP-001 certify on current main → Done     (hard gate; do not redesign)
1. DASH-MAIN-001                              (/app — FIRST product screen; no Brand/Shoot UI gate)
2. BRAND-001
3. SHOOT-001
4. IPI-1140 Intelligence Rail                 (soft after Dashboard + loaders)
5. ASSETS-001 → CRM → OPS → TALENT → PLANS → ANALYTICS
6. AI (∥): PLANNER → TOOL; BRAND-INTEL after Brand
7. M3: PLAN → APPROVAL → SAVE → WIZARD → CONTEXT
```

**Why Dashboard first:** it reads `public.brands` / `shoot.shoots` / planner tables via trusted org directly. Waiting for Brand/Shoot UI was a soft optimization only.  
Marketing pages are **not** a start blocker for this lane.

## Faster / better first steps

```text
After APP-001 certify
├─ DASH-MAIN-001 fills /app center (nav label → Dashboard)  ← START
├─ then BRAND-001 → SHOOT-001
└─ IPI-1140 · INTELLIGENCE-RAIL-001 — soft after; not IPI-1024

AI (parallel; does not block Dashboard)
├─ PLANNER-001 → TOOL-001
└─ BRAND-INTEL-001 after Brand UI (hard: APP + AUTH-002 only)

Wave B — after spine (solo serial tip below)
└─ ASSETS · CRM · OPS · TALENT · PLANS · ANALYTICS

M3 launch
├─ PLAN → APPROVAL → SAVE → WIZARD
└─ PLANNER-CONTEXT (drop SAVE hard block if still live)

External
└─ AI-EVIDENCE · UI-001
```

**Solo serial tip:** Dashboard → Brand → Shoot → Rail → Assets → CRM → Ops → Talent → Plans → Analytics.

## Spec index

| Task | File | Notes |
| --- | --- | --- |
| IPI-1065 · APP-001 | [`IPI-1065-APP-001.md`](./IPI-1065-APP-001.md) | **Certify only** — shell merged |
| IPI-1066 · DASH-MAIN-001 | [`IPI-1066-Dash-main.md`](./IPI-1066-Dash-main.md) | **START HERE** after APP · `/app` · not marketing home |
| IPI-1068 · BRAND-001 | [`IPI-1068-BRAND-001.md`](./IPI-1068-BRAND-001.md) | After Dashboard · data-first · `/app/brands` · Linear ✅ |
| IPI-1067 · SHOOT-001 | [`IPI-1067-SHOOT-001.md`](./IPI-1067-SHOOT-001.md) | After Brand · direct-detail-first · Linear ✅ |
| IPI-1140 · INTELLIGENCE-RAIL-001 | [`IPI-1140-INTELLIGENCE-RAIL-001.md`](./IPI-1140-INTELLIGENCE-RAIL-001.md) | Backlog · exact live Linear identity |
| IPI-1069 · ASSETS-001 | [`IPI-1069-ASSETS-001.md`](./IPI-1069-ASSETS-001.md) | Brand-ID scope · Linear ✅ |
| IPI-1070 · CRM-001 | [`IPI-1070-CRM-001.md`](./IPI-1070-CRM-001.md) | Wave B |
| IPI-1072 · OPERATIONS-001 | [`IPI-1072-OPERATIONS-001.md`](./IPI-1072-OPERATIONS-001.md) | Wave B |
| IPI-1071 · TALENT-BOOKING-001 | [`IPI-1071-TALENT-BOOKING-001.md`](./IPI-1071-TALENT-BOOKING-001.md) | Wave B |
| IPI-1074 · PLANS-001 | [`IPI-1074-PLANS-001.md`](./IPI-1074-PLANS-001.md) | Wave B |
| IPI-1073 · ANALYTICS-001 | [`IPI-1073-ANALYTICS-001.md`](./IPI-1073-ANALYTICS-001.md) | Wave B |
| IPI-1048 · PLANNER-001 | [`IPI-1048-PLANNER-001.md`](./IPI-1048-PLANNER-001.md) | After STREAM |
| IPI-1049 · TOOL-001 | [`IPI-1049-TOOL-001.md`](./IPI-1049-TOOL-001.md) | After PLANNER |
| IPI-1093 · BRAND-INTEL-001 | [`IPI-1093-BRAND-INTEL-001.md`](./IPI-1093-BRAND-INTEL-001.md) | MIGRATEv2 already |
| IPI-1081 · PLAN-001 | [`IPI-1081-PLAN-001.md`](./IPI-1081-PLAN-001.md) | M3 |
| IPI-1084 · APPROVAL-001 | [`IPI-1084-APPROVAL-001.md`](./IPI-1084-APPROVAL-001.md) | M3 |
| IPI-1083 · SHOOT-SAVE-001 | [`IPI-1083-SHOOT-SAVE-001.md`](./IPI-1083-SHOOT-SAVE-001.md) | M3 |
| IPI-1085 · SHOOT-WIZARD-001 | [`IPI-1085-SHOOT-WIZARD-001.md`](./IPI-1085-SHOOT-WIZARD-001.md) | M3 |
| IPI-1087 · PLANNER-CONTEXT-001 | [`IPI-1087-PLANNER-CONTEXT-001.md`](./IPI-1087-PLANNER-CONTEXT-001.md) | Remove SAVE blockedBy |
| IPI-172 · AI-EVIDENCE-001 | [`IPI-172-AI-EVIDENCE-001.md`](./IPI-172-AI-EVIDENCE-001.md) | External |
| IPI-1051 · UI-001 | [`IPI-1051-UI-001.md`](./IPI-1051-UI-001.md) | External |


## 2026-09-03 production-audit blockers

All remaining dash/backend specs now contain exact Lumina file URLs, current-source-of-truth guidance, official repo references, fastest-safe implementation path, red flags/fixes, score, and production gate. Four unresolved contracts remain:

| Priority | Contract | Owner / next proof |
| --- | --- | --- |
| 🔴 | Active-org notification semantics | `IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App` must certify/replace SECURITY DEFINER `list_notifications` + mark-read behavior before UI port. |
| 🔴 | Approved-shoot atomic write contract | `IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization` must replace/secure legacy caller-supplied actor + service-role contract and write canonical `shoot.*`. |
| 🟠 | Trusted shot-reference read owner | Before `IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan`, name one server-authorized reader that supplies `trustedReferenceShotTypes`; TOOL stays four pure compute tools. |
| 🟠 | Provider-neutral evidence persistence | `IPI-172 · AI-EVIDENCE-001 — Persist Provider-Neutral Evidence and Citations for iPix AI Decisions` needs focused schema search/design; no single canonical evidence table was proven in the targeted live audit. |

Additional high-risk proof: `IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile` must pass SSRF/redirect/private-IP/bounded-crawl tests and exact-draft-revision approval before promotion.

**Implementation authority:** clean `origin/main` / GitHub current main. The docs checkout used for this audit is intentionally dirty and behind main; never infer current product code from it.
