---
title: Mastra + CopilotKit + brand — full tracker
checked: 2026-09-01
ssot_status: live Linear
ssot_mint: docs/copilotkit-mastra/todo.md
ssot_candidates: docs/plan/04/06.1-new-tasks.md
---

# Mastra + CopilotKit — tracker (Foundation + later)

**How to use:** Work **Foundation** top to bottom. Later rows are the full CopilotKit / Mastra / brand list — **not** “create these in Linear today.”  
**Status SSOT:** live Linear — [**IPI-1078 · IPI-EPIC · MASTRA COPILOTKIT — Secure Planner Runtime Sequence**](https://linear.app/amo100/issue/IPI-1078)  
**Mint SSOT:** this file · [docs/plan/04/06.1-new-tasks.md](../../plan/04/06.1-new-tasks.md) (**0** confirmed new IPIs on 2026-09-01).
**Specs:** [prd.md](./prd.md) · [roadmap.md](./roadmap.md) · [plan.md](./plan.md) · **[brand.md](./brand.md)**

If this file disagrees with Linear, **Linear wins**. If it disagrees with the **Do not add** / **Add later** rows here, **this file wins** on mint (folded from 05a).

**Linear action (this file):**

| Action | Meaning |
| --- | --- |
| **Exists — execute** | Ticket is live. Do the work. |
| **Exists — update** | Ticket is live. Strengthen title/ACs/`relatedTo` — **not** a new IPI. |
| **Hygiene** | Graph/label only (C12/C13). |
| **Add later** | Not in Linear as this spec. After **IPI-1041 · CORE-001** + duplicate search, mint only if still `new`. |
| **Do not add** | Invented name. Use the mapped live ticket. |

**Legend:** 🟢 Linear Done · 🟡 In Progress · ⚪ Backlog · 🟣 In Review · **n/a** not an IPI yet

Host: **Vercel**. Do not execute **IPI-1121 · HOST-CF-001**. Split `dev:ui` / `dev:agent`.

---

## Next (do this)

1. **[IPI-1042 · RUNTIME-001 — Make the New iPix AI Runtime Compile and Build Cleanly](https://linear.app/amo100/issue/IPI-1042)** — 🟡 **Exists — execute**. Pins on `main` (PR #25); merge ≠ Done (schema fingerprint vs `@mastra/pg@1.22.2`).  
2. **[IPI-1124 · MASTRA-HOST-PG-001 — Run Mastra Memory on Shared Supabase Postgres in Hosted iPix](https://linear.app/amo100/issue/IPI-1124)** — 🟡 **Exists — execute**.  
3. **[IPI-1045 · STREAM-001](https://linear.app/amo100/issue/IPI-1045)** · **[IPI-1047 · ACCESS-001](https://linear.app/amo100/issue/IPI-1047)** — 🟡 wait **1125** + **1126** for hosted Org B.

Dashboard **IPI-1076** / marketing **IPI-1077** are **parallel**.

---

## Phase 0 — Foundation (IPI-1078)

| Status | Task | Linear action | Phase |
| :---: | --- | --- | --- |
| 🟡 | **[IPI-1042 · RUNTIME-001 — Make the New iPix AI Runtime Compile and Build Cleanly](https://linear.app/amo100/issue/IPI-1042)** | Exists — execute | Foundation |
| 🟢 | **[IPI-1043 · DB-001 — Prove Mastra Can Use the iPix Postgres Schema Safely](https://linear.app/amo100/issue/IPI-1043)** | Exists — execute | Foundation |
| 🟢 | **[IPI-1044 · PG-001 — Make iPix AI Conversations Survive Server Restarts](https://linear.app/amo100/issue/IPI-1044)** | Exists — execute (local store Done) | Foundation |
| 🟢 | **[IPI-1037 · AUTH-001 — Let Real iPix Users Sign In Before Using the AI Planner](https://linear.app/amo100/issue/IPI-1037)** | Exists — execute | Foundation |
| 🟢 | **[IPI-1046 · AUTH-002 — Keep Every iPix User Inside the Correct Organization](https://linear.app/amo100/issue/IPI-1046)** | Exists — execute | Foundation |
| ⚪ | **[IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Organization, and Enter the App](https://linear.app/amo100/issue/IPI-1089)** | Exists — execute (not STREAM blocker) | Foundation |
| 🟡 | **[IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely](https://linear.app/amo100/issue/IPI-1045)** | Exists — execute | Foundation |
| 🟡 | **[IPI-1047 · ACCESS-001 — Stop One Organization From Opening Another Organization’s Planner Thread](https://linear.app/amo100/issue/IPI-1047)** | Exists — execute · **Hygiene C12** `relatedTo` 1078 | Foundation |
| 🟡 | **[IPI-1124 · MASTRA-HOST-PG-001 — Run Planner Memory on Shared Supabase Postgres in Hosted iPix](https://linear.app/amo100/issue/IPI-1124)** | Exists — execute | Foundation |
| ⚪ | **[IPI-1125 · QA-ORG-001 — Provision Two Isolated QA Organizations and Users for Cross-Org Planner Proof](https://linear.app/amo100/issue/IPI-1125)** | Exists — execute · **Hygiene C12** | Foundation |
| ⚪ | **[IPI-1126 · HOST-PREVIEW-001 — Deploy an Exact iPix PR SHA to a Non-Production Preview](https://linear.app/amo100/issue/IPI-1126)** | Exists — execute (Vercel **ipixai**) | Foundation |
| ⚪ | **[IPI-1127 · ACCESS-CLAIM-001 — Make Planner Thread Ownership an Atomic Shared Claim](https://linear.app/amo100/issue/IPI-1127)** | Exists — execute (blocks **RELEASE-001**, not ACCESS merge) | Foundation |
| ⚪ | **[IPI-1117 · HOST-RUNNER-001 — Make Planner Stop Reach the Same Server That Is Streaming](https://linear.app/amo100/issue/IPI-1117)** | Exists — execute (Vercel isolate, not Workers) | Foundation |
| ⚪ | **[IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant](https://linear.app/amo100/issue/IPI-1048)** | Exists — execute | Foundation |
| ⚪ | **[IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely](https://linear.app/amo100/issue/IPI-1049)** | Exists — execute | Foundation |
| ⚪ | **[IPI-1050 · MEM-001 — Let the Planner Remember the Conversation After Refresh and Restart](https://linear.app/amo100/issue/IPI-1050)** | Exists — execute | Foundation |
| ⚪ | **[IPI-1088 · COPILOT-REPLAY-001 — Reload the Planner UI from the Saved Conversation After Refresh](https://linear.app/amo100/issue/IPI-1088)** | Exists — execute | Foundation |
| ⚪ | **[IPI-1051 · UI-001 — Let an iPix Operator Use the Planner in One Simple Authenticated Screen](https://linear.app/amo100/issue/IPI-1051)** | Exists — execute · gap-check buttons before **A11** | Foundation |
| ⚪ | **[IPI-1041 · CORE-001 — Prove the New iPix AI Foundation Survives Refresh, Restart, and Cross-Org Access Attempts](https://linear.app/amo100/issue/IPI-1041)** | Exists — execute last (exam) | Foundation |

```text
1042 → 1009 cert → 1045 STREAM
1124 ∥ 1125 → 1126 Vercel preview → 1047 hosted ACCESS
1048 → 1049 → 1050 → 1088 → 1051 → 1041 CORE exam
1127 after 1124 (RELEASE) · 1117 Stop on Vercel
```

---

## Phase 0b — Cert + CopilotKit on existing tickets

| Status | Task | Linear action | Phase |
| :---: | --- | --- | --- |
| ⚪ | **[IPI-1009 · MASTRA-UPG-004 — Verify CopilotKit, HITL and Cloudflare Runtime After Mastra Upgrade](https://linear.app/amo100/issue/IPI-1009)** | Exists — execute (ignore “Cloudflare” in title; certify **this** Vercel/Node family). Parent **IPI-1005**. | Cert |
| ⚪ | **[IPI-1005 · MASTRA-UPG-000 — Mastra Upgrade Program](https://linear.app/amo100/issue/IPI-1005)** | Exists — execute (umbrella; do not clone) | Cert |
| ⚪ | **[IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning](https://linear.app/amo100/issue/IPI-1087)** | Exists — execute · **Exists — update** if ACs still miss “browser IDs are hints” | Core MVP |
| ⚪ | **[IPI-1082 · PLANNER-TRACE-001 — Show Where Planner Requests Succeeded, Slowed, or Failed](https://linear.app/amo100/issue/IPI-1082)** | Exists — execute | Core MVP |
| ⚪ | **[IPI-1086 · PLANNER-QUALITY-001 — Catch Planner Mistakes Before They Reach Operators](https://linear.app/amo100/issue/IPI-1086)** | Exists — execute | Core MVP |
| ⚪ | **[IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App](https://linear.app/amo100/issue/IPI-1065)** | Exists — execute (parallel shell) | Parallel |

**111 invented names — do not add to Linear:**

| Invented | Linear action | Maps to | Phase |
| --- | --- | --- | --- |
| **COPILOT-CONTEXT-001** | **Do not add** | **IPI-1087 · PLANNER-CONTEXT-001** | Core MVP |
| **COPILOT-UI-001** | **Do not add** | **IPI-1051** + **IPI-1081 · PLAN-001** + **IPI-1084 · APPROVAL-001** | Core MVP |
| **COPILOT-STATE-001** | **Do not add** | **IPI-1088** + **IPI-1050** | Foundation |
| **COPILOT-STREAM-001** (plan meaning) | **Do not add** | **IPI-1045 · STREAM-001**. ID **IPI-1022** is old CF timeout — wrong owner | Foundation |
| **COPILOT-FRONTEND-001** | **Do not add** | Overlaps **A11** / 1051 | After Core |
| **COPILOT-BG-001** | **Do not add** | **IPI-996 · MASTRA-WF-003** | After Core |
| **COPILOT-A2UI-001** / **COPILOT-MCP-001** | **Do not add** | Advanced | Advanced |

---

## Phase 1 — Launch (shoot HITL) — exists, after stream/ACCESS for live use

| Status | Task | Linear action | Phase |
| :---: | --- | --- | --- |
| ⚪ | **[IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan](https://linear.app/amo100/issue/IPI-1081)** | Exists — execute (shoot plan, not IG calendar) | Launch |
| ⚪ | **[IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved](https://linear.app/amo100/issue/IPI-1084)** | Exists — execute (do not overload with publish HITL) | Launch |
| ⚪ | **[IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization](https://linear.app/amo100/issue/IPI-1083)** | Exists — execute | Launch |
| ⚪ | **[IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot](https://linear.app/amo100/issue/IPI-1085)** | Exists — execute | Launch |
| Epic | **[IPI-1079 · IPI-EPIC · LAUNCH — Operator Shoot Launch Journey](https://linear.app/amo100/issue/IPI-1079)** | Exists — execute (parent) | Launch |

---

## Phase 2 — Brand (live tickets + updates)

| Status | Task | Linear action | Phase |
| :---: | --- | --- | --- |
| Epic | **[IPI-1099 · IPI-EPIC · BRAND — Browse Brands and Approve Brand DNA](https://linear.app/amo100/issue/IPI-1099)** | Exists — execute | Brand |
| ⚪ | **[IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles](https://linear.app/amo100/issue/IPI-1068)** | Exists — **update** (I13: draft review UI, not schema rebuild) | Brand |
| ⚪ | **[IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile](https://linear.app/amo100/issue/IPI-1093)** | Exists — **update** (I7: atomic `approve_brand_intelligence_draft`; Firecrawl webhook never writes approved Brain). **Hygiene C13:** mark **IPI-656** historical | Brand |
| ⚪ | **[IPI-1039 · SB-V2-003 — Give Every Supabase Security Warning an Owner and Clear Action](https://linear.app/amo100/issue/IPI-1039)** | Exists — **update** (I11: brand RPC org checks) | Brand / data |
| 🟡 | **[IPI-1040 · MIGRATION-001 — Prove New iPix Database Changes Can Be Added Without Replaying Old Migrations](https://linear.app/amo100/issue/IPI-1040)** | Exists — **update** (I12: forward migration for I7/I11) | Brand / data |

**Do not add:** **BRAND-APPROVAL-001**, **BRAND-INTAKE**, **BRAND-REVIEW**, **BRAND-DATA-001** (ID is **IPI-737**, Done demo URLs). Fold into **I7 / IPI-1093**.

---

## Phase 2b — Brand / campaign candidates (not in Linear as these specs)

Empty parent **[IPI-1105 · IPI-EPIC · CAMPAIGNS & PUBLISHING](https://linear.app/amo100/issue/IPI-1105)**. **Add later** only after CORE + duplicate search ([06.1](../../plan/04/06.1-new-tasks.md)).

| # | Proposed | Linear action | Phase | Duplicate-search first |
| --- | --- | --- | --- | --- |
| A1 | **BRAND-KNOWLEDGE-001 — Give AI Decisions Approved Brand Evidence With Citations** | **Add later** (prefer rewrite **IPI-924**) | After Core | IPI-924, 474, 177, 141, 144, 40 |
| A2 | **BRAND-RESEARCH-001 — Research Competitors, Trends, and Market Opportunities With Evidence** | **Add later** | After Core | **IPI-36**, **IPI-168** |
| A3 | **BRAND-OPPORTUNITY-001 — Rank Market Opportunities Against Each Brand** | **Add later** | After Core | **IPI-29**, **IPI-36** |
| A4 | **CAMPAIGN-STRATEGY-001 — Turn an Approved Opportunity Into an Interactive Campaign Strategy** | **Add later** (may merge A5) | Campaign | **IPI-42**, **IPI-44**, **IPI-156** |
| A5 | **CAMPAIGN-PLAN-001 — Turn an Approved Strategy Into an Executable Campaign Plan** | **Add later** | Campaign | **IPI-42**, **IPI-157**, **IPI-249** |
| A6 | **CHANNEL-PREVIEW-001 — Preview Campaign Content Before Publishing** | **Add later** | Campaign | **IPI-338** |
| A7 | **CAMPAIGN-COPY-001 — Create Brand-Safe Channel Copy From Approved Assets and Strategy** | **Add later** | Campaign | **IPI-44** |
| A8 | **PUBLISH-001 — Publish Only Approved Campaign Content Through Postiz** | **Add later** | Campaign | **IPI-195** + reuse **1084** / **998** |
| A9 | **MEDIA-AGENT-001 — Find Approved Existing Assets Before Creating New Ones** | **Add later** | After media | **IPI-1097** |
| A10 | **LEARN-001 — Recommend Brand Brain Improvements From Real Campaign Results** | **Add later** | After analytics | **IPI-297**, **IPI-66** — unique = HITL DNA |
| A11 | **COPILOT-CONTROL-001 — Let Operators Start Mastra Actions From UI Controls Without Typing Chat** | **Add later** (conditional) | After Core | Gap-check **IPI-1051** first |
| B1 | **BRAND-CHECK-001 — Check copy and media against the approved Brand Brain** | **Add later** | Brand | Do not duplicate **1084** |
| B2 | **BRAND-COPILOT-001 — Let operators ask the approved Brand Brain in Brand Hub** | **Add later** (conditional) | Brand | Overlaps A1 + **1087** |
| B3 | **BRAND-VISUAL-001 — Compare shoot assets to approved visual rules** | **Add later** | After media | After **1116…1120** |
| B4–B6 | Compete / trends / social splits of A2 | **Add later** only if A2 cannot hold three products | After A2 | **IPI-36** / **IPI-168** |

**02-mastra-copilotkit.md `IPI-XXX` names — do not add as a second epic:**

| 02 invented | Linear action | Use instead |
| --- | --- | --- |
| **AI PRODUCT AGENTS** epic | **Do not add** | **IPI-1099** + **IPI-1079** + **IPI-1105** after Core |
| **AI-CORE-001** / **AI-UI-001** | **Do not add** | **IPI-993 · MASTRA-WF-000** family + CopilotKit on **1051** / **1087** |
| **BRAND-AGENT-001** | **Do not add** | **IPI-1093 · BRAND-INTEL-001** (I7) |
| **CAMPAIGN-CREATE-001** | **Do not add** | **A7 CAMPAIGN-COPY-001** |
| **CAMPAIGN-APPROVAL-001** | **Do not add** | **IPI-1084** + **IPI-998** + A8 HITL |
| **CAMPAIGN-PUBLISH-001** | **Do not add** | **A8 PUBLISH-001** / **POSTIZ-001** |
| **CAMPAIGN-ANALYTICS-001** | **Do not add** | **IPI-1073 · ANALYTICS-001** (charts only) |
| **CAMPAIGN-OPTIMIZE-001** | **Do not add** | Split: charts **1073** vs DNA **A10 LEARN-001** |
| **BRAND-LEARN-001** | **Do not add** | **A10 LEARN-001** |
| **AI-BROWSER-001** | **Do not add** | **X3** Advanced / ops only |
| **AI-SKILLS-001** / **AI-TOOLS-001** | **Do not add** | **X1** after **IPI-995** |
| **AI-SCHEDULES-001** | **Do not add** | **X2** after **IPI-996** |
| **AI-DYNAMIC-WORKFLOWS-001** | **Do not add** | **IPI-1001 · MASTRA-WF-008** |
| **AI-EVALS-001** / **AI-FEEDBACK-001** / **AI-COST-001** / **AI-AUTHZ-001** / **AI-OBSERVABILITY-001** | **Do not add** | **IPI-1003**, **IPI-1086**, AUTH epic — do not mint five extras now |

---

## Parallel — media, analytics, booking (exists)

| Status | Task | Linear action | Phase |
| :---: | --- | --- | --- |
| ⚪ | **[IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics](https://linear.app/amo100/issue/IPI-1073)** | Exists — **update** (I8: charts only; “why sold” = A10) | Parallel |
| ⚪ | **[IPI-1116 · CLD-UPLOAD-001 — Let Operators Upload Shoot Selects with the Cloudinary Widget](https://linear.app/amo100/issue/IPI-1116)** | Exists — execute | Parallel |
| ⚪ | **[IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records](https://linear.app/amo100/issue/IPI-1069)** | Exists — execute | Parallel |
| ⚪ | **[IPI-1118 · SHOOT-ASSETS-001 — Attach Uploaded Assets to the Correct Saved Shoot](https://linear.app/amo100/issue/IPI-1118)** | Exists — execute | Parallel |
| ⚪ | **[IPI-1119 · MEDIA-APPROVAL-001 — Approve or Reject the Exact Cloudinary Asset Version](https://linear.app/amo100/issue/IPI-1119)** | Exists — execute | Parallel |
| ⚪ | **[IPI-1120 · MEDIA-DELIVERY-001 — Deliver Only Approved Named-Transform Asset Versions](https://linear.app/amo100/issue/IPI-1120)** | Exists — execute | Parallel |
| Epic | **[IPI-1097 · MEDIA-001 — Upload, Review, Approve, and Deliver Shoot Assets](https://linear.app/amo100/issue/IPI-1097)** | Exists — execute | Parallel |
| ⚪ | **[IPI-1108 · CLD-FOUNDATION-001](https://linear.app/amo100/issue/IPI-1108)** (and Cloudinary chain) | Exists — execute | Parallel |

---

## Hygiene (no new IPI)

| # | What | Linear action | Phase |
| --- | --- | --- | --- |
| C12 | `relatedTo` **IPI-1078** on **IPI-1047** and **IPI-1125** | **Hygiene** | Foundation |
| C13 | Mark **[IPI-656 · BRAND-INTEL-001](https://linear.app/amo100/issue/IPI-656)** historical; v2 DNA = **IPI-1093** | **Hygiene** | Brand |

Optional later: drop stale **IPI-995** `blockedBy` **IPI-994** / **IPI-1005** if they are old-app, not ipixai.

---

## Platform epic (do not clone onto 1078)

**[IPI-993 · MASTRA-WF-000 — iPix Mastra Workflow & Tool Orchestration Platform](https://linear.app/amo100/issue/IPI-993)** = proposed `MASTRA-CORE-001` / `AI-CORE-001`.

| Task | Linear action | Phase |
| --- | --- | --- |
| **[IPI-994 · MASTRA-WF-001](https://linear.app/amo100/issue/IPI-994)** | Exists — execute | Platform |
| **[IPI-995 · MASTRA-WF-002 — Standardize and Govern the Existing iPix Tool Registry](https://linear.app/amo100/issue/IPI-995)** | Exists — execute | Platform |
| **[IPI-996 · MASTRA-WF-003 — Add Mastra Task Tracking & Progress UI](https://linear.app/amo100/issue/IPI-996)** | Exists — **update** (I6: evaluate for Planner after Core) | After Core |
| **[IPI-997 · MASTRA-WF-004](https://linear.app/amo100/issue/IPI-997)** | Exists — execute | Platform |
| **[IPI-998 · MASTRA-WF-005 — Standardize Human-in-the-Loop Approval](https://linear.app/amo100/issue/IPI-998)** | Exists — execute (reuse **1084**; no second HITL) | After Core |
| **[IPI-999 · MASTRA-WF-006](https://linear.app/amo100/issue/IPI-999)** | Exists — execute | Platform |
| **[IPI-1000 · MASTRA-WF-007](https://linear.app/amo100/issue/IPI-1000)** | Exists — execute | Platform |
| **[IPI-1001 · MASTRA-WF-008 — Prove One Safe Dynamic Workflow End-to-End](https://linear.app/amo100/issue/IPI-1001)** | Exists — execute | Advanced |
| **[IPI-1002 · MASTRA-WF-009](https://linear.app/amo100/issue/IPI-1002)** | Exists — execute | Platform |
| **[IPI-1003 · MASTRA-WF-010](https://linear.app/amo100/issue/IPI-1003)** | Exists — execute | Platform |

---

## Advanced (do not start)

| # | Proposed | Linear action | Phase |
| --- | --- | --- | --- |
| X1 | Skill Search / Tool Search | **Add later** after **IPI-995** at catalog scale | Advanced |
| X2 | Agent harness schedules | **Add later** after **IPI-996** | Advanced |
| X3 | Browser inspect | **Add later** (ops only) | Advanced |
| X4 | OpenClaw / Hermes | **Do not add** as runtime; never Stripe/Postiz | Never / ops |
| X5 | Dynamic org workflows | **Do not add** extra IPI — **IPI-1001** | Advanced |

**[IPI-1121 · HOST-CF-001](https://linear.app/amo100/issue/IPI-1121)** — **Do not execute now.** Future Workers. Host is Vercel.

---

## Never add (duplicate names)

| Proposed | Linear action | Use |
| --- | --- | --- |
| **MASTRA-UPGRADE-001** | **Do not add** | **IPI-1042** + **IPI-1009** / **IPI-1005** |
| **MASTRA-CORE-001** / **AI-CORE-001** | **Do not add** | **IPI-993** family |
| Second HITL framework | **Do not add** | **IPI-1084** + **IPI-998** |
| Second Mastra/Supabase DB | **Do not add** | **IPI-1124** |
| Custom Cloudinary uploader | **Do not add** | **IPI-1116** |
| Four CopilotKit tickets now | **Do not add** | 1087 / 1051 / 1081 / 1084 / 1088 / 1050 |

**Not Core owners:** [IPI-1052](https://linear.app/amo100/issue/IPI-1052) · [IPI-1038](https://linear.app/amo100/issue/IPI-1038) · [IPI-1031](https://linear.app/amo100/issue/IPI-1031) · [IPI-1075](https://linear.app/amo100/issue/IPI-1075) · [IPI-1020](https://linear.app/amo100/issue/IPI-1020) · [IPI-486](https://linear.app/amo100/issue/IPI-486)

---

## Specs

| Need | File |
| --- | --- |
| Requirements | [prd.md](./prd.md) |
| Now / Next / Later | [roadmap.md](./roadmap.md) |
| How to execute Core | [plan.md](./plan.md) |
| Brand loop | **[brand.md](./brand.md)** |
| Candidates + duplicate set | [docs/plan/04/06.1-new-tasks.md](../../plan/04/06.1-new-tasks.md) |
| Official URLs | [links.md](./links.md) |
| 05a / convert / schema dumps | [../archive/copilotkit-mastra/tasks/](./tasks) |
