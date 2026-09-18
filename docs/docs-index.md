# iPix documentation inventory

Purpose: one reversible per-file decision map before any documentation is deleted or moved.

Generated from tracked origin/main documentation in amoai-tech/ipixai.

Score /100 = documentation readiness/currentness, not a claim that every factual sentence was independently re-proven.

## Summary

| Decision | Files | Meaning |
|---|---:|---|
| KEEP | 122 | Current source/reference worth retaining |
| UPDATE | 26 | Valuable but stale links/status/API wording need correction |
| ARCHIVE | 116 | Preserve as history/evidence; remove from active navigation |
| REMOVE | 5 | Superseded/malformed/generated; delete only in a later approved cleanup |
| Total | 269 | 267 pre-existing tracked assets + P0 governance files |

Average readiness score: 78/100.

## Source-of-truth order

1. Live runtime / current repository and installed types.
2. docs/prd.md + docs/sitemap.md.
3. Accepted ADRs.
4. Living domain architecture docs.
5. Linear for task status/blockers.
6. Archived audits/plans only as historical evidence.

## Full per-file decision index

| File | Title / role | Decision | Score | Last commit | Broken links | Why |
|---|---|:---:|---:|---|---:|---|
| docs/.mintignore | Mintlify publication boundary | KEEP | 98/100 | 2026-09-17 | 0 | Keeps historical/stale docs in Git while excluding them from the published docs site |
| docs/docs-index.md | iPix documentation inventory | KEEP | 98/100 | 2026-09-17 | 0 | P0 governance index for documentation assets |
| docs/MIGRATE/01-MIGRATE.md | Full task order + Lumina reuse map | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/02-adapt.md | 1. Biggest missing reuse: Intelligence Panel | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/03-linear-tasks-adapt.md | New task I recommend | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/04-linear-changes.md | MIGRATE · Verified Linear changes | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/05-linear-tasks.md | Per-task additions | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/iPix_New_App_Migration_Strategy_and_Roadmap.md | iPix New App Migration Strategy & Roadmap | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/plan-migrate.md | MIGRATE · Plan & roadmap (Lumina → ipixai V2) | ARCHIVE | 62/100 | 2026-09-03 | 1 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/README.md | MIGRATE · Task Linear patch specs | ARCHIVE | 62/100 | 2026-09-03 | 2 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1048-PLANNER-001.md | IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1049-TOOL-001.md | IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1051-UI-001.md | IPI-1051 · UI-001 — Let an iPix Operator Use the Planner in One Simple Authenticated Screen | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1065-APP-001.md | IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1066-Dash-main.md | IPI-1066 · DASH-MAIN-001 — Reuse the Proven iPix Command Center as the Main Dashboard Page | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1067-SHOOT-001.md | IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records | ARCHIVE | 62/100 | 2026-09-09 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1068-BRAND-001.md | IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1069-ASSETS-001.md | IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1070-CRM-001.md | IPI-1070 · CRM-001 — Bring the Proven iPix CRM Workspace Into the New App | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1071-TALENT-BOOKING-001.md | IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1072-OPERATIONS-001.md | IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1073-ANALYTICS-001.md | IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1074-PLANS-001.md | IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1081-PLAN-001.md | IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1083-SHOOT-SAVE-001.md | IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1084-APPROVAL-001.md | IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1085-SHOOT-WIZARD-001.md | IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1087-PLANNER-CONTEXT-001.md | IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1093-BRAND-INTEL-001.md | IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-1140-INTELLIGENCE-RAIL-001.md | IPI-1140 · IPI-1140 · INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/IPI-172-AI-EVIDENCE-001.md | IPI-172 · AI-EVIDENCE-001 — Persist Provider-Neutral Evidence and Citations for iPix AI Decisions | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/dash-backend/README.md | MIGRATE · Dash / backend patch specs | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/marketing/IPI-1053-MARKETING-NAV-001.md | IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/marketing/IPI-1057-MARKETING-HOME-001.md | IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/marketing/IPI-1058-MARKETING-LOGIN-001.md | IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/marketing/IPI-1060-MARKETING-SERVICES-001.md | IPI-1060 · MARKETING-SERVICES-001 — Reuse the Existing iPix Photography Service Pages | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/marketing/IPI-1063-MARKETING-SEO-001.md | IPI-1063 · MARKETING-SEO-001 — Keep the New iPix Marketing Site Searchable and Correctly Indexed | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/marketing/IPI-1064-MARKETING-MEDIA-001.md | IPI-1064 · MARKETING-MEDIA-001 — Reuse and Optimize the Existing iPix Marketing Images, Sliders, and Visual Content | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/marketing/IPI-1089-ONBOARD-001.md | IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace | ARCHIVE | 62/100 | 2026-09-05 | 0 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/marketing/README.md | MIGRATE · Task patch specs (marketing + dash-backend) | ARCHIVE | 62/100 | 2026-09-03 | 1 | Migration-era plan/task copy |
| docs/MIGRATE/tasks/todo.md | MIGRATE · Ordered todo (implementation order) | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era plan/task copy |
| docs/README.md | iPix documentation | KEEP | 98/100 | 2026-09-03 | 0 | P0 fixed: short current documentation router; stale rebuild plan removed |
| docs/adr/001-node-first.md | ADR 001 — Node / Vercel first | KEEP | 95/100 | 2026-08-24 | 0 | Accepted ADR |
| docs/adr/002-mastra-owns-ai-memory.md | ADR 002 — Mastra owns AI memory; Supabase app tables own the shoot | KEEP | 95/100 | 2026-08-24 | 0 | Accepted ADR |
| docs/adr/003-supabase-owns-tenancy.md | ADR 003 — Supabase owns tenant identity | KEEP | 95/100 | 2026-08-24 | 0 | Accepted ADR |
| docs/adr/004-compatibility-bundle.md | ADR 004 — Upgrade CopilotKit + AG-UI + Mastra as one bundle | KEEP | 95/100 | 2026-08-24 | 0 | Accepted ADR |
| docs/adr/README.md | Architecture Decision Records | KEEP | 95/100 | 2026-08-24 | 0 | ADR index |
| docs/cloudflare/01-cloudflare-audit.md | Cloudflare rebuild audit (superseded) | ARCHIVE | 68/100 | 2026-08-24 | 0 | Point-in-time Cloudflare audit |
| docs/cloudflare/01-inventory.md | 01 — Live Cloudflare inventory | ARCHIVE | 68/100 | 2026-08-24 | 0 | Point-in-time Cloudflare audit |
| docs/cloudflare/02-workers.md | 02 — Existing Workers (deep review) | ARCHIVE | 68/100 | 2026-08-24 | 1 | Point-in-time Cloudflare audit |
| docs/cloudflare/03-env-secrets.md | 03 — Secrets and environment contract | ARCHIVE | 68/100 | 2026-08-25 | 0 | Point-in-time Cloudflare audit |
| docs/cloudflare/04-findings-and-plan.md | 04 — Findings, architecture, stages | ARCHIVE | 68/100 | 2026-08-24 | 0 | Point-in-time Cloudflare audit |
| docs/cloudflare/README.md | Cloudflare rebuild audit (live, read-only) | UPDATE | 72/100 | 2026-08-24 | 0 | Rewrite as scoped perimeter reference |
| docs/cloudinary-environment.json | cloudinary-environment.json | KEEP | 95/100 | 2026-09-04 | 0 | Dated environment evidence; no secrets |
| docs/cloudinary-getting-started-preview.html | cloudinary-getting-started-preview.html | REMOVE | 25/100 | 2026-09-04 | 0 | Generated preview artifact |
| docs/cloudinary/CONTRACT-1110-1112.lock.md | Shared contract (do not drift) | UPDATE | 78/100 | 2026-09-03 | 0 | Retain contract; refresh current ownership/status |
| docs/cloudinary/audit-2026-09-02.md | Cloudinary V2 audit — 2026-09-02 (corrected) | ARCHIVE | 64/100 | 2026-09-03 | 0 | Dated audit/draft/prompt |
| docs/cloudinary/cloudinary-advanced-prd.md | Cloudinary Advanced PRD — only features with operator value | ARCHIVE | 58/100 | 2026-09-03 | 0 | Duplicate phase-specific PRD |
| docs/cloudinary/cloudinary-core-prd.md | Cloudinary Core PRD — smallest secure media foundation | ARCHIVE | 58/100 | 2026-09-03 | 0 | Duplicate phase-specific PRD |
| docs/cloudinary/cloudinary-draft.md | Cloudinary — product requirements | ARCHIVE | 64/100 | 2026-09-03 | 1 | Dated audit/draft/prompt |
| docs/cloudinary/cloudinary-mvp-prd.md | Cloudinary MVP PRD — operator media journey | ARCHIVE | 58/100 | 2026-09-03 | 0 | Duplicate phase-specific PRD |
| docs/cloudinary/cloudinary-prd.md | Cloudinary — product requirements (hub) | ARCHIVE | 58/100 | 2026-09-03 | 0 | Duplicate phase-specific PRD |
| docs/cloudinary/cloudinary-production-readiness-prd.md | Cloudinary Production Readiness PRD — cutover last | ARCHIVE | 58/100 | 2026-09-03 | 0 | Duplicate phase-specific PRD |
| docs/cloudinary/cloudinary-prompt.md | Use these instructions to get started with Cloudinary in this directory | ARCHIVE | 64/100 | 2026-09-03 | 0 | Dated audit/draft/prompt |
| docs/cloudinary/index.md | Cloudinary (iPixai) | KEEP | 97/100 | 2026-09-03 | 0 | P0 current media router; installed packages and current route foundation reflected |
| docs/cloudinary/official-repos.md | Official Cloudinary repos — adapt, don’t rebuild | KEEP | 96/100 | 2026-09-03 | 0 | Current official repository reuse map with stale internal references removed |
| docs/cloudinary/prd.md | Cloudinary — product requirements | KEEP | 96/100 | 2026-09-03 | 0 | Canonical media requirements refreshed to current implementation boundary |
| docs/cloudinary/roadmap.md | Cloudinary — roadmap | KEEP | 95/100 | 2026-09-03 | 0 | Canonical media roadmap |
| docs/cloudinary/sept-2-audit.md | Best Cloudinary repository/tool use | ARCHIVE | 64/100 | 2026-09-03 | 0 | Dated audit/draft/prompt |
| docs/cloudinary/todo.md | Cloudinary — tracker | UPDATE | 82/100 | 2026-09-03 | 2 | Media execution catalog; broken internal links |
| docs/copilotkit-mastra/MASTRA-COPILOTKIT-SEPT1.md | IPI-999 · MASTRA-WF-006 — Harden Long-Lived Workflow Recovery, Reconnect & Idempotency | ARCHIVE | 60/100 | 2026-09-03 | 0 | Large point-in-time planning/research doc |
| docs/copilotkit-mastra/brand-plan.md | 1. Phase 0 — finish Core first | ARCHIVE | 60/100 | 2026-09-03 | 0 | Large point-in-time planning/research doc |
| docs/copilotkit-mastra/brand.md | brand.md | UPDATE | 56/100 | 2026-09-03 | 18 | Useful domain guidance; stale archive/status refs; broken internal links |
| docs/copilotkit-mastra/index.md | CopilotKit × Mastra (iPixai) | KEEP | 97/100 | 2026-09-03 | 0 | P0 current AI runtime router with installed package family and ownership contracts |
| docs/copilotkit-mastra/links.md | Official URLs (CopilotKit × Mastra) | UPDATE | 78/100 | 2026-09-03 | 0 | Refresh official links and installed versions |
| docs/copilotkit-mastra/plan.md | CopilotKit × Mastra — plan | UPDATE | 69/100 | 2026-09-03 | 9 | Remove stale API/example assumptions; broken internal links |
| docs/copilotkit-mastra/prd.md | CopilotKit × Mastra — product requirements | UPDATE | 69/100 | 2026-09-03 | 9 | Useful spec; repair stale historical links; broken internal links |
| docs/copilotkit-mastra/roadmap.md | CopilotKit × Mastra — roadmap | UPDATE | 78/100 | 2026-09-03 | 0 | Refresh against current runtime/Linear |
| docs/copilotkit-mastra/templates.md | iPix V2 — Reference architecture and template reuse | UPDATE | 76/100 | 2026-09-03 | 2 | Repair historical/archive links; broken internal links |
| docs/copilotkit-mastra/todo.md | Mastra + CopilotKit — tracker (Foundation + later) | UPDATE | 74/100 | 2026-09-03 | 4 | Linear must remain status SSOT; broken internal links |
| docs/copilotkit-mastra/tools.md | 3. AgentBrowser — my preferred browser automation option | UPDATE | 78/100 | 2026-09-03 | 0 | Verify against current installed APIs |
| docs/cursor/linux-audit.md | iPixAI Linux / Cursor crash audit | ARCHIVE | 60/100 | 2026-08-24 | 0 | Environment-specific audit |
| docs/data/100-prompt-audit.md | iPix Live Supabase + Codebase Production Audit | ARCHIVE | 66/100 | 2026-09-03 | 0 | Point-in-time data snapshot/plan |
| docs/data/README.md | Data / Supabase pack | UPDATE | 82/100 | 2026-09-03 | 3 | Living data architecture entry point; broken internal links |
| docs/data/audit/00-audit-master.md | Audit master | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/01-live-inventory.md | 01 — Live inventory | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/02-identity-organizations.md | 02 — Identity + organizations | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/03-rls-security.md | 03 — RLS + database security | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/04-schema-relationships.md | 04 — Relationships + schema integrity | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/05-indexes-performance.md | 05 — Indexes + performance | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/06-functions-rpcs-triggers.md | 06 — Functions, RPCs + triggers | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/07-mastra-runtime.md | 07 — Mastra runtime | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/08-planner.md | 08 — Planner | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/09-brand-intelligence.md | 09 — Brand Intelligence | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/10-campaign.md | 10 — Campaign | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/11-shoot.md | 11 — Shoot | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/12-talent-booking.md | 12 — Talent + booking | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/13-assets-cloudinary.md | 13 — Assets + Cloudinary | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/14-commerce-publishing.md | 14 — Commerce + publishing | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/15-operations.md | 15 — Operations (CRM, chatbot, notifications) | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/16-edge-functions.md | 16 — Edge Functions | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/17-frontend-backend-wiring.md | 17 — Frontend/backend wiring | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/18-user-journeys.md | 18 — User journeys | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/19-migrations-legacy.md | 19 — Migrations + legacy | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/20-production-readiness.md | 20 — Production readiness | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/21-fix-plan.md | 21 — Fix plan (errors → solutions, execution order) | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/22-fix-plan.md | 22 — Technical fix plan (schema → wiring) | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/23-audit-supa.md | 23 — Concise Supabase verdict (live recheck) | ARCHIVE | 76/100 | 2026-09-03 | 3 | Point-in-time audit evidence |
| docs/data/audit/24-security-definer-deep-audit.md | 24 — SECURITY DEFINER body audit | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/audit/25-code-database-dependency-map.md | 25 — Schema-aware code → database map | ARCHIVE | 76/100 | 2026-09-03 | 0 | Point-in-time audit evidence |
| docs/data/index.md | Data / Supabase | KEEP | 96/100 | 2026-09-03 | 0 | P0 current data/Supabase router; dated audits separated from authority |
| docs/data/prd.md | Data / Supabase — product requirements | KEEP | 95/100 | 2026-09-03 | 0 | Living data requirements |
| docs/data/progress.md | Supabase progress tracker | ARCHIVE | 66/100 | 2026-09-03 | 1 | Point-in-time data snapshot/plan |
| docs/data/roadmap.md | Data / Supabase — roadmap | KEEP | 95/100 | 2026-09-03 | 0 | Living data roadmap |
| docs/data/supa-fix-plan.md | Supabase harden plan (Wave 0) | ARCHIVE | 66/100 | 2026-09-03 | 1 | Point-in-time data snapshot/plan |
| docs/data/tables.md | Best way to understand the 145 iPix tables | ARCHIVE | 66/100 | 2026-09-03 | 0 | Point-in-time data snapshot/plan |
| docs/data/tasks.md | Data / Supabase — tasks | KEEP | 95/100 | 2026-09-03 | 0 | Data task map |
| docs/data/todo.md | Data / Supabase — tracker | UPDATE | 68/100 | 2026-09-03 | 2 | Needs owner/status review; broken internal links |
| docs/design/PAGE-MIGRATION-PLAN.md | iPix v2 page migration plan | ARCHIVE | 65/100 | 2026-08-24 | 0 | Migration/design planning evidence |
| docs/design/SITEMAP-V2.md | iPix v2 sitemap (legacy audit) | ARCHIVE | 65/100 | 2026-08-24 | 0 | Migration/design planning evidence |
| docs/docs.json | docs.json | KEEP | 98/100 | 2026-08-25 | 0 | P0 fixed: navigation contains only existing published pages |
| docs/iPix_MIGRATEv2_Correct_Implementation_Order.md | iPix MIGRATEv2 — Correct Implementation Order | ARCHIVE | 62/100 | 2026-09-03 | 0 | Migration-era implementation order |
| docs/index.mdx | iPix documentation | KEEP | 98/100 | 2026-08-25 | 0 | P0 fixed: current SSOT documentation home |
| docs/ipix-plan.md | Overall recommendation | UPDATE | 78/100 | 2026-08-24 | 0 | Good strategy; rebuild-era wording remains |
| docs/linear/01-initiaves.md | 01-initiaves.md | ARCHIVE | 60/100 | 2026-09-03 | 0 | Point-in-time Linear planning note |
| docs/linear/02-projects.md | 02-projects.md | ARCHIVE | 60/100 | 2026-09-03 | 0 | Point-in-time Linear planning note |
| docs/linear/03-.md | 03-.md | REMOVE | 25/100 | 2026-09-03 | 0 | Malformed filename + point-in-time audit |
| docs/linear/linear-format.md | Linear task format (iPixai) | UPDATE | 78/100 | 2026-09-09 | 0 | Useful standard; verify current terminology |
| docs/mastra/09-mastra-repos.md | Other repos you listed | UPDATE | 78/100 | 2026-08-24 | 0 | Re-verify current official examples |
| docs/mastra/10-mastra-convert.md | 10 — Mastra conversion plan (steps only) | KEEP | 95/100 | 2026-08-24 | 0 | Current conversion contract |
| docs/mastra/Dynamic workflows.md | How they work | ARCHIVE | 60/100 | 2026-08-24 | 0 | Feature research, not current core architecture |
| docs/mastra/agent-harness.md | Recommended iPix Agent Harness architecture | UPDATE | 78/100 | 2026-08-24 | 0 | Verify current Mastra APIs |
| docs/mastra/copilotkit-links.md | copilotkit-links.md | UPDATE | 78/100 | 2026-09-03 | 0 | Consolidate official references |
| docs/mastra/copilotkit-mastra-prd.md | CopilotKit × Mastra — product requirements | ARCHIVE | 55/100 | 2026-09-03 | 21 | Overlapping Mastra/CopilotKit PRD/plan |
| docs/mastra/db-001-matrix.md | DB-001 — Mastra Postgres schema contract | KEEP | 95/100 | 2026-09-01 | 0 | Runtime/database contract evidence |
| docs/mastra/mastra-copilotkit.prd.md | iPix Mastra + CopilotKit — Product Requirements Document | ARCHIVE | 55/100 | 2026-09-03 | 0 | Overlapping Mastra/CopilotKit PRD/plan |
| docs/mastra/mastra-links-plan.md | 1. Mastra Core — use these first | UPDATE | 72/100 | 2026-09-03 | 0 | Verify against installed types/current docs |
| docs/mastra/mastra-links.md | mastra-links.md | UPDATE | 78/100 | 2026-09-03 | 0 | Consolidate official references |
| docs/mastra/mastra-plan 1.md | iPix Mastra rebuild plan | REMOVE | 25/100 | 2026-08-24 | 0 | Duplicate Mastra rebuild plan |
| docs/mastra/mastra-plan.md | Mastra plan for new iPix (Core → MVP → Advanced) | ARCHIVE | 55/100 | 2026-08-24 | 1 | Overlapping Mastra/CopilotKit PRD/plan |
| docs/mastra/mastra-prd-plan.md | iPix Mastra + CopilotKit Product Requirements Document | ARCHIVE | 55/100 | 2026-09-03 | 0 | Overlapping Mastra/CopilotKit PRD/plan |
| docs/mastra/notes-prd.md | notes-prd.md | ARCHIVE | 55/100 | 2026-09-03 | 0 | Overlapping Mastra/CopilotKit PRD/plan |
| docs/mastra/runtime-family.md | IPI-1042 runtime family (pin only) | UPDATE | 78/100 | 2026-08-24 | 0 | Installed AG-UI pin has moved |
| docs/mastra/supabase-mastra.md | Mastra-on-Supabase audit (live, read-only) | UPDATE | 78/100 | 2026-08-24 | 0 | Separate dated audit from living contract |
| docs/mastra/tools.md | 3. AgentBrowser — my preferred browser automation option | UPDATE | 78/100 | 2026-08-24 | 0 | Verify against installed APIs |
| docs/mermaid/Best ways to use Mermaid in iPix.md | 1. Make architecture visible before coding | UPDATE | 78/100 | 2026-09-03 | 0 | Useful guidance; trim duplication |
| docs/mermaid/mermaid-skills.md | Mermaid skills — which one to use | UPDATE | 78/100 | 2026-09-03 | 0 | Verify against currently available skills |
| docs/mermaid/notes/01-prompt.md | 01-prompt.md | ARCHIVE | 55/100 | 2026-09-03 | 0 | Research/prompt note |
| docs/mermaid/notes/02.md | PROJECT SYSTEM MAPPING + MERMAID ANALYSIS | ARCHIVE | 55/100 | 2026-09-03 | 0 | Research/prompt note |
| docs/mermaid/notes/AI + Mermaid.md | AI + Mermaid.md | ARCHIVE | 55/100 | 2026-09-03 | 0 | Research/prompt note |
| docs/mermaid/notes/Enhancing AI System Design Documentation with Mermaid Diagrams.md | Enhancing AI System Design Documentation with Mermaid Diagrams | ARCHIVE | 55/100 | 2026-09-03 | 0 | Research/prompt note |
| docs/mermaid/plan-mermaid.md | iPix Mermaid plan — diagrams as a development tool | ARCHIVE | 62/100 | 2026-09-03 | 0 | Planning note |
| docs/new-plan.md | iPix AI Runtime v2 — plan index | REMOVE | 25/100 | 2026-09-03 | 8 | Superseded index with missing targets |
| docs/notes/01-current-state-audit.md | 01 — Current state audit (AI runtime v2) | ARCHIVE | 58/100 | 2026-09-03 | 1 | Rebuild-era working note |
| docs/notes/02-keep-rebuild-matrix.md | 02 — Keep / rebuild matrix | ARCHIVE | 58/100 | 2026-09-03 | 1 | Rebuild-era working note |
| docs/notes/05-starter-decision.md | 05 — Starter decision (`integrations/mastra`) | ARCHIVE | 58/100 | 2026-09-03 | 3 | Rebuild-era working note |
| docs/notes/06-example-adoption.md | 06 — CopilotKit example adoption plan | ARCHIVE | 58/100 | 2026-09-03 | 1 | Rebuild-era working note |
| docs/notes/07-repo-to-task-map.md | 07 — Repo → task map | ARCHIVE | 58/100 | 2026-09-03 | 0 | Rebuild-era working note |
| docs/notes/08-custom-code-reduction.md | 08 — Custom-code reduction plan | ARCHIVE | 58/100 | 2026-09-03 | 0 | Rebuild-era working note |
| docs/notes/09-build-plan.md | 09 — New iPix AI build plan | ARCHIVE | 58/100 | 2026-09-03 | 0 | Rebuild-era working note |
| docs/notes/10-core-mvp-advanced.md | 10 — Core / MVP / Advanced roadmap | ARCHIVE | 58/100 | 2026-09-03 | 0 | Rebuild-era working note |
| docs/notes/11-product-plan.md | 11 — Product plan (reuse stages) | ARCHIVE | 58/100 | 2026-09-03 | 0 | Rebuild-era working note |
| docs/notes/12-task-roadmap.md | 12 — Task roadmap (sequential Linear backlog) | ARCHIVE | 58/100 | 2026-09-03 | 2 | Rebuild-era working note |
| docs/notes/13-mastra-rebuild.md | 13 — Mastra rebuild (reuse iPix agents) | ARCHIVE | 58/100 | 2026-09-03 | 0 | Rebuild-era working note |
| docs/notes/14-operating-rules.md | 14 — Operating rules (before code) | ARCHIVE | 46/100 | 2026-09-03 | 1 | Rebuild-era working note; stale state wording |
| docs/playwright/setp4-playwright-audit.md | Playwright E2E Audit — PR #53 | ARCHIVE | 74/100 | 2026-09-04 | 0 | PR-specific verification evidence |
| docs/pr-review-guidelines.md | iPix PR Review Guidelines | KEEP | 95/100 | 2026-09-13 | 0 | Current engineering guidance |
| docs/prd.md | iPix V2 — Product Requirements Document | KEEP | 97/100 | 2026-09-03 | 0 | Product SSOT refreshed against current runtime, routes, identity, storage, and media dependencies |
| docs/reference/competitors/README.md | Competitor screenshot references | KEEP | 95/100 | 2026-09-06 | 0 | Competitor research index |
| docs/reference/competitors/gopickle/1-home.png | 1-home.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/10-dash-invoice.png | 10-dash-invoice.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/11-dash-quotation.png | 11-dash-quotation.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/12-dash-bills.png | 12-dash-bills.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/13-dash-crew.png | 13-dash-crew.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/14-studio.png | 14-studio.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/14A-studio.png | 14A-studio.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/14B-studio.png | 14B-studio.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/14C-studio-services.png | 14C-studio-services.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/14D-studio-media.png | 14D-studio-media.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/14E-studio-packages.png | 14E-studio-packages.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/2-get-started.png | 2-get-started.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/3-onboarding.png | 3-onboarding.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/4-onboarding.png | 4-onboarding.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/5-onboarding.png | 5-onboarding.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/6-studio-create.png | 6-studio-create.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/7-dash-bookings.png | 7-dash-bookings.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/7-dash-home.png | 7-dash-home.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/8-dash-studio.png | 8-dash-studio.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/9-dash-albums.png | 9-dash-albums.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/gopickle/9a-dash-albums.png | 9a-dash-albums.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/lunical/1-signup.png | 1-signup.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/lunical/3-signup.png | 3-signup.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/lunical/4-signup.png | 4-signup.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/lunical/5-dash.png | 5-dash.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/1-dash.png | 1-dash.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/10-video.png | 10-video.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/11-packs.png | 11-packs.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/12-ugc.png | 12-ugc.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/13-product.png | 13-product.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/13-ugc.png | 13-ugc.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/15-product.png | 15-product.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/16-product.png | 16-product.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/1A-dash.png | 1A-dash.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/1C-dash-gallery.png | 1C-dash-gallery.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/1D-dash-products.png | 1D-dash-products.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/1E-dash-talent.png | 1E-dash-talent.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/1F-dash-insights.png | 1F-dash-insights.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/1G-dash-competition.png | 1G-dash-competition.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/1H-campaigns.png | 1H-campaigns.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/1b-dash.png | 1b-dash.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/2-shoot-build.png | 2-shoot-build.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/3-shoot-quantity.png | 3-shoot-quantity.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/3-shoot-scenes.png | 3-shoot-scenes.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/4-shoot-models.png | 4-shoot-models.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/5-shoot-upgrades.png | 5-shoot-upgrades.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/6-shoot-virtual.png | 6-shoot-virtual.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/7-shoot-payment.png | 7-shoot-payment.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/7-video.png | 7-video.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/8-video.png | 8-video.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/9-video.png | 9-video.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/soona/soona.md | Soona historical UX research | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/1-home.png | 1-home.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/3-dash.png | 3-dash.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/3-home.png | 3-home.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/4-VISUAL-CONCEPT.png | 4-VISUAL-CONCEPT.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/5-VISUAL-brief.png | 5-VISUAL-brief.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/6-shoot-brief.png | 6-shoot-brief.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/7-product-brief.png | 7-product-brief.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/8-model-brief.png | 8-model-brief.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/8A-model-brief.png | 8A-model-brief.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/8B-model-brief.png | 8B-model-brief.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/8C-model-brief.png | 8C-model-brief.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/8D-model-brief.png | 8D-model-brief.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/8G-shotlist-reference.png | 8G-shotlist-reference.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/9A-shotlist.png | 9A-shotlist.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/9B-shotlist.png | 9B-shotlist.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/9F-shotlist.png | 9F-shotlist.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/shotlists.md | Squareshot raw shot-list pricing fragment | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/squareshot/squareshot.md | Squareshot historical UX research — June 2026 | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/studiodock/1-demo.png | 1-demo.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/studiodock/2-demo.png | 2-demo.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/studiodock/2-photo-studio.png | 2-photo-studio.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/studiodock/4-features.png | 4-features.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/studiodock/5-spaces.png | 5-spaces.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/studiodock/6-sessions.png | 6-sessions.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/studiodock/7-pricing.png | 7-pricing.png | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/reference/competitors/studiodock/studio-dock.md | StudioDock Feature Catalog | KEEP | 94/100 | 2026-09-06 | 0 | Intentional historical/reference asset |
| docs/roadmap.md | iPix product roadmap | KEEP | 96/100 | 2026-09-03 | 0 | Rewritten as durable Now / Next / Later outcomes; Linear owns live status |
| docs/roadmap/IPI-screen-reuse-audit.md | iPix Screen + Feature Reuse Audit | ARCHIVE | 70/100 | 2026-08-30 | 0 | Point-in-time reuse audit |
| docs/screenshots/1-main-dash.png | 1-main-dash.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/2-shoots.png | 2-shoots.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/3-planner.png | 3-planner.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/3.1-planner.png | 3.1-planner.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/4-crm.png | 4-crm.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/4.1-crm.png | 4.1-crm.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/4.2-crm-brand.png | 4.2-crm-brand.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/4.2-crm-companies.png | 4.2-crm-companies.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/5-assets.png | 5-assets.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/5.1-assets.png | 5.1-assets.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/5.2-assets.png | 5.2-assets.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/6-campaigns.png | 6-campaigns.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/7-analytics.png | 7-analytics.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/8-matching.png | 8-matching.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/screenshots/9-notifications.png | 9-notifications.png | KEEP | 92/100 | 2026-09-04 | 0 | Intentional product screenshot reference |
| docs/sitemap.md | iPix V2 — Product sitemap | KEEP | 97/100 | 2026-09-03 | 0 | Route SSOT refreshed against current app routes including /app/brands |
| docs/supabase/ipi-1040-forward-migrations.md | Forward V2 migrations vs production history | KEEP | 95/100 | 2026-09-09 | 0 | Current migration contract |
| docs/supabase/ipi-1161-reconciliation-deployment.md | IPI-1161 schema reconciliation deployment and recovery | KEEP | 95/100 | 2026-09-09 | 0 | Current deployment/recovery runbook |
| docs/todo-draft.md | iPix working catalog | REMOVE | 25/100 | 2026-09-03 | 1 | Superseded by docs/todo.md |
| docs/todo.md | iPix v2 — Active Todo & Implementation Order | UPDATE | 78/100 | 2026-09-03 | 0 | Refresh against live Linear before status use |

## Cleanup rule

No ARCHIVE or REMOVE decision above moves or deletes a file in this P0 pass. A later docs-only cleanup PR can apply those decisions after review.

## P0 completion criteria

- README.md is a short router, not a rebuild-era master plan.
- index.mdx points only to current sources of truth.
- docs.json navigation references only existing pages.
- Every tracked docs asset appears above.
- Historical documents remain preserved until later cleanup approval.
