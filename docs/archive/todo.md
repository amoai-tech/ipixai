# iPix v2 — Active Todo & Implementation Order

**Project:** https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues  
**MIGRATEv2:** https://linear.app/amo100/view/migratev2-6e501438c58a  
**Source of truth:** live Linear `v2-ipix` project + issue `blockedBy` / `blocks`  
**Verified:** 2026-09-03

> This file is the active local execution catalog. Linear relations are the real start lock; row order is planning guidance only.
> Completed, Duplicate, and Canceled issues are not executable TODOs. Epics are listed for ownership but are not numbered implementation steps.

## Phase normalization

| Local phase | Linear milestones | Meaning |
|---|---|---|
| **COREV2** | M1 · Foundation + Parallel · Security & Reliability | identity, tenancy, runtime, persistence, shell, release-safety foundation |
| **MVP2** | M2 · Product Workspace + M3 · Production | useful operator product + complete shoot/media production journey |
| **ADVANCEDV2** | M4 · Campaigns + M5 · Measurement + M6 · Learning + M7 · Scale | post-MVP campaigns, learning, generalized workflows and scale |

> Linear may still use `POSTMVP2` / domain labels. This local file normalizes execution phase to the three values above; it does **not** mutate Linear labels.

## Status key

| Symbol | Meaning |
|---|---|
| 🟡 | In Progress / In Review |
| 🔵 | Todo / Backlog and startable when live blockers are satisfied |
| 🔴 | Known unmet hard dependency |
| ∥ | safe parallel work when file ownership does not collide |

---

# NOW — active work

| Order | Status | Task | Milestone | Phase | Immediate rule |
|---:|:---:|---|---|---|---|
| 1 | 🟡 | **IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely** | M1 · Foundation | COREV2 | In Review. Finish/certify before PLANNER-001. |
| 2 | 🟡 | **IPI-1127 · ACCESS-CLAIM-001 — Make Planner Thread Ownership an Atomic Shared Claim** | M1 · Foundation | COREV2 | Finish atomic shared claim before final Core/release certification. |
| 3 | 🟡 | **IPI-1066 · DASH-MAIN-001 — Reuse the Proven iPix Command Center as the Main Dashboard Page** | M2 · Product Workspace | MVP2 | Current operator-screen task after APP-001 Done. |
| 4 | 🟡 | **IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout** | M1 · Foundation | COREV2 | Parallel public-site lane. |
| 5 | 🟡 | **IPI-1110 · CLD-SIGN-001 — Sign Cloudinary Uploads for the Trusted Organization** | M3 · Production | MVP2 | Cloudinary core pipe; certify pending production migration if required. |
| 6 | 🟡 | **IPI-1111 · CLD-WEBHOOK-001 — Mirror Cloudinary Uploads and Deletes into Supabase** | M3 · Production | MVP2 | Parallel with SIGN/DELIVERY; Supabase remains business truth. |
| 7 | 🟡 | **IPI-1112 · CLD-DELIVERY-001 — Serve Org-Safe Cloudinary Previews with Named Transforms** | M3 · Production | MVP2 | Parallel with SIGN/WEBHOOK; reused later by Assets. |
| 8 | 🟡 | **IPI-1113 · CLD-E2E-001 — Prove One Disposable Upload Reaches Supabase Ready** | M3 · Production | MVP2 | End-to-end proof after SIGN + WEBHOOK are actually live. |

## Active epics / trackers — no execution number

| Status | Epic / tracker | Milestone | Phase |
|:---:|---|---|---|
| 🟡 | **IPI-1078 · IPI-EPIC · MASTRA COPILOTKIT — Secure Planner Runtime Sequence** | M1 · Foundation | COREV2 |
| 🟡 | **IPI-1075 · SUPABASE-EPIC — Make iPix User Accounts, Data, and AI Memory Safe and Reliable** | Parallel · Security & Reliability | COREV2 |
| 🟡 | **IPI-1036 · IPI-EPIC · Wave 0 Supabase Hardening & Production Readiness** | Parallel · Security & Reliability | COREV2 |
| 🟡 | **IPI-1102 · IPI-EPIC · PRODUCTION & MEDIA — Browse Assets and Deliver Shoot Files** | M3 · Production | MVP2 |
| 🟡 | **IPI-1123 · CLOUDINARY-V2-EPIC — Production Media Pipeline Progress Tracker** | M3 · Production | MVP2 |

