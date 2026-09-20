# iPix Reference Index

**Purpose:** one simple starting point for iPix product documentation, live Linear work, external reference repos, and execution order.

**Status snapshot:** 2026-09-20. Linear remains the live authority for issue status, blockers, assignees, and changing completion state.

## Summary

| Status | % Complete | Area | Current state | Next |
| --- | ---: | --- | --- | --- |
| 🟢 | 100% | Reference index | Published for review | Maintain |
| 🟢 | 100% | Documentation standard | Defined | Maintain |
| 🟢 | 100% | Brands | Current-state + reuse plan documented | Implement only proven gaps |
| 🟡 | 70% | Reference repo library | CopilotKit organized; Mastra curation underway | Finish selected Mastra clones |
| 🔵 | 0% | Shoots | Not started | Audit current implementation |
| 🔵 | 0% | Talent | Not started | Start after Shoots |
| 🔵 | 0% | Assets | Not started | Start after Talent |
| 🔵 | 0% | CRM | Not started | Start after Assets |
| 🔵 | 0% | Operations | Not started | Start after CRM |
| 🔵 | 0% | Analytics | Not started | Start after Operations |
| 🔵 | 0% | Plans | Not started | Start after Analytics |
| 🔵 | 0% | Platform architecture | Not started | Reconcile current code + IPI-1293 |
| 🔵 | 0% | Global reuse matrix | Not started | Build from verified domain decisions |

**Legend:** 🟢 complete · 🟡 in progress · 🔴 blocked/failed · 🔵 not started

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

This is the canonical map of **what we are documenting for each product area**. File names live here once; other sections refer to the product area instead of repeating paths.

| Status | % Complete | Product area | Document | What it covers | Next |
| --- | ---: | --- | --- | --- | --- |
| 🟢 | 100% | Docs map | `docs/docs-index.md` | Existing GitHub-native documentation map and source-of-truth rules | Maintain |
| 🟢 | 100% | Reference index | `docs/reference-index.md` | Product areas, planned docs, Linear, repos, research, execution order | Maintain |
| 🟢 | 100% | Documentation standard | `docs/ipix-platform/00-platform/DOC-STANDARDS.md` | Evidence, reuse, migration, testing, readability, MVP rules | Maintain |
| 🔵 | 0% | Platform architecture | `docs/ipix-platform/00-platform/IPIX-PLATFORM-ARCHITECTURE.md` | Shared auth, tenancy, CopilotKit, Mastra, Supabase, Cloudinary, runtime boundaries | Reconcile current code + platform tasks |
| 🔵 | 0% | Global reuse | `docs/ipix-platform/00-platform/IPIX-GLOBAL-REUSE-MATRIX.md` | Verified repo/example → product area → exact adaptation decision | Build from completed domain audits |
| 🟢 | 100% | Brands | `docs/ipix-platform/10-brands/BRANDS.md` | Brand list/detail, intelligence, Brand DNA review, approval, Planner handoff, reuse decisions | Implement only proven gaps |
| 🔵 | 0% | Shoots | `docs/ipix-platform/30-shoots/SHOOTS.md` | Brief, shoot type, direction, shot list, approvals, booking, production, handoff to Assets | Audit current Shoots flow |
| 🔵 | 0% | Talent | `docs/ipix-platform/20-talent/TALENT.md` | Profiles, portfolios, skills, availability, matching, shortlist, booking | Audit after Shoots |
| 🔵 | 0% | Assets | `docs/ipix-platform/40-assets/ASSETS.md` | Upload, Cloudinary, metadata, QA, review, approval, delivery | Audit after Talent |
| 🔵 | 0% | CRM | `docs/ipix-platform/50-crm/CRM.md` | Companies, contacts, deals, activities, proposals, shoot handoff | Audit after Assets |
| 🔵 | 0% | Operations | `docs/ipix-platform/60-operations/OPERATIONS.md` | Work queue, assignments, staffing, vendors, approvals, exceptions, delivery | Audit after CRM |
| 🔵 | 0% | Analytics | `docs/ipix-platform/70-analytics/ANALYTICS.md` | Trusted product/agent events, KPIs, funnels, operational metrics | Audit after Operations |
| 🔵 | 0% | Plans | `docs/ipix-platform/80-plans/PLANS.md` | Saved production plans, entitlements, usage, Stripe lifecycle | Audit after Analytics |

