# MIGRATE · Verified Linear changes

**Updated:** 2026-09-03 (APP-001 certify + DASH-MAIN rename + ordered `todo.md`)  
**Status:** Label hygiene + Rail CREATE + Batch 1 BRAND/SHOOT/ASSETS addenda + **APP-001 post-merge certify addendum** + **IPI-1066 → DASH-MAIN-001** applied. Marketing-batch Linear addenda still pending — use corrected [`tasks/marketing/`](../../MIGRATE/tasks/marketing) specs.
**Executable order:** [`tasks/todo.md`](./tasks/todo.md) · [`01-MIGRATE.md`](./01-MIGRATE.md)
**Sources:** live Linear `v2-ipix` + `MIGRATEv2`; [luminaai/app](https://github.com/amoai-tech/luminaai/tree/main/app); current `ipixai` `main` (APP shell PR #43).  
**Companions:** `plan-migrate.md` · `tasks/` · `02-adapt.md` · `03-linear-tasks-adapt.md`

**Corrections (2026-09-03):** (1) Soften NAV→LOGIN if still hard. (2) BRAND-INTEL ∥ BRAND (APP+AUTH only). (3) Marketing audit ~97/100. (4) **APP-001 = certify-only** (code ahead of Linear). (5) **IPI-1066 = DASH-MAIN-001** at `/app` — not marketing home. (6) **Dashboard-first execution:** DASH-MAIN → BRAND → SHOOT (Brand/Shoot UI is soft, not a Dashboard gate). (7) Next.js ≥16.3.3 = separate security task.

---

## Verdict (re-verified)

| Check | Result |
| --- | --- |
| **New MIGRATEv2 tasks now** | **Exactly one:** **INTELLIGENCE-RAIL-001** |
| Expand CREATE/UPDATE reuse text | **Yes** — 18 MIGRATE owners + **IPI-1051 · UI-001** (external) |
| Extra modules → new tickets? | **No** — fold into existing owners / mine later |
| Deeper discoveries | Copilot generative-UI registry, active-brand sync, operator loading/error, middleware auth-gate tests, Talent/Booking tools, Brand Intel enrichers, deferred agents |
| Overall reuse plan | **98/100** |

**Rule:** do not expand the executable migration graph further. Strengthen bodies; create only the Rail.

---

## 1. MIGRATEv2 hygiene → 25 clean executables

Live view ≈ **25 items** with the wrong 5-in/5-out noise. Target remains **25 executables**, not 30.

### Remove `MIGRATEv2`

| Issue | Why |
| --- | --- |
| **IPI-1076 · DASHBOARD DESIGN** epic | Tracker |
| **IPI-1077 · MARKETING PAGES** epic | Tracker |
| **IPI-1079 · LAUNCH** epic | Tracker |
| **IPI-1080 · DESIGN-001** | Done / reference |
| **IPI-338 · CHANNEL-PREVIEW-001** | M4 clutter |

### Add `MIGRATEv2`

| Issue | Why |
| --- | --- |
| **IPI-1058 · MARKETING-LOGIN-001** | ONBOARD hard blocker |
| **IPI-1064 · MARKETING-MEDIA-001** | Public media migration |
| **IPI-1063 · MARKETING-SEO-001** | robots/sitemap + tests |
| **IPI-1093 · BRAND-INTEL-001** | Agent/tools/workflow reuse |
| **NEW · INTELLIGENCE-RAIL-001** | Only missing cross-page owner |

Keep outside: APP-001, STREAM-001, CORE-001, AI-EVIDENCE, BRAND-KNOWLEDGE, Cloudinary, **UI-001**.

---

## 2. CREATE — only INTELLIGENCE-RAIL-001

| Field | Value |
| --- | --- |
| **Title** | `INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace` |
| **Priority** | High · M2 · `MIGRATEv2` |
| **Do not reuse** | **IPI-1024 · PROACTIVE-INTEL-001** (assumes old panel + `/api/intelligence/panel`) |

### Verified COPY / ADAPT / DROP

| Class | Sources |
| --- | --- |
| **COPY** | `components/intelligence-panel/*` (~20), `evidence-block/*`, `brand-context-panel/*` |
| **ADAPT** | `lib/intelligence/*` (~25 + tests): `build-panel-data`, panel-contract, `normalize-route-path`, scores/approvals helpers → server-trusted org/brand/shoot context |
| **DROP** | `dev-panel-fixture.ts`, old `/api/intelligence/*`, browser tenant authority, write actions, separate AI agent, proactive cards (later **IPI-1024**) |

**v1 scope:** read/display-first. Soft-useful after Brand+Shoot data; **not** a hard blocker for ASSETS/CRM/OPS/TALENT.

---

## 3. UPDATE — verified reuse matrix

Paste into each body: inspect target V2 route → Lumina route → component family → lib family → only Mastra files for that domain → focused tests → API **contracts** if needed → **COPY / ADAPT / DROP**. Installed `origin/main` types win; record versions at task start. Never `npm run dev` (use `dev:ui` / `dev:agent`).

| Action                | Linear task                        |     | Strengthen Lumina reuse                                                                                                                                                                                                                                                                                                                          |                                                                                              Pri |      |
| --------------------- | ---------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -----------------------------------------------------------------------------------------------: | ---- |
| **CREATE**            | **INTELLIGENCE-RAIL-001**          |     | Panel + `lib/intelligence` + EvidenceBlock + brand-context-panel; DROP fixtures                                                                                                                                                                                                                                                                  |                                                                                             High |      |
| **UPDATE**            | **IPI-1068 · BRAND-001**           |     | `brand-hub/*`, `lib/brand-hub*`, greeting, list filters; inspect `context/active-brand-context.tsx` as **behavior** only                                                                                                                                                                                                                         |                                                                                             High |      |
| **UPDATE**            | **IPI-1067 · SHOOT-001**           |     | Shoot list/detail + pure helpers/filter tests + route loading/error; **no** wizard/runtime                                                                                                                                                                                                                                                       |                                                                                             High |      |
| **UPDATE**            | **IPI-1066 · DASH-MAIN-001**       |     | `command-center/*` presentation + pure helpers; **DROP** wholesale `queries.ts` `user_id` / BrandSync / fixtures; route `/app`; nav label **Dashboard** | High |      |
| **UPDATE**            | **IPI-1069 · ASSETS-001**          |     | `assets/*` + `lib/assets/*`; later mine asset-intelligence schemas — **no** AI approval/write in M2                                                                                                                                                                                                                                              |                                                                                             High |      |
| **UPDATE**            | **IPI-1070 · CRM-001**             |     | `crm/*` + CRM helpers/tests; generative follow-up card presentation may be referenced — **CRM agent/tools stay later**                                                                                                                                                                                                                           |                                                                                             High |      |
| **UPDATE**            | **IPI-1071 · TALENT-BOOKING-001**  |     | Separate **Booking + Matching + Talent** routes; `matching/*`, `booking/*`, `talent/*`, `lib/booking/*`; EvidenceBlock match UX; audit `talent-match-tools.ts` + `booking-tools.ts` as **domain contracts** only                                                                                                                                 |                                                                                             High |      |
| **UPDATE**            | **IPI-1072 · OPERATIONS-001**      |     | Notifications UI, inbox route, helpers, loading/error                                                                                                                                                                                                                                                                                            |                                                                                             High |      |
| **UPDATE**            | **IPI-1073 · ANALYTICS-001**       |     | `analytics/*` + `lib/analytics.ts` + tests; bind only metrics proven by V2 truth                                                                                                                                                                                                                                                                 |                                                                                             High |      |
| **UPDATE**            | **IPI-1074 · PLANS-001**           |     | Planner **workspace** route/UI + deterministic helpers — not conversational Planner                                                                                                                                                                                                                                                              |                                                                                             High |      |
| **UPDATE**            | **IPI-1048 · PLANNER-001**         |     | Planner instructions/tests + eliminate `weatherAgent` from registry/persistence/`default`; inspect old routing tests — not model router/runtime                                                                                                                                                                                                  |                                                                                             High |      |
| **UPDATE**            | **IPI-1049 · TOOL-001**            |     | Four compute tools only (+ schemas/tests); optional audit `lookupShotReferences` / `lookupChannelSpecs` **only if PLAN needs them**                                                                                                                                                                                                              |                                                                                             High |      |
| **UPDATE**            | **IPI-1087 · PLANNER-CONTEXT-001** |     | `currentPageContext` + tests; `active-brand-context`; `intelligence-detail-context`; shoot-detail patterns → **one** V2 verified context shared with Rail                                                                                                                                                                                        |                                                                                           Medium |      |
| **UPDATE**            | **IPI-1081 · PLAN-001**            |     | shoot-wizard **schemas/fixtures/tests** + tool schemas → one `ShootPlanSchema`; no workflow runtime                                                                                                                                                                                                                                              |                                                                                             High |      |
| **UPDATE**            | **IPI-1084 · APPROVAL-001**        |     | `approval-card/*` + shoot approval tests + **generative UI presentation concepts**; no old resume transport                                                                                                                                                                                                                                      |                                                                                             High |      |
| **UPDATE**            | **IPI-1093 · BRAND-INTEL-001**     |     | brand-intelligence agent + tools + **~21KB workflow / ~25KB workflow tests** + **visual-identity** + **social-discovery** domain ideas; heavy infra DROP                                                                                                                                                                                         |                                                                                             High |      |
| **UPDATE**            | **IPI-172 · AI-EVIDENCE-001**      |     | EvidenceBlock presentation; brand/talent/intelligence consumers                                                                                                                                                                                                                                                                                  |                                                                                             High |      |
| **UPDATE**            | **IPI-1058 · MARKETING-LOGIN-001** |     | Login UX + `app/auth/callback                                                                                                                                                                                                                                                                                                                    | signout` behavior + **middleware auth-gate test cases**; do **not** port old auth implementation | High |
| **UPDATE**            | **IPI-1089 · ONBOARD-001**         |     | `(onboarding)/onboarding/*`, `onboarding.css`, `components/onboarding/*`, `public/onboarding/*`, selective `lib/onboarding` (nav/idempotency/draft/errors/schemas); ADAPT V2 RPC; **DROP AI kickoff / intake / alternate auth** from tenancy path                                                                                                |                                                                                             High |      |
| **UPDATE · external** | **IPI-1051 · UI-001**              |     | Mine `copilot-tool-presentation.tsx` + `generative-ui-registry.tsx` (**central `useRenderTool` place**, hide-internal / Thinking UX). Do **not** port authenticated provider wholesale. **Caveat:** live UI-001 is primarily **rail/Planner journey proof** — generative-UI is an additive reuse note, not a second chat. Keep **off** MIGRATEv2 |                                                                                             High |      |

Also strengthen (already on migrate set): MARKETING-NAV / HOME / SERVICES / MEDIA / SEO; **SHOOT-SAVE** (shape only; rewrite unsafe DEFINER); **SHOOT-WIZARD** (UI only).

### Dashboard AC addition (every operator route)

Prove: **loading · empty · success · retryable error · unauthorized/not-found**. Lumina `(operator)/error.tsx` + many `loading.tsx` files are UX references — **no** `ERROR-PAGES-001`.

---

## 4. Five reuse categories (add to issue bodies / `03-linear-tasks-adapt.md`)

Not five new tasks:

1. **Shared AI UI** — `generative-ui-registry.tsx` (centralizes `useRenderTool`; currently hides internal tools + CRM draft follow-up), `copilot-tool-presentation.tsx` (Thinking / hide-internal). Owners: **UI-001**, **APPROVAL-001**, later TOOL presentation.
2. **Shared route state** — operator `error`/`loading`; active-brand **presentation sync** (`lib/active-brand/*`) as hint → verified BrandContext; never browser tenant authority.
3. **Security/test oracle** — `middleware-auth-gate.test.ts`, `middleware.test.ts`, `middleware-version-header.test.ts`, auth callback/signout tests/cases. V2 middleware stays authoritative.
4. **Domain AI for later** — Booking agent, Model Match, CRM Assistant + write-like CRM tools, `draftCampaignBrief`, asset intelligence / bulk approval / retakes, `suggestShootBrief`, marketing-chat/lead.
5. **Brand Intel enrichers** — `visual-identity.ts` (+ tests), `social-discovery.ts` mined **inside BRAND-INTEL** as capabilities/tools, not separate V2 agents.

---

## 5. Mastra agents & workflows — classification

### Agents

| Old agent | V2 decision |
| --- | --- |
| Production Planner behavior | **ADAPT NOW → PLANNER-001** |
| Brand Intelligence | **ADAPT NOW → BRAND-INTEL-001** |
| Visual Identity | **Mine inside BRAND-INTEL** (not a separate agent initially) |
| Social Discovery | **Mine inside BRAND-INTEL** (tool/capability) |
| Booking / Model Match / CRM Assistant | **Later** |
| Creative Director routing tests | **Mine later** (campaigns) |
| Public marketing agent | **Later** (marketing chat) |

**Architecture rule:** do **not** reproduce Lumina’s multi-agent registry. V2 = **one main Production Planner** + specialized workflows/tools where they create user value.

### Workflows (only two — confirmed)

| Workflow | Decision |
| --- | --- |
| `brand-intelligence-workflow` (~21KB + ~25KB tests) | **ADAPT heavily** → BRAND-INTEL |
| `shoot-wizard` | Schema/test/sequence **reference only** — ownership stays PLAN → APPROVAL → SAVE → WIZARD |

No hidden backlog of ten valuable workflows.

### Tools — now vs later

| Now (TOOL-001) | Audit optional | Later (other owners) |
| --- | --- | --- |
| `recommendShootType`, `planDeliverables`, `generateShotListDraft`, `estimateShootBudget` | `lookupShotReferences`, `lookupChannelSpecs` if PLAN needs | `suggestShootBrief` → brief edit / **IPI-1137**; asset DNA/retake/bulk approval → MEDIA; `draftCampaignBrief` → M4; booking/talent mutation tools → post-M2 |

---

## 6. Mine later (existing owners — not MIGRATEv2)

| Bundle | Sources | Owner when |
| --- | --- | --- |
| Campaigns | `components/campaigns/*`, `(operator)/app/campaigns/*`, `lib/campaign*`, `draftCampaignBrief` + tests | M4 / Campaign epic |
| Asset Intelligence | `asset-intelligence-schemas`, `draftBulkAssetApproval`, `suggestAssetRetakes`, `getAssetDnaEvidence` | MEDIA-* / DNA after ASSETS browse |
| CRM AI | `crm-assistant-agent`, `mastra/tools/crm/*`, follow-up draft generative UI | post-CRM-001 |
| Booking / Model Match AI | booking-agent, model-match-agent, booking mutation tools | BOOKING-AI / Talent advanced |
| Shoot brief rewrite | `suggestShootBrief` | IPI-1137 or Planner enhancement |
| Proactive rail cards | IPI-1024 | After Rail + domain data |
| Observability | `instrumentation*.ts`, Sentry configs | Separate reliability — Cloudflare-era; design from current Vercel |
| Design tokens | Lumina `tokens.css` / design-system-rules | Reference only — **DESIGN-001 Done**; map styles onto current V2 tokens |

---

## 7. Global rules (strengthen every migrate task)

```text
1. Inspect current ipixai target first
2. Lumina: route → components → lib → domain Mastra only → tests → API contract if needed
3. COPY / ADAPT / DROP matrix → V2 SoT
4. Copy pure code/tests before rewriting
5. Replace auth/org/data/runtime plumbing
6. Cheapest targeted proof; browser when journey requires it
```

**API routes:** schemas, validation, error semantics, negative tests only — never wholesale port.  
**Advisor warnings:** task-local when that feature touches the warned RPC/table; do not serialize all dashboards behind SB-V2-003.  
**New tables:** verify **API grants/exposure + RLS** (not RLS alone).

---

## 8. Relation / description fixes

| Fix | Detail |
| --- | --- |
| **IPI-1087** | Remove redundant `blockedBy` **IPI-1083 · SHOOT-SAVE**; keep **IPI-1085 · SHOOT-WIZARD** |
| **IPI-1048** | AC: no production path imports `weatherAgent`; `default` ≡ Planner instance |
| **IPI-1081 / 1087** | Drop hardcoded Mastra version pins; installed lockfile wins |
| **IPI-1089** | Explicit DROP of onboarding AI kickoff from tenancy |
| Soft waves | ASSETS∥CRM∥OPS∥TALENT after APP — **not** after Rail; HOME not hard-blocked by Brand/Shoot UI; LOGIN ∥ NAV |

---

## 9. Target MIGRATEv2 set (25)

**Public (7):** NAV, LOGIN, ONBOARD, Mkt HOME, SERVICES, MEDIA, SEO  
**Operator (10):** BRAND, SHOOT, HOME, **INTELLIGENCE-RAIL**, ASSETS, CRM, OPS, TALENT, PLANS, ANALYTICS  
**AI (3):** PLANNER, TOOL, BRAND-INTEL  
**Launch (5):** PLAN, APPROVAL, SAVE, WIZARD, CONTEXT  

---

## 10. Apply checklist (when authorized)

- [ ] MIGRATEv2 remove 5 / add 5 (§1)
- [ ] CREATE INTELLIGENCE-RAIL-001
- [ ] UPDATE bodies per §3 + five categories §4
- [ ] UPDATE external UI-001 generative-UI reuse note
- [ ] Fix CONTEXT `blockedBy`; PLANNER weather ACs
- [ ] Sync `todo.md` / `plan-migrate.md` / `03-linear-tasks-adapt.md`

---

## 11. Evidence (2026-09-03)

| Claim | Evidence |
| --- | --- |
| Generative UI registry centralizes `useRenderTool` | `generative-ui-registry.tsx` (590B) + `copilot-tool-presentation.tsx` |
| Active-brand hero sync exists | `lib/active-brand/command-center-hero-sync*` |
| Operator loading/error | `(operator)/error.tsx` + many `loading.tsx` under brand/shoots/crm/planner/… |
| Middleware auth-gate tests | `middleware-auth-gate.test.ts` et al. |
| Brand Intel workflow size | ~21KB / ~25KB workflow + test |
| Only two workflows | `brand-intelligence-workflow`, `shoot-wizard` |
| ONBOARD public assets | `public/onboarding/*` |
| UI-001 exists, non-MIGRATE | Linear **IPI-1051** — rail proof primary |
| weatherAgent still default | `ipixai/src/mastra/index.ts` |

**Verification confidence: 97/100.** Remaining gap: Linear mutations not applied; hosted APP/STREAM cert open.