---

# M1 · Foundation — Secure Identity, Shell & AI Runtime

**Phase: COREV2**

## Planner runtime / release safety

| Order | Status | Task | Start / dependency rule |
|---:|:---:|---|---|
| 9 | 🔵 | **IPI-1117 · HOST-RUNNER-001 — Make Planner Stop Work Across Vercel Instances** | Start after STREAM behavior is stable; required before RELEASE. |
| 10 | 🔵 | **IPI-1050 · MEM-001 — Let the Planner Remember the Conversation After Refresh and Restart** | Reuse current Mastra/Postgres memory; do not build a second store. |
| 11 | 🔵 | **IPI-1031 · CORE-HOST-REF — Hosted synthetic Core proof on existing project (not a second preview)** | Hosted synthetic persistence/non-interference proof. |
| 12 | 🔵 | **IPI-1051 · UI-001 — Let an iPix Operator Use the Planner in One Simple Authenticated Screen** | Reuse APP shell and current CopilotKit/Mastra runtime. |
| 13 | 🔵 | **IPI-1041 · CORE-001 — Prove the New iPix AI Foundation Survives Refresh, Restart, and Cross-Org Access Attempts** | M1 exit certification after STREAM, access-claim, memory/replay/UI/runtime proof. |

## Auth / first-user journey

| Order | Status | Task | Start / dependency rule |
|---:|:---:|---|---|
| 14 | 🔵 | **IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup** | After/shared with MARKETING-NAV; reuse current Supabase Auth. |
| 15 | 🔵 | **IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace** | After login; create first org/brand safely. |
| 16 | 🔵 | **IPI-1090 · AUTH-RECOVERY-001 — Let iPix Users Recover Access When They Forget Their Password** | Parallel after production login contract exists. |

## M1 epics — ownership only

- **IPI-1092 · IPI-EPIC · AUTH — Secure Identity, Access, and First-User Journey** — M1 · Foundation — **COREV2**

---

# Parallel · Security & Reliability

**Phase: COREV2** · runs beside M1–M7; only blocks when live issue relations say so.

| Order | Status | Task | Rule |
|---:|:---:|---|---|
| 17 | 🔵 | **IPI-1039 · SB-V2-003 — Give Every Supabase Security Warning an Owner and Clear Action** | Read-only classification/ownership first; schema changes stay separate. |
| 18 | 🔵 | **IPI-863 · AUTH-V2-001 — Block Known Leaked Passwords for iPix Accounts** | Supabase Auth hardening; not a product-feature dependency unless release gate says so. |
| 19 | 🔵 | **IPI-1038 · MASTRA-V2-002 — Track the Broader Goal of Keeping iPix Conversations Durable** | Tracking/goal issue; avoid duplicating concrete memory work. |
| 20 | 🔵 | **IPI-1052 · CONVERT-001 — Keep the New iPix Mastra Rebuild Aligned With the Proven Conversion Plan** | Architecture guardrail; no duplicate implementation. |

---

# M2 · Product Workspace & Planning — Core Screens and Brand

**Phase: MVP2**

## Operator workspace lane — recommended order

| Order | Status | Task | Start / dependency rule |
|---:|:---:|---|---|
| 21 | 🔵 | **IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles** | APP-001 Done; trusted-org list/detail first. |
| 22 | 🔵 | **IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records** | APP-001 Done; canonical V2 shoot truth is `shoot.shoots`. |
| 23 | 🔵 | **IPI-1140 · INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace** | After core Brand/Shoot surfaces are stable enough to supply trusted context. |
| 24 | 🔵 | **IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records** | M2 browse can use safe placeholder until CLD-DELIVERY is proven; do not block on full media cutover. |
| 25 | 🔵 | **IPI-1070 · CRM-001 — Bring the Proven iPix CRM Workspace Into the New App** | Reuse current org-scoped CRM truth; no fake AI scores. |
| 26 | 🔵 | **IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App** | Verify active-org notification/read contract first. |
| 27 | 🔵 | **IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings** | Reuse current booking state/RPCs only after authz audit. |
| 28 | 🔵 | **IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans** | Saved planning workspace; never a second conversational Planner. |
| 29 | 🔵 | **IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics** | Screen migration now; trustworthy measurement completion is M5. |

