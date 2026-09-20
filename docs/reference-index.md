# iPix Reference Index

**Purpose:** one simple starting point for iPix product documentation, live Linear work, external reference repos, and execution order.

**Status snapshot:** 2026-09-20. Linear remains the live authority for issue status, blockers, assignees, and changing completion state.

## Summary

| Order | Status | % Complete | Area | Current state | Next |
| ---: | --- | ---: | --- | --- | --- |
| **1.0** | 🟡 | 60% | Shared Platform | Core docs exist; architecture/reuse docs remain | Complete 1.4 next |
| **2.0** | 🟢 | 100% | Brands | Domain document complete | Add 2.2 only when a proven Brands task exists |
| **3.0** | 🔵 | 0% | Shoots | Not started | Complete 3.1 |
| **4.0** | 🔵 | 0% | Talent | Not started | Complete after Shoots |
| **5.0** | 🔵 | 0% | Assets | Not started | Complete after Talent |
| **6.0** | 🔵 | 0% | CRM | Not started | Complete after Assets |
| **7.0** | 🔵 | 0% | Operations | Not started | Complete after CRM |
| **8.0** | 🔵 | 0% | Analytics | Not started | Complete after Operations |
| **9.0** | 🔵 | 0% | Plans | Not started | Complete after Analytics |

**Legend:** 🟢 complete · 🟡 in progress · 🔴 blocked/failed · 🔵 not started

**Numbering rule:** `1.0`, `2.0`, `3.0` are product areas. Tasks inside each area use `.1`, `.2`, `.3` and continue upward as new work is added. Never renumber later areas.

## 1. Strategy

Use this order for every feature:

`KEEP existing iPix → ADAPT official CopilotKit/Mastra pattern → MODEL proven OSS → TEST real iPix journey → CUSTOM only for the remaining gap`

Rules:

- Keep existing auth, RLS, workflows, Cloudinary, Stripe, and product contracts unless evidence shows they block the journey.
- One source of truth per concern; do not create parallel stores, APIs, or state models.
- Adapt patterns, not entire demo apps.
- Browser automation, advanced RAG, multi-agent orchestration, schedules, and generic frameworks are later unless a real user journey requires them.
- Current code + tests beat old planning notes. Installed package versions beat example-repo `main` when APIs differ.

## 2. Product Areas & Planned Docs

This is the simple ordered task path. Add new tasks using the next number inside that product area; do not renumber later sections.

### 1.0 Shared Platform

| Task | Status | % Complete | Document / item | Next |
| ---: | --- | ---: | --- | --- |
| 1.1 | 🟢 | 100% | `docs/docs-index.md` | Maintain |
| 1.2 | 🟢 | 100% | `docs/reference-index.md` | Maintain |
| 1.3 | 🟢 | 100% | `docs/ipix-platform/00-platform/DOC-STANDARDS.md` | Maintain |
| 1.4 | 🔵 | 0% | `docs/ipix-platform/00-platform/IPIX-PLATFORM-ARCHITECTURE.md` | Reconcile current code + platform tasks |
| 1.5 | 🔵 | 0% | `docs/ipix-platform/00-platform/IPIX-GLOBAL-REUSE-MATRIX.md` | Build from completed domain audits |

### 2.0 Brands

| Task | Status | % Complete | Document / item | Next |
| ---: | --- | ---: | --- | --- |
| 2.1 | 🟢 | 100% | `docs/ipix-platform/10-brands/BRANDS.md` | Add 2.2 only for the next proven Brands task |

### 3.0 Shoots

| Task | Status | % Complete | Document / item | Next |
| ---: | --- | ---: | --- | --- |
| 3.1 | 🔵 | 0% | `docs/ipix-platform/30-shoots/SHOOTS.md` | Audit current Shoots flow |

### 4.0 Talent

| Task | Status | % Complete | Document / item | Next |
| ---: | --- | ---: | --- | --- |
| 4.1 | 🔵 | 0% | `docs/ipix-platform/20-talent/TALENT.md` | Audit after Shoots |

### 5.0 Assets

| Task | Status | % Complete | Document / item | Next |
| ---: | --- | ---: | --- | --- |
| 5.1 | 🔵 | 0% | `docs/ipix-platform/40-assets/ASSETS.md` | Audit after Talent |

### 6.0 CRM

| Task | Status | % Complete | Document / item | Next |
| ---: | --- | ---: | --- | --- |
| 6.1 | 🔵 | 0% | `docs/ipix-platform/50-crm/CRM.md` | Audit after Assets |

### 7.0 Operations

| Task | Status | % Complete | Document / item | Next |
| ---: | --- | ---: | --- | --- |
| 7.1 | 🔵 | 0% | `docs/ipix-platform/60-operations/OPERATIONS.md` | Audit after CRM |

### 8.0 Analytics

| Task | Status | % Complete | Document / item | Next |
| ---: | --- | ---: | --- | --- |
| 8.1 | 🔵 | 0% | `docs/ipix-platform/70-analytics/ANALYTICS.md` | Audit after Operations |

### 9.0 Plans