**Per-domain rule:** start with one main domain document. Create extra implementation-plan docs only when a verified gap is complex enough to need one. Do not pre-create umbrella documents.

Every domain document uses the same compact tracker: `dot → % complete → item → current state → next`.

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

Local shared root: `/home/sk/github-repos`

A local clone means **available to inspect**, not approved to copy. Before adapting code, verify source path, commit/tag, license, dependency versions, auth/tenant assumptions, and tests.

### CopilotKit

| Repo | Local path | Use |
| --- | --- | --- |
| CopilotKit | `/home/sk/github-repos/copilotkit/CopilotKit` | Primary current source, runtime, AG-UI, Mastra integration, showcases |
| OpenBot | `/home/sk/github-repos/copilotkit/OpenBot` | Agent governance, permissions, approvals, tools |
| harness-sdk | `/home/sk/github-repos/copilotkit/harness-sdk` | Harness, guardrails, tracing, production agent patterns |
| open-research-ANA | `/home/sk/github-repos/copilotkit/open-research-ANA` | Research canvas/HITL historical reference; prefer current monorepo where newer |
| aimock | `/home/sk/github-repos/copilotkit/aimock` | Deterministic AI, MCP, A2A, AG-UI testing |
| agents-everywhere-starter-kit | `/home/sk/github-repos/copilotkit/agents-everywhere-starter-kit` | Multi-surface agent concepts |
| atomic-crm | `/home/sk/github-repos/copilotkit/atomic-crm` | CRM + Supabase + CopilotKit/MCP patterns |
| open-mcp-client | `/home/sk/github-repos/copilotkit/open-mcp-client` | MCP Apps/client integration |
| generative-ui | `/home/sk/github-repos/copilotkit/generative-ui` | Older standalone GenUI reference |

### Mastra — saved

| Repo | Local path | Use |
| --- | --- | --- |
| mastra | `/home/sk/github-repos/mastra/mastra` | Framework source, workflows, agents, storage, tests |
| workshops | `/home/sk/github-repos/mastra/workshops` | Official learning/reference patterns |
| template-agent-harness | `/home/sk/github-repos/mastra/template-agent-harness` | Tasks, approvals, schedules, long-running work |
| template-deep-search | `/home/sk/github-repos/mastra/template-deep-search` | Research decomposition, evidence, gap checking |
| template-browsing-agent | `/home/sk/github-repos/mastra/template-browsing-agent` | Browser fallback patterns |
| template-company-knowledge | `/home/sk/github-repos/mastra/template-company-knowledge` | Approved knowledge/RAG patterns |
| template-text-to-sql | `/home/sk/github-repos/mastra/template-text-to-sql` | Analytics reference only |
| ui-dojo | `/home/sk/github-repos/mastra/ui-dojo` | UI/CopilotKit/HITL experiments |
| mastra-auth-examples | `/home/sk/github-repos/mastra/mastra-auth-examples` | Authentication patterns |
| mastra-observational-memory-workshop | `/home/sk/github-repos/mastra/mastra-observational-memory-workshop` | Advanced memory reference |
| mastra-smoke | `/home/sk/github-repos/mastra/mastra-smoke` | Compatibility/testing examples |

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
| mastra-supabase-starter | `/home/sk/github-repos/community/mastra-supabase-starter` | Reference only; do not inherit tenant model blindly |
| mastra-base | `/home/sk/github-repos/community/mastra-base` | Structure ideas only |
| saas-starter-ai | `/home/sk/github-repos/community/saas-starter-ai` | SaaS/auth ideas only |

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
7. Run documentation/link validation after documentation changes.

**Next documentation area:** Shoots.