## Planner capability lane

| Order | Status | Task | Hard gate |
|---:|:---:|---|---|
| 30 | 🔴 | **IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant** | Wait for STREAM-001 green. |
| 31 | 🔴 | **IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely** | Wait for PLANNER-001 Done. |

## Brand intelligence lane

| Order | Status | Task | Start / dependency rule |
|---:|:---:|---|---|
| 32 | 🔵 | **IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile** | Start after BRAND-001 data/display contract; draft → human approval → approved profile. |
| 33 | 🔵 | **IPI-172 · AI-EVIDENCE-001 — Persist Provider-Neutral Evidence and Citations for iPix AI Decisions** | Extract minimal shared evidence contract from real consumers; do not build a generic evidence platform first. |
| 34 | 🔵 | **IPI-1128 · BRAND-KNOWLEDGE-001 — Give AI Decisions Approved Brand Evidence With Citations** | After approved Brand Intelligence evidence exists. |
| 35 | 🔵 | **IPI-1130 · COPILOT-A11Y-001 — Keep CopilotSidebar from hiding focused controls** | Accessibility fix; execute when current Planner UI proves the issue still exists. |

## Marketing lane — parallel

| Order | Status | Task | Start / dependency rule |
|---:|:---:|---|---|
| 36 | 🔵 | **IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App** | After MARKETING-NAV shared chrome. |
| 37 | 🔵 | **IPI-1060 · MARKETING-SERVICES-001 — Reuse the Existing iPix Photography Service Pages** | Parallel after shared marketing layout. |
| 38 | 🔵 | **IPI-1064 · MARKETING-MEDIA-001 — Reuse and Optimize the Existing iPix Marketing Images, Sliders, and Visual Content** | After page structure; use current media architecture. |
| 39 | 🔵 | **IPI-1063 · MARKETING-SEO-001 — Keep the New iPix Marketing Site Searchable and Correctly Indexed** | Finalize after routes/canonicals are stable. |

## M2 epics — ownership only

- **IPI-1076 · IPI-EPIC · DASHBOARD DESIGN — Operator Workspace Migration Sequence** — M2 — **MVP2**
- **IPI-1077 · IPI-EPIC · MARKETING PAGES — Public Site Migration Sequence** — M2 — **MVP2**
- **IPI-1098 · IPI-EPIC · HOME — Give Operators One Command Center for the Org** — M2 — **MVP2**
- **IPI-1099 · IPI-EPIC · BRAND — Browse Brands and Approve Brand DNA** — M2 — **MVP2**
- **IPI-1100 · IPI-EPIC · SHOOT PLANNING — Keep Shoot Records Browsable and Complete** — M2 — **MVP2**
- **IPI-1103 · IPI-EPIC · CRM — Run the Relationship Hub in the New App** — M2 — **MVP2**
- **IPI-1104 · IPI-EPIC · OPERATIONS — Operator Inbox and Coordination** — M2 — **MVP2**
- **IPI-1107 · IPI-EPIC · PLANS — Saved Production Plans, Not a Second Planner** — M2 — **MVP2**

---

# M3 · Production — Approve, Produce & Deliver a Shoot

**Phase: MVP2**

## Shoot planning / approval serial path

| Order | Status | Task | Hard gate / role |
|---:|:---:|---|---|
| 40 | 🔴 | **IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan** | Wait for BRAND-001 + SHOOT-001 + PLANNER-001 + TOOL-001. |
| 41 | 🔴 | **IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved** | After PLAN-001. Human decision boundary. |
| 42 | 🔴 | **IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization** | After APPROVAL-001. One atomic/idempotent trusted-org save path. |
| 43 | 🔴 | **IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot** | After SHOOT-SAVE-001. Thin orchestration over PLAN → APPROVAL → SAVE. |
| 44 | 🔴 | **IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning** | Live Linear blocks on SHOOT-SAVE + SHOOT-WIZARD; reuse final shared-state/context contract. |
| 45 | 🔵 | **IPI-1137 · SHOOT-BRIEF-IMPORT-001 — Turn an Existing Shoot Brief or PDF Into Editable Planner Context** | Optional branch into verified Planner context; not required for shoots without PDFs. |
| 46 | 🔵 | **IPI-1086 · PLANNER-QUALITY-001 — Catch Planner Mistakes Before They Reach Operators** | Release gate after production planning path exists. |
| 47 | 🔵 | **IPI-1082 · PLANNER-TRACE-001 — Show Where Planner Requests Succeeded, Slowed, or Failed** | Parallel observability; required before RELEASE. |