| Task | Status | % Complete | Document / item | Next |
| ---: | --- | ---: | --- | --- |
| 9.1 | 🔵 | 0% | `docs/ipix-platform/80-plans/PLANS.md` | Audit after Analytics |

**Task rule:** add `2.2`, `2.3`, `3.2`, `3.3`, etc. only when new work is proven. This keeps room for growth without changing the overall order.

Every domain document uses the same compact tracker: `task → dot → % complete → item → current state → next`.

## 3. Linear

**Live project:** https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

Use Linear as the live execution/status authority.

| Area | Primary Linear reference |
| --- | --- |
| Platform | https://linear.app/amo100/issue/IPI-1293/ipix-agent-platform-agent-platform-001-rebuild-forward-from-proven |
| Distributed runner | https://linear.app/amo100/issue/IPI-1292/ipi-1117-runner-spike-001-spike-3-candidate-architectures-for-cross |
| Runner defect | https://linear.app/amo100/issue/IPI-1117/ipi-1117-fix-copilot-runs-across-vercel-instances |
| CopilotKit upgrade | https://linear.app/amo100/issue/IPI-1290/ipi-1290-safely-upgrade-copilotkit-to-1730-channels-0100 |
| Brands | https://linear.app/amo100/issue/IPI-1099/ipi-1099-brand-epic-browse-brands-and-approve-brand-dna |
| Shoots | https://linear.app/amo100/issue/IPI-1222/ipi-epic-shoot-v2-complete-the-v2-shoot-planning-approval-save-and |
| Production Copilot | https://linear.app/amo100/issue/IPI-1241/epic-production-copilot-001-complete-the-unified-production-copilot |
| Talent / booking | https://linear.app/amo100/issue/IPI-1101/ipi-1101-booking-epic-coordinate-talent-studio-crew-availability-and |
| Assets | https://linear.app/amo100/issue/IPI-1102/ipi-1102-ipi-epic-production-and-media-browse-assets-and-deliver-shoot |
| CRM | https://linear.app/amo100/issue/IPI-1103/ipi-epic-crm-run-the-relationship-hub-in-the-new-app |
| Operations | https://linear.app/amo100/issue/IPI-1104/ipi-epic-operations-operator-inbox-and-coordination |
| Analytics | https://linear.app/amo100/issue/IPI-1106/ipi-1106-ipi-epic-analytics-turn-trusted-ipix-data-into-business |
| Plans | https://linear.app/amo100/issue/IPI-1107/ipi-epic-plans-saved-production-plans-not-a-second-planner |

### Linear documents

| Document | URL |
| --- | --- |
| Platform Reference Index | https://linear.app/amo100/document/ipix-platform-reference-index-strategy-and-documentation-map-83f13e00ab83 |
| Documentation Standards | https://linear.app/amo100/document/ipix-documentation-standards-architecture-reuse-plans-migration-and-9c36e48b4c74 |
| Brands | https://linear.app/amo100/document/ipix-brands-how-it-works-what-we-keep-and-what-we-improve-8c0b3961a8ff |
| Repo Implementation Index | https://linear.app/amo100/document/ipix-repo-implementation-index-github-references-local-clones-product-c3760f47abcc |
| Agent Platform PRD | https://linear.app/amo100/document/ipix-agent-platform-prd-163f1a8f0274 |
| Agent Platform Roadmap | https://linear.app/amo100/document/ipix-agent-platform-roadmap-6b301eb8d809 |
| Reference Reuse Matrix | https://linear.app/amo100/document/ipix-reference-reuse-matrix-3ed7c0ed1057 |
| Agent Platform Migration Plan | https://linear.app/amo100/document/ipix-agent-platform-migration-plan-e35d93623a32 |

## 4. Reference Repositories

Local shared root: `~/github-repos`

A local clone means **available to inspect**, not approved to copy. Before adapting code, verify source path, commit/tag, license, dependency versions, auth/tenant assumptions, and tests.

### CopilotKit

| Repo | Local path | Use |
| --- | --- | --- |
| CopilotKit | `~/github-repos/copilotkit/CopilotKit` | Primary current source, runtime, AG-UI, Mastra integration, showcases |
| OpenBot | `~/github-repos/copilotkit/OpenBot` | Agent governance, permissions, approvals, tools |
| harness-sdk | `~/github-repos/copilotkit/harness-sdk` | Harness, guardrails, tracing, production agent patterns |
| open-research-ANA | `~/github-repos/copilotkit/open-research-ANA` | Research canvas/HITL historical reference; prefer current monorepo where newer |
| aimock | `~/github-repos/copilotkit/aimock` | Deterministic AI, MCP, A2A, AG-UI testing |
| agents-everywhere-starter-kit | `~/github-repos/copilotkit/agents-everywhere-starter-kit` | Multi-surface agent concepts |
| atomic-crm | `~/github-repos/copilotkit/atomic-crm` | CRM + Supabase + CopilotKit/MCP patterns |
| open-mcp-client | `~/github-repos/copilotkit/open-mcp-client` | MCP Apps/client integration |
| generative-ui | `~/github-repos/copilotkit/generative-ui` | Older standalone GenUI reference |

