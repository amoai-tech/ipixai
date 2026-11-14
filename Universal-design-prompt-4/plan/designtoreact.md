# Design → React conversion template (reusable, every page)

Use this for **every** `.dc.html` page in `Universal design prompt/` — Command Center, Brand List/Detail, Shoots List/Detail, Shoot Wizard, Assets, Campaigns, Matching, Channel Preview, Analytics, Campaign Performance, Onboarding.

Full workflow lives in the `design-to-production` skill (`.agents/skills/design-to-production/SKILL.md`) — this doc is the **fill-in-the-blanks plan** you produce per screen before coding, not a replacement for it.

**Worked examples for this template:** [`Shoots List.v2.image-first.dc.html`](../../Universal%20design%20prompt/Shoots%20List.v2.image-first.dc.html) → [IPI-273 / DESIGN-055](https://linear.app/amo100/issue/IPI-273/design-055-shoots-list-react-parity-workspace) and [`Shoot Detail.v2.image-first.dc.html`](../../Universal%20design%20prompt/Shoot%20Detail.v2.image-first.dc.html) → [IPI-337 / DESIGN-054b](https://linear.app/amo100/issue/IPI-337/design-054b-shoot-detail-remaining-tab-parity-6-tabs). Use their plan docs (`PLAN/shoots-list-dc-conversion.md`, `PLAN/shoot-detail-dc-conversion.md`) as the reference shape for every section below.

---

## Every screen follows the same architecture

```text
HTML Design
    ↓
Reuse Audit
    ↓
Component Mapping
    ↓
Layout Parity
    ↓
State Parity
    ↓
Data Wiring          (existing page → preserve, don't rewire; new page → after layout)
    ↓
AI Wiring            (CopilotKit / Mastra / Gemini — only if this screen needs it)
    ↓
Verification
    ↓
Report
```

Same mental model for every developer on every screen — no per-page reinvention of the order.

---

## Skill routing — load the right reference before touching that layer

Each layer of a page conversion has a dedicated skill with the repo-specific best practices. Load it **before** writing code in that layer, not after:

| Layer / trigger | Skill | Load for |
|---|---|---|
| Layout, cards, workspace CSS, states | `design-to-production` | route mapping, §0 Prove, parity scoring |
| Any `.tsx` page/route/loading/error boundary | `nextjs-developer` | App Router, server components, `loading.tsx`/`error.tsx`, server actions, `generateMetadata` |
| Any React component perf/pattern question | `vercel-react-best-practices` | data fetching placement, bundle size, re-render/memo rules — apply during Implement, not as an afterthought pass |
| Any Supabase query, view, RPC, migration, RLS | `ipix-supabase` | schema truth, RLS conventions, migration format — **use before writing/changing any query**, not generic Postgres knowledge |
| Any CopilotKit chat/dock/agent wiring | `copilotkit` | `useAgent`/`useFrontendTool`, AG-UI streaming, `/api/copilotkit` — do not touch `PersistentChatDock` wiring without this |
| Any Mastra agent/workflow/tool | `mastra` | `app/src/mastra/**` — agents, workflows, streaming; verify from installed docs, never train-data APIs |
| Any Gemini call | `gemini` | Edge Functions / Deno only, `generateContent()` only, never `generateImages()` — AI enrichment/scoring, not client-side chat |

Do not invoke more than one for the same concern (see CLAUDE.md "Overlaps"). If a page's plan has zero CopilotKit/Mastra/Gemini/Supabase changes, don't load those skills — most workspace-column parity PRs only need `design-to-production` + `nextjs-developer` + `vercel-react-best-practices`.

---

## Why this differs from a generic "HTML → React" prompt

A generic build-order (tokens → components → static pages → mock data → Supabase → Cloudinary → CopilotKit → Mastra → Gemini) assumes greenfield. **This repo is not greenfield.** Skip straight past what's already shipped:

| Already built — do not rebuild | Where |
|---|---|
| Design tokens | `app/src/styles/tokens.css` |
| Shell (nav, header, layout) | `components/operator-panel/operator-panel.tsx` (`OperatorShell.dc.html`) |
| Right rail | `components/intelligence-panel/intelligence-panel.tsx` (`IntelligencePanel.dc.html`) |
| AI chat dock | CopilotKit dock in operator shell (`PersistentChatDock.dc.html`) |
| Supabase auth + client | wired app-wide |
| Cloudinary helpers | `lib/command-center/sample-images.ts` |
| Mobile shell (tab bar, More sheet, panel-as-sheet) | `components/operator-panel/operator-shell.module.css` + `operator-panel.tsx` (mobile breakpoints) |

**Every new page conversion = workspace column only**, unless the page genuinely needs new shell/rail work (rare — flag it, don't assume it).

### Special flows (not plain page ports — read the flow's own doc first)

- **Model Booking (SCR-21 Booking Wizard, SCR-22 Booking Detail)** — **standalone screens and routes**, per the engineering override in `Universal design prompt/docs/models/02-engineering-reference.md` (D1–D9). Do **not** implement these as `?flow=booking` variants of Shoot Wizard/Shoot Detail — that earlier plan was tried and reversed. They are greenfield routes (`/app/matching/talent/[id]/book`, `/app/bookings/[id]`); the DC prototypes reuse Shoot Wizard/Detail markup only as an authoring shortcut. Needs a new `booking` Mastra agent (does not exist yet) and the `requested→quoted→approved→confirmed` status FSM. Shoot Detail itself only gains an inline booking accordion on the crew row — no new tabs.
- **Casting Review (SCR-09 Matching, Talent tab)** — Matching gets a 4th tab (Talent) with a Casting/Grid/List mode switch and a swipe-style review deck; feeds a Shortlist drawer that deep-links to the Booking Wizard above. Spec: `Universal design prompt/docs/models/screens/SCR-09-Matching-Talent.dc.html`.

Real build order for a page that already has a route + shell (the common case, e.g. Shoots List, Brand Detail):

```text
0. Prove       (disk + Supabase + browser — mandatory, see lessons.md)
1. Discover    → read .dc.html, read current page.tsx + workspace, check progess.md % (if present), check open PRs/worktrees for collisions
2. Reuse audit → §5 — search components/hooks/CSS/utils/RPCs/routes before creating anything
3. Audit       → mismatch table vs current React
4. Plan        → dc-to-react-plan-template.md filled, component map + page architecture (§10, §5b) — plus integration matrix (§6), AI (§7), data contract (§8)
5. Implement   → layout → components → live data → states (test after each) — tokens only, no hardcoded values
6. Verify      → lint, tsc, test, build, browser, screenshots, a11y + performance checklists (§13, §14)
7. Regress     → visual regression gate — HTML vs React side by side (§17)
8. Report      → per-category parity score + gaps (§18)
```

For a page with **no route yet** (Analytics, Campaign Performance) — those are greenfield builds, not parity ports. Flag explicitly before starting; they need a route + page.tsx created first (still reuse shell/rail/tokens).

---

## Core rule

```text
Approved HTML is the visual source of truth.
React must faithfully reproduce that layout.
Any intentional deviation requires documented design approval.

React owns components.
Supabase owns data.
Cloudinary owns images.
CopilotKit owns AI interface.
Mastra owns AI workflows.
Gemini owns AI reasoning.
```

"Faithfully reproduce" means developers don't get to quietly "improve" the design mid-build — a spacing/typography/breakpoint choice that diverges from the `.dc.html` file goes through the RWD-deviation flag in §12, not a silent judgment call.

---

## Source of truth (resolve conflicts before coding)

Plans, worktrees, and migrations drift in this repo (see the [Shoots List plan audit](shoot/PLAN/shoots-list-plan-audit.md) for a real example of a doc going stale mid-build). When two sources disagree, resolve in this priority order — don't just pick whichever is easiest to read:

```text
1. Approved .dc.html page          (visual layout truth)
2. Component library (.dc.html)    (component structure truth)
3. Screen-specific conversion plan (PLAN/<screen>-dc-conversion.md — but re-verify it, see lessons.md)
4. Live schema (Supabase, via ipix-supabase skill — list_tables/list_migrations, not the plan doc's claims)
5. Generated types (app/src/types/supabase.ts)
6. Existing implementation (current disk state — what's actually running)
```

If the plan doc says a column is missing but `list_tables` shows it exists, the plan is wrong — fix the plan, don't recreate the column.

**Status source priority** (replaces relying on `progess.md` alone, since it can be deleted/stale — see note in the screen queue below):

```text
1. Active worktree (git worktree list — is someone already mid-build?)
2. Open PR (gh pr list --state open — is this already in review?)
3. progress/progess tracking doc, if present
4. Latest implementation audit (tasks/design-docs/shoot/docs/*, or run a fresh one)
```

---

## Definition of Ready — before implementation starts

```markdown
## Definition of Ready
- [ ] HTML design approved
- [ ] Route identified (existing or confirmed greenfield)
- [ ] Existing implementation reviewed (§0 Prove production-state table filled)
- [ ] Reuse Audit completed (§5)
- [ ] Data source verified (§0 Prove data-source table filled)
- [ ] Linear task assigned
- [ ] No conflicting PR/worktree (checked per Source of Truth above)
- [ ] Page conversion plan drafted and approved
```

Do not start writing component code until every box is checked — this is what §0 Prove in the `design-to-production` skill enforces; treat it as a gate, not a formality.

---

## Definition of Done — merge checklist

```markdown
## Definition of Done
- [ ] HTML layout matches approved design
- [ ] Components reused where possible (Reuse Audit followed, §5)
- [ ] Design tokens used, no unexplained hardcoded values (§5a)
- [ ] Responsive verified (§8)
- [ ] Accessibility verified (§13)
- [ ] Performance reviewed (§14)
- [ ] Visual regression passed (§17)
- [ ] Live data verified — existing pages: wiring preserved; new pages: real data, no mocks left in
- [ ] No fake business data (crew, budget, scores, dates) or fallback images standing in for real assets
- [ ] Tests pass, build passes, lint passes (§12)
- [ ] Screenshots attached (§17)
- [ ] Documentation updated (plan doc status, `data.md` if data contract changed)
```

A page isn't done because it looks right — it's done when every box above is checked and someone else can verify it from the PR alone.

---

## Per-page plan — sections to fill in

Copy this section list into `tasks/design-docs/<feature>/<screen>-dc-conversion.md` (there's already a template: `tasks/design-docs/dc-to-react-plan-template.md`) for the screen you're converting.

**Screen task files:** each [`tasks/screens/SCR-*.md`](../tasks/screens/) includes **Conversion plan** + linked **wireframe** + **mermaid** (must match [`Pages/`](../Pages/)). Full sections: [`tasks/screens/SCR-TEMPLATE.md`](../screens/SCR-TEMPLATE.md).

### 1. Target

```text
HTML source:   Universal design prompt/<Screen>.v2.image-first.dc.html
React route:   /app/<route>
Page file:     app/src/app/(operator)/app/<route>/page.tsx
Linear issue:  IPI-XXX
Route status:  existing route (workspace-only) | no route yet (greenfield)
```

### 2. §0 Prove — production-state table

```markdown
| Area | Exists today? | This PR changes? |
|------|---------------|------------------|
| Route | ? | |
| Shell | ✅ OperatorPanel (assume yes unless proven otherwise) | No |
| API / view / RPC | ? | |
| Workspace | ? | |
```

### 3. §0 Prove — data-source table (required per tab/column/panel block)

```markdown
| Block | Data source | Empty state | Error state | Image slot: real asset or decorative fallback? |
|-------|-------------|-------------|-------------|--------------------------------------------------|
```

The last column is mandatory whenever the block renders an image — forces the decorative-vs-asset call in §0 instead of discovering it in review.

### 4. Negative rules (per screen, always include)

```markdown
- Do not show fake data for any field the API can return null for.
- Do not show score/history fallbacks when API returns null.
- If data is missing, show a real empty state, not a placeholder value.
- For existing pages: preserve current data wiring for this screen — layout-only PR, no query/hook changes unless §0 proves the data source is wrong.
- Fallback images only where the data-source table above marks the slot "decorative" — never in an "uploaded assets" or asset-grid context.
```

### 5. Reuse audit (mandatory, before creating anything)

```markdown
## Reuse Audit
- [ ] Searched for an existing component (`grep`/`graphify query` across `components/`)
- [ ] Searched for an existing hook (`lib/*/use-*`)
- [ ] Searched for an existing CSS module
- [ ] Searched for an existing utility (`lib/**`)
- [ ] Searched for an existing RPC / view (`ipix-supabase` skill, `list_tables`/`list_migrations`)
- [ ] Searched for an existing route
```

If an existing implementation satisfies ≥80% of the need — reuse it, extend it, do not duplicate. Log what was found even when the answer is "nothing exists," so the next reviewer doesn't re-run the same search.

### 5a. Design token audit

```markdown
## Design Token Audit
Every new component must use:
- [ ] spacing tokens
- [ ] typography tokens
- [ ] color tokens
- [ ] radius tokens
- [ ] shadow tokens
Never hardcode a value unless the token genuinely doesn't exist yet — if so, add it to
`app/src/styles/tokens.css` rather than hardcoding, and note the addition in the PR.
```

### 5b. Page architecture (fill before coding)

```text
Server Component (page.tsx — fetch)
    ↓
Data loader (query/RPC — reused or new, per §0 Prove)
    ↓
Workspace (client component — search/filter/sort/selection state)
    ↓
Cards / list items
    ↓
Dialogs / detail panels (if any)
    ↓
AI surface (intelligence panel content, CopilotKit dock — only if this screen adds any)
    ↓
Actions (mutations — behind HITL approval if AI-originated)
```

Same shape for every page — fill in what's reused vs new per node, don't invent a different structure per screen.

### 6. Page integration matrix (declare scope up front)

```markdown
## Page Integration Matrix

Frontend
- [ ] Route
- [ ] Server Component
- [ ] Client Components
- [ ] Loading
- [ ] Error

Supabase
- [ ] Tables
- [ ] Views
- [ ] RPCs
- [ ] RLS
- [ ] Types

Cloudinary
- [ ] Images
- [ ] Upload
- [ ] Transformations

CopilotKit
- [ ] Chat
- [ ] Suggestions
- [ ] Approval UI

Mastra
- [ ] Agent
- [ ] Workflow
- [ ] Tool

Gemini
- [ ] Generation
- [ ] Structured Output
- [ ] Grounding
```

Check only what this screen actually needs — most workspace-column parity pages check Frontend + Supabase only. An unchecked section is a decision ("this page doesn't need Mastra"), not an oversight. This is what feeds the skill-routing table above: only load the skill for a section you checked.

### 7. AI integration — does this page need AI at all?

```markdown
## AI Integration

Does this page require:
- [ ] CopilotKit?
- [ ] Mastra?
- [ ] Gemini?

If no to all: do not wire any AI dependency into this screen.
If yes to any: document exactly why, and which agent/workflow/prompt it calls.
```

Most screens reuse the existing `IntelligencePanel`/chat dock read-only and need nothing new here — only fill this in when the page adds a *new* AI action, not just displays existing intelligence data.

### 8. Data contract

```markdown
## Data Contract

Reads
- views:
- tables:
- RPCs:

Writes
- mutations:
- server actions:

Images
- Cloudinary:
- Supabase Storage:

External APIs
- yes/no:
```

This is the source-of-record for §0 Prove's data-source table (§3) — fill this first, the per-block table is the same information broken out per UI region.

### 9. Backend wiring (post-layout — what "production complete" actually requires)

Layout parity is not the finish line. Once layout matches, this section tracks what's left before the page is real:

```markdown
## Backend Wiring

Supabase
- tables:
- views:
- RPCs:
- Edge Functions:
- Storage:
- Auth:
- RLS:
- generated types: (regenerated after any schema change — ipix-supabase skill)

Cloudinary
- uploads:
- transformations:
- folders:

API
- route handlers:
- server actions:

State
- optimistic updates:
- cache:
- refresh:

Testing
- integration tests:
```

For **existing pages**, most of this is already wired (per the layout-preservation guardrail) — mark rows "already wired, unchanged" rather than leaving them blank, so the report shows what was verified vs. what's new.

### 10. Component map

| `.dc.html` component | React component | Reuse / Create / Defer | Notes |
|---|---|---|---|
| e.g. `ShootCard.dc.html` | `ShootCard.tsx` | Reuse (exists) | |
| e.g. `<Screen>Card.dc.html` | `<screen>-card.tsx` | Create | new, local to `components/<feature>/` |
| `FilterBar.dc.html` | — | Defer | only if screen doesn't need it |

Never rebuild `OperatorShell`, `NavSidebar`, `IntelligencePanel`, `PersistentChatDock` — reuse only.

### 11. States checklist (every screen)

- [ ] populated
- [ ] selected / detail
- [ ] loading (skeleton, `loading.tsx` route where applicable)
- [ ] empty (real empty state, not fake data — and not a fallback image standing in for missing uploads)
- [ ] error + retry (retry must actually re-fetch — no silent no-op handlers)
- [ ] no-match (search/filter)

### 12. Responsive checklist

- [ ] desktop 1440
- [ ] tablet 1024 (shell breakpoint)
- [ ] mobile 390 (QA standard — see `docs/ecommerce/evidence/*/mobile-verification/`)
- [ ] any breakpoint invented that's **not** in the DC file → mark "needs design approval", not "error"

### 13. Accessibility checklist (every screen)

- [ ] keyboard navigation (tab reaches every interactive element in a sane order)
- [ ] visible focus ring (no `outline: none` without a replacement)
- [ ] tab order matches visual order
- [ ] `aria-label`/`aria-labelledby` on icon-only buttons, tabs, and custom controls
- [ ] color contrast meets WCAG AA against `tokens.css` values actually used
- [ ] screen-reader accessible names for cards/links (not just "click here")

### 14. Performance checklist (every screen)

- [ ] Server Component or Client Component — and why (default server; `"use client"` only where interactivity requires it)
- [ ] Can any client-only logic move to the server?
- [ ] Any component worth lazy-loading (`next/dynamic`) — e.g. dialogs, heavy panels below the fold?
- [ ] Images use `next/image`, not raw `<img>`, unless there's a documented reason not to
- [ ] Lists worth virtualizing (only flag if the DC file/data implies large lists — don't add virtualization speculatively)

Cross-check against `vercel-react-best-practices` before marking any row done — this checklist is the summary, that skill has the actual rules.

### 15. Out of scope (explicit — prevents concern-mixing)

```text
- <adjacent feature intentionally not touched>
- <infra/migration work split into its own PR>
```

### 16. Verification gate (copy-paste, same for every screen)

```bash
cd app
npm run lint
npm test
npx tsc --noEmit
CI=true npm run build
```

Browser: QA account `qa@ipix.test`, app on `:3002`, desktop 1280 + mobile 390, console clean, network 200s.

Screenshots → `docs/qa/screenshots/YYYY-MM-DD/`.

### 17. Visual regression gate

Compare HTML → React side by side (DC server `:8765` vs app `:3002`, see route-map.md). Pass only if:

- [ ] spacing matches
- [ ] typography matches
- [ ] card sizes match
- [ ] paddings match
- [ ] responsive behavior approved (deviations logged, not silently "fixed")

Screenshot comparison required — both images attached to the report, not just the React side.

### 18. Report — parity score by category, not one number

A single "92%" hides which dimension is actually broken. Score each:

| Category | Score | Notes |
|---|---:|---|
| Layout | | |
| Components | | |
| Typography | | |
| States | | |
| Responsive | | |
| Accessibility | | |
| Performance | | |
| **Overall (average)** | | |

Fill `references/report-template.md` from the `design-to-production` skill using this table in place of a single score. Include: files changed, screenshot paths (§17), known gaps (honest, not overstated), readiness 🟢/🟡/🔴.

---

## Guardrails (apply to every page, no exceptions)

- **Greenfield page (no route/data yet):** do not wire real data before static layout matches HTML — build layout with placeholder states first.
- **Existing page (route + data already wired — the common case here):** **preserve current real data wiring while improving layout.** Do not rip out or re-architect working queries/hooks just to reskin a component. Layout PR touches CSS/markup/component structure; data stays as-is unless the data-source table in §0 Prove shows it's actually wrong.
- **Do not add new data wiring until static layout is correct** — if a new field the DC file shows isn't in the current query yet, that's a separate follow-up (schema/query change), not bundled into the layout PR. Land layout first, land new fields second.
- Do not invent new shell/nav/AI-dock architecture — reuse what's shipped.
- Do not fake production data (crew, budget, scores, dates) when the API returns null.
- **Image fallbacks:** allowed only when clearly decorative (e.g. a cover thumbnail with no schema field yet) or explicitly documented in code as a fallback (`heroFallbackForBrand`-style helper, named and commented as such). **Never present a fallback image as if it's a real uploaded shoot/brand asset** — no fallback in an asset grid, moodboard, or "uploaded photos" context where the user would reasonably assume it's their content. If unsure whether a slot is decorative vs. asset-representing, treat it as asset-representing and require a real empty state instead.
- All AI writes require human approval (HITL gate) — this predates any given page PR, don't relitigate it per screen.
- One concern per PR: layout parity, data wiring, and infra/migrations are separate PRs unless trivially small.
- RWD deviations from the DC file are a **design decision to flag**, not an "error" to silently fix your own way.
- Re-verify current disk state before writing status % — don't trust a stale doc (see `lessons.md`, `shoot/lessons-from-brand-parity.md`).

---

## Screen queue (fill in as pages are picked up)

| Screen | Route | Status doc | Linear |
|---|---|---|---|
| Command Center | `/app` | `progess.md` | — |
| Brand List | `/app/brand` | `progess.md` | IPI-271/272 |
| Brand Detail | `/app/brand/[id]` | `progess.md` | IPI-17 |
| Shoots List | `/app/shoots` | `PLAN/shoots-list-dc-conversion.md` | IPI-273 |
| Shoot Detail | `/app/shoots/[id]` | `PLAN/shoot-detail-dc-conversion.md` | IPI-337 |
| Shoot Wizard | `/app/shoots/new` | — | IPI-274 |
| Assets | `/app/assets` | — | IPI-248 |
| Campaigns | `/app/campaigns` | — | — |
| Matching | `/app/matching` | — | — |
| Channel Preview | `/app/preview` | — | — |
| Onboarding | `/app/onboarding` | — | — |
| Analytics | no route yet — greenfield | — | — |
| Campaign Performance | no route yet — greenfield | — | — |
| Booking Wizard (SCR-21) | `/app/matching/talent/[id]/book` — no route yet, greenfield, standalone (see Special flows above) | — | IPI-311 |
| Booking Detail (SCR-22) | `/app/bookings/[id]` — no route yet, greenfield, standalone | — | IPI-312 |

Check `progess.md` and open worktrees/PRs (`git worktree list`, `gh pr list --state open`) before starting any row — parallel work on the same screen is common in this repo.