## Cloudinary / media infrastructure

Current dependency spine:

```text
MEDIA-DATA Done → SB-MEDIA-HARDEN Done
→ (CLD-SIGN ∥ CLD-WEBHOOK ∥ CLD-DELIVERY)
→ CLD-E2E
→ CLD-RECONCILE
→ CLD-CUTOVER last
```

| Order | Status | Task | Rule |
|---:|:---:|---|---|
| 48 | 🔵 | **IPI-1114 · CLD-RECONCILE-001 — Detect Cloudinary and Supabase Drift Without Mutating Production** | Read-only drift detection after core pipe is readable. |
| 49 | 🔵 | **IPI-1115 · CLD-CUTOVER-001 — Cut Cloudinary Notifications Over to V2 Safely** | Last infra step after sign/webhook/E2E/cutover proof is green. |

## Media product journey

```text
CLD-UPLOAD → SHOOT-ASSETS → (ASSET-DNA ∥ ASSET-QA) → MEDIA-APPROVAL → MEDIA-DELIVERY
```

| Order | Status | Task | Rule |
|---:|:---:|---|---|
| 50 | 🔵 | **IPI-1097 · MEDIA-001 — Upload, Review, Approve, and Deliver Shoot Assets** | Journey owner/tracker; children below are implementation steps. |
| 51 | 🔵 | **IPI-1116 · CLD-UPLOAD-001 — Let Operators Upload Shoot Selects with the Cloudinary Widget** | Use proven signed-upload contract; UI only. |
| 52 | 🔵 | **IPI-1118 · SHOOT-ASSETS-001 — Attach Uploaded Assets to the Correct Saved Shoot** | Requires saved canonical shoot + uploaded asset. |
| 53 | 🔵 | **IPI-1136 · ASSET-DNA-001 — Analyze Uploaded Shoot Assets Against the Approved Brand Brain** | After attach + approved Brand Brain; parallel with QA. |
| 54 | 🔵 | **IPI-1138 · ASSET-QA-001 — Check Asset Quality and Channel Readiness Before Approval** | After attach; deterministic metadata/transforms first; parallel with DNA. |
| 55 | 🔵 | **IPI-1119 · MEDIA-APPROVAL-001 — Approve or Reject the Exact Cloudinary Asset Version** | Exact immutable version + human approval. |
| 56 | 🔵 | **IPI-1120 · MEDIA-DELIVERY-001 — Deliver Only Approved Named-Transform Asset Versions** | Only approved versions are deliverable. |

## Talent / booking production capability

| Order | Status | Task | Rule |
|---:|:---:|---|---|
| 57 | 🔵 | **IPI-1094 · BOOKING-DATA-001 — Create the Shared Shoot, Talent, Studio, and Availability Booking Contract** | Data contract before AI/payment behavior. |
| 58 | 🔵 | **IPI-1095 · BOOKING-AI-001 — Let the Booking Coordinator Coordinate Production Bookings** | After booking data contract; AI proposes/coordinates, humans approve. |
| 59 | 🔵 | **IPI-1096 · PAYMENT-001 — Collect and Confirm a Shoot Booking Deposit Safely** | After booking contract and explicit payment approval UX. |

## M3 exit

| Order | Status | Task | Gate |
|---:|:---:|---|---|
| 60 | 🔴 | **IPI-1091 · RELEASE-001 — Deploy the New iPix App to Vercel and Prove the Complete Production Journey** | After CORE + ACCESS-CLAIM + HOST-RUNNER + QUALITY + TRACE + SHOOT-SAVE + required media proof. |

## M3 epics — ownership only

- **IPI-1079 · IPI-EPIC · LAUNCH — Operator Shoot Launch Journey** — M3 — **MVP2**
- **IPI-1101 · IPI-EPIC · TALENT & BOOKING — Book Talent Against a Saved Shoot** — M3 — **MVP2**

---

# M4 · Campaigns — Turn Opportunities Into Published Campaigns

**Phase: ADVANCEDV2**