### Mastra — saved

| Repo | Local path | Use |
| --- | --- | --- |
| mastra | `~/github-repos/mastra/mastra` | Framework source, workflows, agents, storage, tests |
| workshops | `~/github-repos/mastra/workshops` | Official learning/reference patterns |
| template-agent-harness | `~/github-repos/mastra/template-agent-harness` | Tasks, approvals, schedules, long-running work |
| template-deep-search | `~/github-repos/mastra/template-deep-search` | Research decomposition, evidence, gap checking |
| template-browsing-agent | `~/github-repos/mastra/template-browsing-agent` | Browser fallback patterns |
| template-company-knowledge | `~/github-repos/mastra/template-company-knowledge` | Approved knowledge/RAG patterns |
| template-text-to-sql | `~/github-repos/mastra/template-text-to-sql` | Analytics reference only |
| ui-dojo | `~/github-repos/mastra/ui-dojo` | UI/CopilotKit/HITL experiments |
| mastra-auth-examples | `~/github-repos/mastra/mastra-auth-examples` | Authentication patterns |
| mastra-observational-memory-workshop | `~/github-repos/mastra/mastra-observational-memory-workshop` | Advanced memory reference |
| mastra-smoke | `~/github-repos/mastra/mastra-smoke` | Compatibility/testing examples |

### Mastra — next curated additions

| Status | Repo | Why save it |
| --- | --- | --- |
| 🔵 | https://github.com/mastra-ai/template-kyc-customer-onboarding | Brand/Talent onboarding + checks + HITL |
| 🔵 | https://github.com/mastra-ai/template-customer-refund-agent | Guarded consequential actions, approvals, audit |
| 🔵 | https://github.com/mastra-ai/template-agent-builder | Configurable agent/tool setup reference |
| 🔵 | https://github.com/mastra-ai/gtc-planner | Planner/Shoots structured planning |
| 🔵 | https://github.com/mastra-ai/template-deep-research | Longer Brand/competitive research workflows |
| 🔵 | https://github.com/mastra-ai/template-claw-assistant | Assistant/memory/tool patterns |
| 🔵 | https://github.com/mastra-ai/ai-buddies | Multi-agent/persona collaboration concepts |
| 🔵 | https://github.com/mastra-ai/workflow-builder-template | Workflow composition/editing patterns |
| 🔵 | https://github.com/mastra-ai/workflows-workshop | First-party workflow primitive examples |
| 🔵 | https://github.com/mastra-ai/template-meeting-scheduler | Talent/Shoots scheduling and confirmation |
| 🔵 | https://github.com/mastra-ai/template-security-incident-triage | Ops triage → human review → action pattern |

### Community references

| Repo | Local path | Rule |
| --- | --- | --- |
| mastra-supabase-starter | `~/github-repos/community/mastra-supabase-starter` | Reference only; do not inherit tenant model blindly |
| mastra-base | `~/github-repos/community/mastra-base` | Structure ideas only |
| saas-starter-ai | `~/github-repos/community/saas-starter-ai` | SaaS/auth ideas only |

## 5. Research Archive

Primary research folder: `docs/copilotkit-mastra/`

Use it as historical/research input, not live implementation authority.

| Source | Use |
| --- | --- |
| `README.md` | Folder overview |
| `09-mastra-repos.md` | Mastra repo/template survey |
| `copilotkit-links.md` | CopilotKit official links/examples |
| `mastra-links.md` | Mastra official links/repos |
| `templates.md` | Template and screen mapping |
| `tools.md` | Tool/browser/search research |
| `supabase-mastra.md` | Supabase/Mastra storage research |
| `reuse-audit/INDEX.md` | Proven-model reuse audit |
| `reuse-audit/PLANNING.md` | Runner/platform spike planning |
| `MASTRA-COPILOTKIT-SEPT1.md` | Historical task/export evidence only; verify live status before acting |

## 6. Execution Order

1. Resolve shared platform blockers only where a domain journey requires them.
2. Brands.
3. Shoots.
4. Talent.
5. Assets.
6. CRM.
7. Operations.
8. Analytics.
9. Plans.

For each domain:

`audit current iPix → define real journey → KEEP what works → verify references → choose smallest adaptation → test → create focused Linear task only for proven gaps`

## 7. MVP Rules

- One happy path first.
- KEEP before ADAPT.
- One source of truth.
- Existing auth/RLS/workflows stay unless proven inadequate.
- No speculative framework or abstraction.
- No browser fallback until normal extraction fails.
- No advanced RAG until repeated approved knowledge retrieval is needed.
- No multi-agent orchestration until a single-agent flow cannot satisfy the journey.
- Every added layer must have a test proving why it is needed.

## 8. New-Chat Handoff

1. Start with this reference index.
2. Open the target product-area document from Section 2.
3. Check the live v2-ipix Linear project before creating tasks.
4. Inspect current iPix code/tests before using reference repos.
5. Use the shared reference library only as verified source material.
6. Work in a safe worktree when the primary checkout is dirty.
7. Run `npm run docs:check` and `git diff --check` after documentation changes.

**Next documentation area:** Shoots.
