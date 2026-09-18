---
title: "Page migration plan"
description: "How V2 pages map from lumina-studio without copying Worker runtime."
---

# iPix v2 page migration plan

**Date:** 2026-08-24  
**Does not:** copy UI, change app code, or create Linear issues.  
**Evidence:** [amo-tech-ai/lumina-studio](https://github.com/amo-tech-ai/lumina-studio) `app/src/app/**/page.tsx` (local `legacy lumina-studio checkout`, `main` @ `b2d3de8e5`) vs design pack `Universal-design-prompt-4/` vs `SITEMAP.md` vs `progress-tracker.md` (2026-07-12, **stale**).  
**New app today:** [amoai-tech/ipixai](https://github.com/amoai-tech/ipixai) CopilotKit starter — demo `/` only.

Phases: **Core → MVP → Post-MVP → Advanced**. Core stop-line is **IPI-1041 · CORE-001 — Prove Persistence, Restart Recovery, and Cross-Organization Isolation**. Full Operator Shell is **not** Core.

Sitemap: [SITEMAP-V2.md](./SITEMAP-V2.md)

---

## Decision key

| Tag | Meaning |
|---|---|
| **COPY** | Port UX + domain UI; rewrite data/auth to new runtime |
| **COPY + CLEAN** | Same, plus strip Worker/Mastra/auth hacks |
| **REDESIGN** | Keep the job; new IA or honest empty states |
| **REBUILD** | Backend/business exists; UI missing, wrong route, or broken |
| **DROP** | Do not take to v2 |
| **DEFER** | Valid later phase |

**COPY always means:**

- **KEEP:** UX, layout, domain components, proven presentation, tests/behavior.  
- **DO NOT COPY:** Cloudflare Worker/OpenNext AI host, Hyperdrive, ALS, SSE shims, `emitInterruptOutcome`, stale auth wrappers, service-role in the browser, `resourceId: "default"`, `?skip=1` fixtures as product, deprecated nav/runtime glue.

---

## 1. Full route matrix (43 `page.tsx`)

| Legacy route | New route | Decision | Why | Reuse (clean) | Remove | Phase |
|---|---|---|---|---|---|---|
| `/` | `/` | REDESIGN | Studio marketing + CF-constrained `MarketingChat`; v2 is an operator AI product | Hero/services/process *structure* optional | Worker `dynamic()` chat maze, mermaid/katex vendor forcing | Post-MVP marketing |
| `/services/amazon` + 8 siblings | — | DROP | SEO landings, not the operator app | Copy only if a separate marketing site is funded | Entire `(marketing)/services/*` from operator repo | — |
| `/login` | `/login` + `/signup` | COPY + CLEAN | Real Supabase password + Google; page comment still says “stub” — **ignore comment** | `login-form.tsx`, `safe-redirect`, `/auth/callback` *pattern* | Stale stub comments; CF cookie quirks that don’t apply | Core (minimal) / MVP polish |
| `/onboarding` | `/onboarding` | COPY + CLEAN | Real session + crawl; shorter than 13-screen HTML | `onboarding-flow`, DNA payoff | Duplicate `/app/onboarding` except 301 | MVP |
| `/app/onboarding` | — | DROP | Redirect only | — | Nested operator onboarding page | — |
| `/app` | `/app` | COPY + CLEAN | Command Center, live KPIs | `command-center/*`, KPI queries | `DEV_PREVIEW_*`, `?skip=1` | **MVP** (not Core) |
| `/app/brand` | `/app/brand` | COPY + CLEAN | Live `brands` + DNA scores; 13 tests | `brand-hub/brand-list-workspace` | Client service-role if any | MVP |
| `/app/brand/[id]` | `/app/brand/[id]` | COPY + CLEAN | Parallel fetch + reanalyze | `brand-detail-workspace`, scores tabs | Old Mastra crawl host | MVP |
| `/app/shoots` | `/app/shoots` | COPY + CLEAN | `shoot_portfolio_view` | `shoots-list-workspace`, `ShootCard` | — | MVP |
| `/app/shoots/[shootId]` | `/app/shoots/[id]` | COPY + CLEAN | `get_shoot_detail`; fewer tabs than HTML | `shoot-detail-workspace` | Unwired tab chrome | MVP |
| `/app/shoots/new` | `/app/shoots/new` | COPY + CLEAN | Real wizard + commit API; **6/10 design steps**; 802-line page | Step components, commit contract | Inline page god-file; Worker workflow URLs | MVP |
| `/app/campaigns` | `/app/campaigns` | COPY + CLEAN | **Not** a placeholder anymore — `campaigns` table | `campaigns-workspace`, `campaign-card` | July “Coming soon” tickets in docs | MVP |
| `/app/assets` | `/app/assets` | COPY + CLEAN | `listAssets` + filters | `assets-workspace`, upload panel | — | MVP |
| `/app/assets/[id]` | `/app/assets/[id]` | COPY + CLEAN | Detail workspace + tests | `asset-detail-workspace` | — | MVP |
| `/app/preview` | `/app/preview` | COPY | Spec-driven frames; little Worker-runtime coupling | `channel-preview-studio`, `image_specs` | Orphan layout vs shell | MVP |
| `/app/analytics` | `/app/analytics` | REDESIGN | Counts are real; **reach/engagement/CTR/conversions null** | Layout, DNA math | Fake paid-media numbers | Post-MVP |
| `/app/analytics/campaigns` | `/app/analytics/campaigns` | REDESIGN | Same honesty problem | Workspace shell | Mock charts | Post-MVP |
| `/app/inbox` | `/app/inbox` | COPY + CLEAN | RPC-backed; tracker said API-only — **wrong now** | `inbox-workspace`, `list_notifications` | Unread polling CF glue if any | MVP |
| `/app/matching` | `/app/matching` | COPY + CLEAN | Talent tab RPC; other tabs **disabled shells** | `talent-tab`, shortlist drawer | Creator/Asset/Product fake tabs until backends exist | MVP |
| `/app/matching/talent/[id]` | `/app/matching/talent/[id]` | REBUILD | **No page** — profile is `/app/talent/profile?talentId=` | `talent-profile-workspace` | Query-param profile as canonical URL | MVP |
| `/app/matching/talent/[id]/book` | `/app/matching/talent/[id]/book` | COPY + CLEAN | Availability + `create_booking_request` | booking wizard workspace | — | MVP |
| `/app/bookings/[id]` | `/app/bookings/[id]` | COPY + CLEAN | Transitions + optimistic lock; well tested | booking detail workspace | — | MVP |
| `/app/talent` | `/app/talent` or drop | DEFER | Redirect to own profile | RPC `get_own_talent_profile` | Operator-nav clutter | Post-MVP |
| `/app/talent/profile` | `/app/matching/talent/[id]` | REDESIGN | Query-param UX | profile workspace | `?talentId=` as the only address | MVP |
| `/app/talent/onboarding` | `/app/talent/onboarding` | DEFER | Real wizard; two-sided product | `talent-onboarding-wizard` | Operator-only shortcuts | Post-MVP |
| `/app/crm` | `/app/crm` | COPY | Redirect to companies | — | Extra hub dashboard | MVP |
| `/app/crm/companies` | `/app/crm/companies` | COPY + CLEAN | `listCompanies` + tests | companies workspace | Disabled chips only if still dead | MVP |
| `/app/crm/companies/[id]` | `/app/crm/companies/[id]` | COPY + CLEAN | Detail RPC | company-detail workspace | Unbacked AI summary card | MVP |
| `/app/crm/contacts` | `/app/crm/contacts` | COPY + CLEAN | jsonb phones/emails | contacts workspace | — | MVP |
| `/app/crm/contacts/[id]` | `/app/crm/contacts/[id]` | COPY + CLEAN | Strong tests | contact-detail workspace | — | MVP |
| `/app/crm/pipeline` | `/app/crm/pipeline` | COPY + CLEAN | Kanban + `listDeals` | pipeline workspace | Heuristic “at risk” as a score | MVP |
| `/app/crm/pipeline/[id]` | `/app/crm/pipeline/[id]` | COPY + CLEAN | **Now real** `getDealDetail` (July stub is stale) | `deal-detail-workspace` | — | MVP |
| `/app/planner` | `/app/plans` | DEFER | Real hub; **name clash** with AI Planner | hub workspace | Calling this “Core Planner” | Post-MVP |
| `/app/planner/dashboard` | `/app/plans/dashboard` | DEFER | Real KPIs | dashboard workspace | — | Post-MVP |
| `/app/planner/[instanceId]` | `/app/plans/[id]` | DEFER | Read Timeline/Kanban/Calendar/List exist; mutations historically incomplete | `planner-workspace-shell`, view models | Drag/edit until HITL RPC exists in v2 | Post-MVP |
| `/app/planner/[instanceId]/settings` | `/app/plans/[id]/settings` | DEFER | Members live; some tabs off | settings workspace | Disabled tab lies | Post-MVP |

### Design-only / no `page.tsx` (still in HTML sitemap)

| Design SCR | Decision | Phase |
|---|---|---|
| Availability editor (SCR-23) | REBUILD | Post-MVP |
| Role dashboards (SCR-25) | REBUILD | Post-MVP |
| Collaboration/audit as a route (SCR-18) | DEFER — Inbox + evidence cover MVP | Advanced |
| Catalog / collections / PDP crops / events | DROP until a merchant product exists | Advanced |
| Mobile galleries / bottom-nav HTML | REBUILD (no React bottom nav in `app/src`) | Post-MVP (tab bar + sub-768; MVP is desktop ≥768 only) |
| Pricing, features, about, contact pages | DROP or one marketing page | Post-MVP |
| Duplicate Matching.v2 HTML | DROP | — |

### New iPix starter

| Route | Decision | Phase |
|---|---|---|
| `/` weather/proverbs/moon demo | DROP from product path | Core replaces via UI-001 |

---

## 2. Classification counts

| Class | n | Examples |
|---|---:|---|
| COPY | 2 | Channel Preview; CRM hub redirect |
| COPY + CLEAN | 21 | Matrix **rows** (not split `/login`/`/signup`). Command Center, Brand×2, Shoots×3, Campaigns, Assets×2, Inbox, Matching talent, Booking×2, CRM×6, Onboarding, Login |
| REDESIGN | 5 | `/`, analytics×2, talent profile URL, signup split |
| REBUILD | 3 | `/matching/talent/[id]` index, availability, role dashboards |
| DROP | 12+ | 9 service pages, nested onboarding page, catalog/events HTML, demo `/` |
| DEFER | 8 | Production workspace×4, talent self-serve×2, public marketing chat, collab graph |

Implemented (honest product UI + data or auth): **~28**. Placeholders/partial: **~5**. Design-only: **~12+**. Redirects: **3**.

---

## 3. Is there a faster, safer order?

Yes. **Do not** lead MVP with Command Center.

Command Center is a **dashboard of other domains**. Brand + Shoots are the spine, have the tests, and make the home page non-empty.

**Recommended sequence**

```text
CORE
  tokens (map only, no shell)
  login / session
  /app/planner  — AI Production Planner proof (IPI-1051 · UI-001)
  CORE-001 gate  — STOP

MVP
  1. tokens.css + button/card/chip/empty/error/skeleton
  2. Operator Shell + nav + intelligence rail
  3. CopilotKit v2 chat dock (rebuild, don’t copy CF dock)
  4. Brand List → Brand Detail
  5. Shoots List → Shoot Detail
  6. Command Center (now has something to show)
  7. Shoot Wizard (extract 802-line page; compute tools already Core)
  8. Assets → Channel Preview
  9. CRM companies/contacts/pipeline (+ deal detail)
 10. Matching talent + booking wizard/detail
 11. Inbox + onboarding funnel
 12. Campaigns
 13. Settings (thin)

POST-MVP
  Analytics (honest KPIs)
  /app/plans workspace (legacy planner)
  Talent onboarding + availability + role dashboards
  Marketing site (if needed)

ADVANCED
  Catalog / collections / PDP / events
  Extra matching tabs
  Observability/evals UX, long-running HITL recovery
```

Core stays: **no** Command Center, **no** CRM, **no** `/app/plans`.

---

## 4. First 10 pages / components to port (after Core)

| # | Item | Kind | Rationale |
|---:|---|---|---|
| 1 | `tokens.css` → new globals | system | Unblocks visual parity without Worker code |
| 2 | `empty-state` `error-state` `skeleton` `status-chip` `button` `card` | system | Used by every list |
| 3 | Operator Shell + `nav-sidebar` | shell | One chrome; emoji→Lucide |
| 4 | Intelligence panel (read-only) | AI UX | Keep briefing separate from chat |
| 5 | Chat dock | AI UX | **Rebuild** on CopilotKit in `ipix` |
| 6 | Brand List | page | Real data, 13 tests, low coupling |
| 7 | Brand Detail | page | DNA is the product |
| 8 | Shoots List | page | Same spine, `shoot_portfolio_view` |
| 9 | Shoot Detail | page | Operator daily driver |
| 10 | Channel Preview **or** CRM companies | page | Preview = safest isolated win; CRM = more tested if CRM is the next commercial wedge |

**Do not** include Shoot Wizard in the first 10 until the 802-line page is split. **Do not** include production `/app/planner` workspace in the first 10 (name clash + mutations).

---

## 5. Design-system copy order

1. `app/src/styles/tokens.css`  
2. `button` `card` `input` `badge` `separator` `tabs` `dialog` `sheet` `drawer` `skeleton`  
3. `empty-state` `error-state` `status-chip`  
4. `approval-card` `evidence-block` `wizard-step`  
5. `bottom-sheet` (Vaul detents 38/62/90)  
6. `operator-panel` + `nav-sidebar` + `intelligence-panel`  
7. Domain cards: brand, shoot, campaign, talent — **only when that page ports**  
8. `channel-preview-studio` with assets/preview  

**Skip blindly:** whole `components/ui` duplicates of the new starter, HTML `components/*.dc.html`, Copilot generative registry, CF-only lazy chat.

---

## 6. COPY keep / drop (runtime)

| KEEP | DO NOT COPY |
|---|---|
| 3-panel IA, HITL copy, editorial tokens | OpenNext/Worker as Copilot host |
| Domain workspaces + Vitest | Hyperdrive, ALS, DurableAgent, `emitInterruptOutcome` |
| Supabase Auth cookie pattern (adapt to Node) | Service-role in client components |
| RPCs used by CRM/booking/matching | `MASTRA_STORAGE_MODE=noop` |
| `image_specs` driven preview | Combined `npm run dev` |
| Onboarding story + DNA payoff | `resourceId: "default"` |
| Approval + evidence cards | `?skip=1` / `DEV_PREVIEW_*` in prod |

---

## 7. Risks / doc conflicts

1. **`progress-tracker.md` is the wrong SSOT** — it predates CRM deal UI, inbox UI, campaigns, assets, analytics, planner reads, preview studio. Planning from it under-counts ~10 screens.  
2. **HTML prototype counts (31 SCR)** belong in this audit and in git history of root `SITEMAP.md` on `main`. They are not the V2 product map (`docs/sitemap.md`). React has 43 routes including 9 SEO pages.  
3. **Two Planners.** Legacy `/app/planner` ≠ Core AI Production Planner. Merging them in nav will confuse operators and Linear. v2 name: `/app/planner` = AI; `/app/plans` = timeline workspace.  
4. **Login comment vs `LoginForm`.** Docs/comments still say stub; code is live Auth.  
5. **Matching URL.** Design `/app/matching/talent/:id` vs code query-param profile.  
6. **Shoot Wizard.** HTML 10 steps vs code 6 + giant page. Porting “the design” as-is is a rewrite, not a copy.  
7. **Onboarding.** HTML 13 screens vs shorter live funnel.  
8. **Analytics.** UI looks complete; several KPIs are explicitly `null`.  
9. **Mobile.** Design pack has galleries + bottom nav; `app/src` has **no** bottom-nav component (only incidental `sm:`/`md:`). Rebuild is **Post-MVP** (PRD/sitemap: Core/MVP desktop ≥768).  
10. **New repo** still shows weather/proverbs — Core UI-001 must replace it, not sit beside Operator Shell.  
11. **CRM vs Brand.** Two company-like objects; sitemap must keep both (relationship vs DNA).  
12. **Campaigns tracker tickets** still say “Coming soon” while `CampaignsWorkspace` queries `campaigns`.

---

## 8. Totals for the handoff

1. **Actual routes found:** 43 `page.tsx` + 2 auth route handlers.  
2. **Real implemented pages:** ~28 (operator + CRM + booking + onboarding + login + planner reads + preview + campaigns/assets/inbox).  
3. **Placeholders / stubs / partial:** ~5 (matching extra tabs, analytics paid KPIs, talent profile without id, planner mutations, wizard step gap).  
4. **Design-only:** ~12+ HTML SCRs with no React route.  
5. **COPY:** 2.  
6. **COPY + CLEAN:** 24.  
7. **REBUILD:** 3.  
8. **DROP:** 12+ (including 9 service pages + starter demo as product).  
9. **Sitemap:** see Mermaid in [SITEMAP-V2.md](./SITEMAP-V2.md).  
10. **First 10:** tokens → primitives → shell → intelligence → chat rebuild → Brand list/detail → Shoots list/detail → Preview or CRM companies.  
11. **Design system first:** `tokens.css`, status/empty/error, approval/evidence, bottom sheet, then shell.  
12. **Conflicts:** July tracker vs `main`; HTML sitemap vs React; two Planners; login stub comment; matching URLs; wizard/onboarding step counts; analytics null KPIs; no mobile nav in code.  
13. **Confidence:** **84 / 100** (code inventory complete; no production browser pass; planner write-path not re-proven).