| Order | Status | Task | Dependency intent |
|---:|:---:|---|---|
| 61 | 🔵 | **IPI-36 · BRAND-RESEARCH-001 — Research Competitors, Trends, and Market Opportunities With Evidence** | Evidence-producing market research. |
| 62 | 🔵 | **IPI-1129 · BRAND-OPPORTUNITY-001 — Rank Market Opportunities Against Each Brand** | Rank research against approved Brand knowledge. |
| 63 | 🔵 | **IPI-42 · CAMPAIGN-STRATEGY-001 — Turn an Approved Opportunity Into an Interactive Campaign Strategy** | Human-approved opportunity → strategy. |
| 64 | 🔵 | **IPI-157 · CAMPAIGN-PLAN-001 — Turn an Approved Strategy Into an Executable Campaign Plan** | Approved strategy → executable plan. |
| 65 | 🔵 | **IPI-77 · CAMPAIGN-COPY-001 — Create Brand-Safe Channel Copy From Approved Assets and Strategy** | Draft copy from approved strategy/assets. |
| 66 | 🔵 | **IPI-1131 · BRAND-CHECK-001 — Check Copy and Media Against the Approved Brand Brain** | Brand compliance before preview/publish. |
| 67 | 🔵 | **IPI-338 · CHANNEL-PREVIEW-001 — Preview Approved Campaign Content Before Publishing** | Human preview before consequential publish. |
| 68 | 🔵 | **IPI-195 · PUBLISH-001 — Publish Only Approved Campaign Content Through Postiz** | Publish only approved content. |

## M4 epics — ownership only

- **IPI-1134 · IPI-EPIC · BRAND STRATEGY — Research Markets and Find Brand Opportunities** — M4 — **ADVANCEDV2**
- **IPI-1105 · IPI-EPIC · CAMPAIGNS & PUBLISHING — Campaigns, Preview, and Publish** — M4 — **ADVANCEDV2**

---

# M5 · Measurement — Measure Product, Campaign & Asset Performance

**Phase: ADVANCEDV2**

| Order | Status | Task | Rule |
|---:|:---:|---|---|
| 69 | 🔵 | **IPI-1139 · MEASURE-001 — Turn Real Product, Campaign, Channel, and Asset Results Into Trusted iPix Metrics** | Deterministic tenant-safe measurement; no invented numbers. Feeds the Analytics screen migrated in M2. |

## M5 epic — ownership only

- **IPI-1106 · IPI-EPIC · MEASUREMENT — Measure Real Product, Campaign & Asset Performance** — M5 — **ADVANCEDV2**

---

# M6 · Learning — Improve the Brand From Proven Results

**Phase: ADVANCEDV2**

| Order | Status | Task | Rule |
|---:|:---:|---|---|
| 70 | 🔵 | **IPI-1133 · LEARN-001 — Recommend Brand Brain Improvements From Real Campaign Results** | Only after trusted M5 measurement; AI proposes evidence-backed changes, human approves. |

## M6 epic — ownership only

- **IPI-1135 · IPI-EPIC · LEARNING — Turn Proven Results Into Reviewed Brand Improvements** — M6 — **ADVANCEDV2**

---

# M7 · Scale — Standardize Proven Patterns & Advanced Automation

**Phase: ADVANCEDV2**

> These workflow tasks are **not** a mandatory serial train. Activate each only after a repeated M1–M6 workflow proves the abstraction is needed.

| Order | Status | Task | Use only when proven |
|---:|:---:|---|---|
| 71 | 🔵 | **IPI-994 · MASTRA-WF-001 — Establish Reusable iPix Workflow Foundation** | Generalize a real repeated workflow, not speculative framework work. |
| 72 | 🔵 | **IPI-995 · MASTRA-WF-002 — Standardize and Govern the Existing iPix Tool Registry** | After enough real tools exist to justify common governance. |
| 73 | 🔵 | **IPI-998 · MASTRA-WF-005 — Standardize Human-in-the-Loop Approval** | Generalize proven approval patterns from PLAN/media/campaign flows. |
| 74 | 🔵 | **IPI-999 · MASTRA-WF-006 — Harden Long-Lived Workflow Recovery, Reconnect & Idempotency** | When actual long-lived workflows require it. |
| 75 | 🔵 | **IPI-996 · MASTRA-WF-003 — Add Mastra Task Tracking & Progress UI** | Only after durable task progress is a real user need. |
| 76 | 🔵 | **IPI-997 · MASTRA-WF-004 — Add Parallel Workflow Execution** | Add concurrency only where measured throughput benefits. |
| 77 | 🔵 | **IPI-1000 · MASTRA-WF-007 — Add Plan Review Before Complex Execution** | Reuse only for complex workflows beyond existing domain HITL. |
| 78 | 🔵 | **IPI-1003 · MASTRA-WF-010 — Add Workflow Observability, Evals & Performance Scoring** | Standardize after multiple workflows need shared evaluation. |
| 79 | 🔵 | **IPI-1001 · MASTRA-WF-008 — Prove One Safe Dynamic Workflow End-to-End** | Advanced experiment after static workflows are proven. |
| 80 | 🔵 | **IPI-1002 · MASTRA-WF-009 — Standardize External Tool & MCP Integration** | Advanced integration governance after real external-tool repetition. |
| 81 | 🔵 | **IPI-780 · MASTRA-PG-004 — Define and Verify Safe Mastra Data Retention** | ADVANCEDV2 retention policy; currently no project milestone assigned in Linear. |

