# iPix Platform — Reference Index

**Purpose:** one starting point for iPix product architecture, reuse planning, domain docs, Linear mirrors, source research, and the implementation order.

**Repo source of truth:** this `docs/ipix-platform/` tree. Linear is the planning/review mirror.

**Current worktree:** `/home/sk/ipixai-worktrees/ipix-product-area-architecture`

**Branch:** `docs/ipix-product-area-architecture`

## Table of contents

1. [Strategy](#1-strategy)
2. [Source-of-truth order](#2-source-of-truth-order)
3. [Current platform docs](#3-current-platform-docs)
4. [Domain docs and status](#4-domain-docs-and-status)
5. [Linear docs and issues](#5-linear-docs-and-issues)
6. [Research/reference sources](#6-researchreference-sources)
7. [Docs still to create](#7-docs-still-to-create)
8. [Implementation order](#8-implementation-order)
9. [What belongs in MVP vs later](#9-what-belongs-in-mvp-vs-later)
10. [New-chat starting point](#10-new-chat-starting-point)
## 1. Strategy

Use this decision order for every product feature:

`KEEP existing iPix → ADAPT official CopilotKit/Mastra pattern → MODEL proven OSS product → TEST real iPix journey → CUSTOM BUILD only for the remaining gap`

Core rules:

- **Custom implementation is the last option, not the default.**
- **Do not over-engineer Core/MVP.** Prove the smallest valuable user journey first.
- **Keep one source of truth.** Do not add parallel stores, duplicate APIs, or duplicate state models.
- **Reuse what already works.** Existing auth, RLS, workflow, Cloudinary, Stripe, and product-specific contracts stay unless evidence proves they block the journey.
- **Adapt patterns, not whole demo apps.** External repos are reference implementations, not replacement products.
- **Complexity needs evidence.** Browser automation, advanced RAG, multi-agent systems, schedules, and generic frameworks are deferred until a real need is proven.

Real-world example — Brands:

`existing Brand workflow → clearer BrandContext → better research if needed → approved knowledge if repeated research becomes a problem → browser fallback only for sites the crawler cannot handle`
## 2. Source-of-truth order

Use evidence in this order:

1. Current iPix code and tests.
2. Installed package source/types and lockfile versions.
3. Official CopilotKit / Mastra / Supabase / Cloudinary / Stripe docs.
4. Official GitHub examples and templates.
5. Proven external OSS products such as Cal.com, Twenty, Medusa, PostHog, and Lago.
6. Custom iPix implementation only where the above do not solve the requirement.

When sources disagree:

- current code + tests beat old planning notes;
- installed versions beat example-repo `main`;
- current Linear status beats stale exported task snapshots;
- repo Markdown is the implementation documentation source of truth;
- Linear mirrors the reviewed plan and work status.

## 3. Current platform docs

| Doc | Purpose | Status |
| --- | --- | --- |
| [Documentation Standards](00-platform/DOC-STANDARDS.md) | Writing rules, evidence rules, reuse matrix format, migration/test standards, MVP guardrails | **ACTIVE / SOURCE OF TRUTH** |
| [Brands](10-brands/BRANDS.md) | First completed domain template: current state, journeys, repo adaptations, gaps, architecture, phases, tests | **ACTIVE / TEMPLATE FOR OTHER DOMAINS** |
| This index | Navigation, strategy, source locations, planned docs, execution order | **ACTIVE** |
## 4. Domain docs and status

| Order | Domain | Local doc | Status | First core journey |
| ---: | --- | --- | --- | --- |
| 10 | Brands | [10-brands/BRANDS.md](10-brands/BRANDS.md) | **Complete first draft / reviewed style** | Brand website → Brand DNA → human review → approved context |
| 20 | Talent | `20-talent/TALENT.md` | **TO CREATE** | Talent profile → availability → shortlist → approve/book |
| 30 | Shoots | `30-shoots/SHOOTS.md` | **TO CREATE NEXT** | Brand → shoot plan → shot list → approval → booking/production |
| 40 | Assets | `40-assets/ASSETS.md` | **TO CREATE** | Upload → attach to shoot → QA/DNA → approve → deliver |
| 50 | CRM | `50-crm/CRM.md` | **TO CREATE** | Lead/company → deal → shoot opportunity → follow-up |
| 60 | Operations | `60-operations/OPERATIONS.md` | **TO CREATE** | Active work → tasks/owners → exceptions → approvals → delivery |
| 70 | Analytics | `70-analytics/ANALYTICS.md` | **TO CREATE** | Real product/agent events → useful metrics → decision support |
| 80 | Plans | `80-plans/PLANS.md` | **TO CREATE** | Plan/entitlement → subscribe → usage → upgrade/downgrade |

Every domain doc uses the same writing structure:

`30-second summary → Current State → Plain-English Terms → Real User Journeys → What We KEEP → Repo Reuse Map → Exact Adaptation Details → Problem/Impact/Fix → Simple Architecture → Outcome-based Implementation Phases → Tests/Success → Next 3 Actions → References`

Every repo recommendation must answer:

`Repo → What it teaches → What iPix adapts → Where it goes → Real user example → What we do NOT copy`
## 5. Linear docs and issues

**Live v2-ipix project issues:** https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

Use that project issue list as the **live task/status authority**. Do not copy task status from old Markdown exports. Before creating a new domain gap task, search this project first for an existing issue or epic.

### Domain → live Linear map

| Domain / concern | Primary live Linear references |
| --- | --- |
| Platform / CopilotKit + Mastra | https://linear.app/amo100/issue/IPI-1078/ipi-1078-ipi-epic-mastra-copilotkit-secure-planner-runtime-sequence · https://linear.app/amo100/issue/IPI-1293/ipix-agent-platform-agent-platform-001-rebuild-forward-from-proven |
| Distributed runner | https://linear.app/amo100/issue/IPI-1117/ipi-1117-fix-copilot-runs-across-vercel-instances · https://linear.app/amo100/issue/IPI-1292/ipi-1117-runner-spike-001-spike-3-candidate-architectures-for-cross |
| Brands | https://linear.app/amo100/issue/IPI-1099/ipi-1099-brand-epic-browse-brands-and-approve-brand-dna · https://linear.app/amo100/issue/IPI-1093/ipi-1093-brand-intel-001-turn-a-brand-website-into-an-approved-brand |
| Shoots / Production Copilot | https://linear.app/amo100/issue/IPI-1222/ipi-epic-shoot-v2-complete-the-v2-shoot-planning-approval-save-and · https://linear.app/amo100/issue/IPI-1241/epic-production-copilot-001-complete-the-unified-production-copilot |
| Talent / booking | https://linear.app/amo100/issue/IPI-1101/ipi-1101-booking-epic-coordinate-talent-studio-crew-availability-and · https://linear.app/amo100/issue/IPI-1071/ipi-1071-talent-booking-001-let-operators-find-talent-and-manage |
| Assets / media | https://linear.app/amo100/issue/IPI-1102/ipi-1102-ipi-epic-production-and-media-browse-assets-and-deliver-shoot · https://linear.app/amo100/issue/IPI-1097/ipi-1097-cloudinary-mvp-epic-upload-review-approve-and-deliver-shoot |
| CRM | https://linear.app/amo100/issue/IPI-1103/ipi-epic-crm-run-the-relationship-hub-in-the-new-app · https://linear.app/amo100/issue/IPI-1070/ipi-1070-crm-001-bring-the-proven-ipix-crm-workspace-into-the-new-app |
| Operations | https://linear.app/amo100/issue/IPI-1104/ipi-epic-operations-operator-inbox-and-coordination · https://linear.app/amo100/issue/IPI-1072/ipi-1072-operations-001-bring-the-operator-inbox-and-coordination |
| Analytics | https://linear.app/amo100/issue/IPI-1106/ipi-1106-ipi-epic-analytics-turn-trusted-ipix-data-into-business · https://linear.app/amo100/issue/IPI-1073/ipi-1073-analytics-001-bring-the-existing-analytics-workspace-into-the |
| Plans | https://linear.app/amo100/issue/IPI-1107/ipi-epic-plans-saved-production-plans-not-a-second-planner · https://linear.app/amo100/issue/IPI-1074/ipi-1074-plans-001-bring-the-existing-production-planning-workspace |

### Current Linear documents

| Linear doc | Purpose | URL |
| --- | --- | --- |
| iPix Documentation Standards | Mirror of `DOC-STANDARDS.md` | https://linear.app/amo100/document/ipix-documentation-standards-architecture-reuse-plans-migration-and-9c36e48b4c74 |
| iPix Brands — How It Works, What We Keep & What We Improve | Mirror of `10-brands/BRANDS.md` | https://linear.app/amo100/document/ipix-brands-how-it-works-what-we-keep-and-what-we-improve-8c0b3961a8ff |
| iPix Repo Implementation Index | GitHub/reference-repo inventory and product-area mapping | https://linear.app/amo100/document/ipix-repo-implementation-index-github-references-local-clones-product-c3760f47abcc |
| iPix Agent Platform PRD | Shared runtime/platform requirements | https://linear.app/amo100/document/ipix-agent-platform-prd-163f1a8f0274 |
| iPix Agent Platform Roadmap | Platform/runtime phase sequence | https://linear.app/amo100/document/ipix-agent-platform-roadmap-6b301eb8d809 |
| iPix Reference Reuse Matrix | Existing platform/runtime reuse decisions | https://linear.app/amo100/document/ipix-reference-reuse-matrix-3ed7c0ed1057 |
| iPix Agent Platform Migration Plan | Runtime migration/cutover planning | https://linear.app/amo100/document/ipix-agent-platform-migration-plan-e35d93623a32 |

### Key Linear issues

| Issue | Why it matters | URL |
| --- | --- | --- |
| IPI-1293 · Agent Platform | Master platform/index issue; keep platform/runtime work separate from domain MVPs | https://linear.app/amo100/issue/IPI-1293/ipix-agent-platform-agent-platform-001-rebuild-forward-from-proven |
| IPI-1292 · Runner Spike | Prove cross-instance run lifecycle architecture; separate from product-domain docs | https://linear.app/amo100/issue/IPI-1292/ipi-1117-runner-spike-001-spike-3-candidate-architectures-for-cross |
| IPI-1290 · CopilotKit upgrade | Version alignment/certification dependency | https://linear.app/amo100/issue/IPI-1290/ipi-1290-safely-upgrade-copilotkit-to-1730-channels-0100 |
| IPI-1117 · Cross-instance runner | Root distributed runner defect/evidence | https://linear.app/amo100/issue/IPI-1117/ipi-1117-fix-copilot-runs-across-vercel-instances |

**Rule:** domain docs may reference these platform issues, but should not duplicate or solve them inside Brands/Shoots/Talent/Assets.
## 6. Research/reference sources

These live in the primary working tree at `/home/sk/ipixai/docs/copilotkit-mastra/`. They are research inputs, not automatically current implementation authority.

| Local source | Use it for |
| --- | --- |
| `/home/sk/ipixai/docs/copilotkit-mastra/README.md` | Existing folder overview |
| `/home/sk/ipixai/docs/copilotkit-mastra/09-mastra-repos.md` | Mastra repo/template survey and reuse ideas |
| `/home/sk/ipixai/docs/copilotkit-mastra/copilotkit-links.md` | Official CopilotKit docs/examples reference pack |
| `/home/sk/ipixai/docs/copilotkit-mastra/MASTRA-COPILOTKIT-SEPT1.md` | Large historical Linear/task export; use for research only and verify live status before acting |
| `/home/sk/ipixai/docs/copilotkit-mastra/copilotkit-mastra-prd.md` | Earlier CopilotKit/Mastra product architecture notes |
| `/home/sk/ipixai/docs/copilotkit-mastra/mastra-copilotkit.prd.md` | Earlier canonical PRD/reuse architecture; contains valuable references but some historical assumptions must be rechecked |
| `/home/sk/ipixai/docs/copilotkit-mastra/mastra-links.md` | Mastra official docs/repos and reuse matrix |
| `/home/sk/ipixai/docs/copilotkit-mastra/mastra-plan.md` | Historical Mastra execution planning |
| `/home/sk/ipixai/docs/copilotkit-mastra/plan.md` | Historical CopilotKit × Mastra execution plan |
| `/home/sk/ipixai/docs/copilotkit-mastra/prd.md` | Historical product requirements notes |
| `/home/sk/ipixai/docs/copilotkit-mastra/roadmap.md` | Historical sequencing/roadmap notes |
| `/home/sk/ipixai/docs/copilotkit-mastra/templates.md` | Template/reuse catalog and screen-to-template mapping |
| `/home/sk/ipixai/docs/copilotkit-mastra/tools.md` | Firecrawl/Tavily/browser/channel tool research |
| `/home/sk/ipixai/docs/copilotkit-mastra/supabase-mastra.md` | Supabase/Mastra storage research |
| `/home/sk/ipixai/docs/copilotkit-mastra/brand-plan.md` | Earlier Brand planning notes |
| `/home/sk/ipixai/docs/copilotkit-mastra/todo.md` | Historical task checklist; do not treat statuses as live |
| `/home/sk/ipixai/docs/copilotkit-mastra/links.md` | General reference link collection |
| `/home/sk/ipixai/docs/copilotkit-mastra/reuse-audit/INDEX.md` | Forensic CopilotKit/Mastra proven-model reuse audit, including runner findings |
| `/home/sk/ipixai/docs/copilotkit-mastra/reuse-audit/PLANNING.md` | Runner/platform spike planning derived from the reuse audit |

### Local GitHub reference clones

These are the **actual local Git repositories currently present** under `/home/sk/ipixai/github` (verified from each clone's `remote.origin.url` + current HEAD on 2026-09-20).

| Local clone | GitHub origin | Local HEAD | Best iPix use | Default action |
| --- | --- | --- | --- | --- |
| `/home/sk/ipixai/github/CopilotKit` | https://github.com/CopilotKit/CopilotKit | `47c5510b4909` | Primary CopilotKit source, current examples, Mastra integration, GenUI, canvas, CRM/MCP references | **ADAPT / REFERENCE** |
| `/home/sk/ipixai/github/mastra/clones/mastra` | https://github.com/mastra-ai/mastra | `25d768317009` | Mastra framework source, tests, APIs, workflows, agents, storage | **REFERENCE / VERIFY AGAINST INSTALLED VERSION** |
| `/home/sk/ipixai/github/mastra/clones/template-deep-search` | https://github.com/mastra-ai/template-deep-search | `c2c8fa478d5a` | Brand/market research decomposition, evidence, gap checking | **ADAPT** |
| `/home/sk/ipixai/github/mastra/clones/template-company-knowledge` | https://github.com/mastra-ai/template-company-knowledge | `6fc6a774ae13` | Approved Brand knowledge retrieval / RAG patterns | **ADAPT LATER** |
| `/home/sk/ipixai/github/mastra/clones/template-browsing-agent` | https://github.com/mastra-ai/template-browsing-agent | `fe841f7d12b8` | Browser fallback for JS-only/unstructured sites | **REFERENCE / ADAPT LATER** |
| `/home/sk/ipixai/github/mastra/clones/template-agent-harness` | https://github.com/mastra-ai/template-agent-harness | `3f10a93da682` | Tasks, approvals, workspace, schedules, long-running agent patterns | **MODEL / ADVANCED** |
| `/home/sk/ipixai/github/mastra/clones/workshops` | https://github.com/mastra-ai/workshops | `734b8c167037` | Official learning/pattern library for unfamiliar Mastra features | **REFERENCE** |
| `/home/sk/ipixai/github/mastra/clones/ui-dojo` | https://github.com/mastra-ai/ui-dojo | `7f9893734b59` | Mastra UI / CopilotKit / HITL experiments | **REFERENCE** |
| `/home/sk/ipixai/github/mastra/clones/mastra-auth-examples` | https://github.com/mastra-ai/mastra-auth-examples | `72b9db6351a7` | Auth integration patterns | **REFERENCE / ADAPT ONLY IF CURRENT** |
| `/home/sk/ipixai/github/mastra/clones/mastra-observational-memory-workshop` | https://github.com/mastra-ai/mastra-observational-memory-workshop | `25bff24b385b` | Observational memory research | **ADVANCED / REFERENCE** |
| `/home/sk/ipixai/github/mastra/clones/mastra-smoke` | https://github.com/mastra-ai/mastra-smoke | `25c3c647481d` | Framework smoke/testing examples | **REFERENCE** |
| `/home/sk/ipixai/github/mastra/clones/template-text-to-sql` | https://github.com/mastra-ai/template-text-to-sql | `15e66ee04ed8` | Analytics research only; do not add text-to-SQL without a proven need | **REFERENCE / DEFER** |
| `/home/sk/ipixai/github/mastra/clones/OpenBot` | https://github.com/CopilotKit/OpenBot | `61cc46ae0217` | Governance/audit/HITL architecture and CopilotKit production patterns | **MODEL / REFERENCE** |
| `/home/sk/ipixai/github/mastra/clones/generative-ui` | https://github.com/CopilotKit/generative-ui | `12aa81e3deeb` | Historical GenUI reference; prefer current monorepo example where available | **REFERENCE** |
| `/home/sk/ipixai/github/mastra/clones/agents-everywhere-starter-kit` | https://github.com/CopilotKit/agents-everywhere-starter-kit | `5c8bf4c810bc` | Hackathon/demo reference only | **SKIP FOR PRODUCTION** |
| `/home/sk/ipixai/github/mastra/clones/mastra-supabase-starter` | https://github.com/thedistance/mastra-supabase-starter | `7d33a505055f` | Community Supabase/Mastra test/auth ideas | **REFERENCE ONLY** |
| `/home/sk/ipixai/github/mastra/clones/mastra-base` | https://github.com/hamchowderr/mastra-base | `a065cea10599` | Community Mastra starter ideas | **REFERENCE ONLY** |
| `/home/sk/ipixai/github/mastra/clones/saas-starter-ai` | https://github.com/jorgepedraza88/saas-starter-ai | `d492f6eb2995` | Community SaaS/AI patterns | **REFERENCE ONLY** |

**Clone rule:** a local clone means "available to inspect," **not** "approved to copy." Before COPY/ADAPT, verify the exact source path, commit/tag, license, dependency versions, auth/tenancy assumptions, and tests. Prefer the current CopilotKit monorepo and official Mastra repos/templates over older standalone or community starters.
## 7. Docs still to create

Create docs only when they have a clear job. Do **not** create a large document set before the current-state audit needs it.

### Shared platform docs

| Planned doc | Purpose | When to create |
| --- | --- | --- |
| `00-platform/IPIX-PLATFORM-ARCHITECTURE.md` | Small current shared architecture: auth, tenancy, CopilotKit, Mastra, Supabase, Cloudinary, runtime boundaries | After reconciling current IPI-1293 platform docs with current code |
| `00-platform/IPIX-GLOBAL-REUSE-MATRIX.md` | Master repo/example → iPix domain → exact adaptation map | After consolidating the current Linear Repo Implementation Index + verified local clone inventory |

### Domain docs

Create in this order:

1. `30-shoots/SHOOTS.md`
2. `20-talent/TALENT.md`
3. `40-assets/ASSETS.md`
4. `50-crm/CRM.md`
5. `60-operations/OPERATIONS.md`
6. `70-analytics/ANALYTICS.md`
7. `80-plans/PLANS.md`

### Task/implementation docs

Do **not** pre-create a large implementation-plan library. First audit the domain doc, then create one small task/plan only for a proven gap.

Example:

`SHOOTS.md finds availability gap → create Linear task SHOOT-BOOKING-001 → if multi-step/risky, create a focused implementation plan for that task → implement/test → update SHOOTS.md`

Possible task names are examples, not approved work:

- `SHOOT-BOOKING-001 — Shared availability model`
- `SHOOT-HITL-002 — Prevent duplicate approval writes`
- `TALENT-MATCH-001 — Availability-aware talent matching`
- `ASSET-QA-001 — Check exact asset version before approval`

**Rule:** one concrete gap = one task. Do not create umbrella implementation tasks that mix multiple domains.
## 8. Implementation order

Use dependency order, but keep platform and product work separate:

1. **Platform proof** — IPI-1292 / IPI-1117 only where required for distributed run lifecycle.
2. **Brands** — approved Brand context becomes the upstream source for product planning.
3. **Shoots** — plan, shot list, approvals, booking/production orchestration.
4. **Talent** — availability, matching, shortlist, booking.
5. **Assets** — upload, attach, QA/DNA, approval, delivery.
6. **CRM** — commercial journey around companies, contacts, deals, activities.
7. **Operations** — active work, tasks, owners, exceptions, approvals.
8. **Analytics** — product/business + agent operational metrics from real events only.
9. **Plans** — entitlements, subscriptions, usage, upgrades/downgrades.

Product-domain documentation does **not** wait for platform proof. Domain implementation that depends on remote run ownership must wait for that platform gate; ordinary current-state audits and small non-runner improvements do not.

## 9. What belongs in MVP vs later

| MVP / Core | Later / only when proven needed |
| --- | --- |
| Existing iPix routes and product flows | Browser automation everywhere |
| One clear user journey per domain | Multi-agent supervisor/agent mesh |
| Existing Supabase auth + RLS | New parallel authorization framework |
| Existing durable workflows where already useful | Generic workflow framework/factories |
| Small typed context contracts | Full RAG platform before retrieval is needed |
| Human approval for consequential writes | Autonomous writes |
| Existing Cloudinary/Stripe integrations | Replacement media/billing platforms |
| Controlled reusable UI components | Open-ended generated application UI |
| Targeted tests and measurable acceptance | Large speculative abstraction layers |

### Decision test

Before adding a new framework, service, table, agent, workflow, or abstraction, answer:

1. Which real user journey is blocked without it?
2. What existing iPix capability was checked first?
3. Which official/proven reference was checked?
4. What is the smallest adaptation that solves the gap?
5. What test proves the extra complexity is justified?

If these cannot be answered, defer it.
## 10. New-chat starting point

A new chat should begin here:

1. Read this index.
2. Read [Documentation Standards](00-platform/DOC-STANDARDS.md).
3. Read [Brands](10-brands/BRANDS.md) as the domain-writing/template example.
4. Inspect the current worktree and `origin/main` before trusting old research notes.
5. For the next domain, audit current iPix code first, then verify reference repos, then write the domain doc.
6. Use the reuse-first/MVP guardrail; custom architecture is the last option.
7. Keep IPI-1292/IPI-1117 platform work separate from product-domain planning.

### Current documentation branch history

| Commit | Meaning |
| --- | --- |
| `c4a577d` | Scaffold `docs/ipix-platform/` + initial documentation standard |
| `d8391ec` | Add first Brands architecture/reuse plan |
| `9adac5a` | Make repo-to-iPix adaptations explicit |
| `a739619` | Rewrite Brands in plain English and add readability standard |
| `fb2acb5` | Add Core/MVP anti-overengineering guardrails |

### Next documentation action

**Next:** create `30-shoots/SHOOTS.md` using the Brands writing standard.

Audit before writing recommendations:

- routes/screens/components;
- Supabase tables/RLS/RPCs/functions;
- booking/availability logic;
- Planner/Mastra tools/workflows;
- CopilotKit context/shared-state/HITL use;
- existing tests;
- Cloudinary/Stripe relationships where relevant;
- current production gaps.

Then map external references only to proven gaps, with a real iPix example for every adaptation.