## M7 epic — ownership only

- **IPI-993 · MASTRA-WF-000 — iPix Mastra Workflow & Tool Orchestration Platform** — M7 — **ADVANCEDV2**

---

# Current critical execution graph

```text
CORE / RUNTIME
IPI-1045 STREAM (In Review)
  ├─→ IPI-1048 PLANNER → IPI-1049 TOOL
  └─→ IPI-1117 HOST-RUNNER
IPI-1127 ACCESS-CLAIM (In Progress)
MEM / UI / hosted proof ─→ IPI-1041 CORE

OPERATOR PRODUCT
IPI-1066 DASH (In Progress)
→ IPI-1068 BRAND
→ IPI-1067 SHOOT
→ IPI-1140 INTELLIGENCE-RAIL
→ IPI-1069 ASSETS
→ CRM / OPERATIONS / TALENT / PLANS / ANALYTICS

SHOOT AI
BRAND + SHOOT + PLANNER + TOOL
→ IPI-1081 PLAN
→ IPI-1084 APPROVAL
→ IPI-1083 SHOOT-SAVE
→ IPI-1085 SHOOT-WIZARD
→ IPI-1087 PLANNER-CONTEXT

CLOUDINARY INFRA
SIGN ∥ WEBHOOK ∥ DELIVERY
→ E2E
→ RECONCILE
→ CUTOVER

MEDIA PRODUCT
UPLOAD → ATTACH → (DNA ∥ QA) → APPROVAL → DELIVERY

CAMPAIGN / LEARNING
RESEARCH → OPPORTUNITY → STRATEGY → PLAN → COPY → BRAND-CHECK → PREVIEW → PUBLISH
→ MEASURE → LEARN
```

---

# Verification notes

- The full live `v2-ipix` project was checked, not only the MIGRATEv2 label view.
- Existing local `docs/todo.md` was incomplete because it only contained the MIGRATE subset.
- Epics are present here for ownership/context but intentionally have no execution number.
- Live Linear milestone names are preserved exactly in section headers.
- Local phase is normalized to **COREV2 / MVP2 / ADVANCEDV2**.
- Done issues such as **IPI-1065 APP-001**, **IPI-1108 CLD-FOUNDATION-001**, **IPI-1109 MEDIA-DATA-001**, **IPI-1122 SB-MEDIA-HARDEN-001**, **IPI-1088 COPILOT-REPLAY-001**, **IPI-1040 MIGRATION-001**, **IPI-897 SB-SEC-009**, and other completed Foundation work are intentionally omitted from the active execution rows.
- Duplicate issues (`IPI-1054`–`IPI-1062` duplicate marketing copies, etc.) are intentionally omitted.
- Canceled **IPI-1121 · HOST-CF-001 — Establish iPix Cloudflare Workers Hosting** is intentionally omitted from active work; Vercel remains the current hosting path.

## Fastest-safe rule

For every task:

```text
Linear live relations
→ current clean origin/main
→ Graphify/load-bearing paths
→ installed source/types
→ live read-only Supabase when data matters
→ official vendor references
→ reuse current ipixai
→ COPY+CLEAN proven Lumina behavior/UI where appropriate
→ smallest correct change
→ targeted proof
→ typecheck/build
→ browser/live proof only when required
→ task-verifier Full before Done
```
