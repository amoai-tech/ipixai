---
title: DC → React conversion plan (template)
version: "2.0"
lastUpdated: "2026-07-04"
applies_to: All DESIGN-* screen parity · use with design-to-production skill
companion: lessons.md · implementation-checklist.md · design-to-production/SKILL.md · designtoreact.md
---

# DC → React conversion plan

**Purpose:** Wireframe-first planning doc so implementation matches `*.v2.image-first.dc.html` on
first pass. Fill this **before** creating a worktree or writing production code.

Section numbers below match [`designtoreact.md`](../designtoreact.md) exactly — its Definition of
Ready/Done and guardrails reference these sections by number (e.g. "§5 Reuse Audit", "§13
Accessibility"). Copy this file to `tasks/design-docs/<feature>/<screen>-dc-conversion.md` per
screen; don't skip a section — an unchecked box is a decision, a missing section is a gap.

---

## 1. Target

| Field | Value |
|-------|-------|
| Linear | IPI-___ |
| HTML source | `Universal design prompt/<Screen>.v2.image-first.dc.html` |
| React route | `/app/...` |
| Page file | `app/src/app/(operator)/app/<route>/page.tsx` |
| Route status | existing route (workspace-only) \| no route yet (greenfield) |
| PR scope | One screen family only |
| Shell | ✅ OperatorPanel — **do not rebuild** |

---

## 2. §0 Prove — production-state table

| Area | Exists today? | This PR changes? |
|------|---------------|-------------------|
| Route | | |
| Shell | ✅ OperatorPanel (assume yes unless proven otherwise) | No |
| Page entry | | |
| Workspace component | | |
| API / view / RPC | | |

---

## 3. §0 Prove — data-source table

| Block | Data source | Empty state | Error state | Image slot: real asset or decorative fallback? |
|-------|-------------|-------------|-------------|--------------------------------------------------|
| | | | | |

The last column is mandatory whenever the block renders an image.

---

## 4. Negative rules

- Do not show fake data for any field the API can return null for.
- Do not show score/history fallbacks when API returns null.
- If data is missing, show a real empty state, not a placeholder value.
- Existing pages: preserve current data wiring — layout-only PR, no query/hook changes unless §2 proves the data source is wrong.
- Fallback images only where §3 marks the slot "decorative" — never in an "uploaded assets" or asset-grid context.
- No `min-h-screen` / legacy hex inside the workspace.

---

## 5. Reuse audit (mandatory, before creating anything)

- [ ] Searched for an existing component (`grep`/`graphify query` across `components/`)
- [ ] Searched for an existing hook (`lib/*/use-*`)
- [ ] Searched for an existing CSS module
- [ ] Searched for an existing utility (`lib/**`)
- [ ] Searched for an existing RPC / view (`ipix-supabase` skill, `list_tables`/`list_migrations`)
- [ ] Searched for an existing route

If an existing implementation satisfies ≥80% of the need — reuse/extend it, don't duplicate. Log
what was found even when the answer is "nothing exists."

### 5a. Design token audit

Every new component must use spacing / typography / color / radius / shadow tokens — never
hardcode a value unless the token genuinely doesn't exist yet (if so, add it to
`app/src/styles/tokens.css`, note the addition in the PR).

| DC value | Token / utility |
|----------|-----------------|
| | |

### 5b. Page architecture

```text
Server Component (page.tsx — fetch)
    ↓
Data loader (query/RPC — reused or new, per §2)
    ↓
Workspace (client component — search/filter/sort/selection state)
    ↓
Cards / list items
    ↓
Dialogs / detail panels (if any)
    ↓
AI surface (intelligence panel content, CopilotKit dock — only if §7 says yes)
    ↓
Actions (mutations — behind HITL approval if AI-originated)
```

---

## 6. Page integration matrix (declare scope up front)

Check only what this screen actually needs — an unchecked section is a decision, not an oversight.

**Frontend** — [ ] Route · [ ] Server Component · [ ] Client Components · [ ] Loading · [ ] Error

**Supabase** — [ ] Tables · [ ] Views · [ ] RPCs · [ ] RLS · [ ] Types

**Cloudinary** — [ ] Images · [ ] Upload · [ ] Transformations

**CopilotKit** — [ ] Chat · [ ] Suggestions · [ ] Approval UI

**Mastra** — [ ] Agent · [ ] Workflow · [ ] Tool

**Gemini** — [ ] Generation · [ ] Structured Output · [ ] Grounding

---

## 7. AI integration — does this page need AI at all?

- [ ] CopilotKit? · [ ] Mastra? · [ ] Gemini?

If no to all: do not wire any AI dependency into this screen. If yes to any: document exactly why,
and which agent/workflow/prompt it calls. Most screens reuse the existing `IntelligencePanel`/chat
dock read-only and need nothing new here.

---

## 8. Data contract

**Reads** — views: ___ · tables: ___ · RPCs: ___
**Writes** — mutations: ___ · server actions: ___
**Images** — Cloudinary: ___ · Supabase Storage: ___
**External APIs** — yes/no: ___

### Field-level map

| DC label / field | DB column / RPC field | Transform |
|-------------------|-----------------------|-----------|
| | | |

Status chips: map DB enum → DC display label + dot color (document in `lib/...-filters.ts`).

---

## 9. Backend wiring (post-layout — what "production complete" requires)

**Supabase** — tables: ___ · views: ___ · RPCs: ___ · Edge Functions: ___ · Storage: ___ · Auth: ___ · RLS: ___ · generated types: ___ (regenerate after any schema change)
**Cloudinary** — uploads: ___ · transformations: ___ · folders: ___
**API** — route handlers: ___ · server actions: ___
**State** — optimistic updates: ___ · cache: ___ · refresh: ___
**Testing** — integration tests: ___

For existing pages, mark rows "already wired, unchanged" rather than leaving blank.

---

## 10. Component map

| `.dc.html` component | React component | Reuse / Create / Defer | Notes |
|---|---|---|---|
| | | | |

Never rebuild `OperatorShell`, `NavSidebar`, `IntelligencePanel`, `PersistentChatDock` — reuse only.

### 10a. Wireframe (scope boundary — center workspace column only)

```text
┌──────────┬──────────────────────────────────────────────┬─────────────┐
│ NavSidebar│  WORKSPACE (this PR)                        │ Intelligence│
│ (shell)  │  ┌ header: title + subtitle + primary CTA ┐ │ Panel       │
│          │  ├ toolbar: search + sort/filter ──────────┤ │ (shell)     │
│          │  ├ filter chips ───────────────────────────┤ │             │
│          │  ├ scroll body: grid / list / empty ───────┤ │             │
│          │  └ chat dock (shell — CopilotKit) ─────────┘ │             │
└──────────┴──────────────────────────────────────────────┴─────────────┘
```

Annotate DC line refs or CSS values from HTML inspect per zone:

| Zone | DC selector / lines | Width / padding | Typography | Notes |
|------|---------------------|-----------------|------------|-------|
| Workspace column | | | | |
| Header row | | | | |
| Grid / list | | | | |
| Card | | | | |

### 10b. Implementation commit order

| # | Commit | Files | Verify |
|---|--------|-------|--------|
| 1 | Layout shell CSS | `*-workspace.tsx`, `*.module.css` | static HTML in browser |
| 2 | Cards (fixture OK) | `*Card.tsx` | side-by-side vs DC `:8765` |
| 3 | Server/client data | `page.tsx`, lib fetch | real row renders |
| 4 | States | empty/error/loading/skeleton | toggle manually |
| 5 | Tests + report | `*.test.tsx`, QA doc | lint test build |

---

## 11. States checklist (every screen)

- [ ] populated
- [ ] selected / detail
- [ ] loading (skeleton, `loading.tsx` route where applicable)
- [ ] empty (real empty state — not fake data, not a fallback image standing in for missing uploads)
- [ ] error + retry (retry must actually re-fetch — no silent no-op handlers)
- [ ] no-match (search/filter)

---

## 12. Responsive checklist

- [ ] desktop 1440
- [ ] tablet 1024 (shell breakpoint)
- [ ] mobile 390 (QA standard — see `docs/ecommerce/evidence/*/mobile-verification/`)
- [ ] any breakpoint invented that's **not** in the DC file → mark "needs design approval", not "error"

| Breakpoint | DC behavior | React target |
|------------|-------------|---------------|
| ≥1280 | | |
| ≤1024 | | |
| ≤720 | | |

---

## 13. Accessibility checklist (every screen)

- [ ] keyboard navigation (tab reaches every interactive element in a sane order)
- [ ] visible focus ring (no `outline: none` without a replacement)
- [ ] tab order matches visual order
- [ ] `aria-label`/`aria-labelledby` on icon-only buttons, tabs, and custom controls
- [ ] color contrast meets WCAG AA against `tokens.css` values actually used
- [ ] screen-reader accessible names for cards/links (not just "click here")

---

## 14. Performance checklist (every screen)

- [ ] Server Component or Client Component — and why (default server; `"use client"` only where interactivity requires it)
- [ ] Any client-only logic that can move to the server?
- [ ] Any component worth lazy-loading (`next/dynamic`) — dialogs, heavy panels below the fold?
- [ ] Images use `next/image`, not raw `<img>`, unless documented otherwise
- [ ] Lists worth virtualizing (only if DC file/data implies large lists)

Cross-check against `vercel-react-best-practices` before marking any row done.

---

## 15. Out of scope (explicit — prevents concern-mixing)

- <adjacent feature intentionally not touched>
- <infra/migration work split into its own PR>

---

## 16. Verification gate

```bash
cd app
npm run lint
npm test
npx tsc --noEmit
CI=true npm run build
```

Browser: QA account `qa@ipix.test`, app on `:3002`, desktop 1280 + mobile 390, console clean,
network 200s. Screenshots → `docs/qa/screenshots/YYYY-MM-DD/`.

---

## 17. Visual regression gate

Compare HTML → React side by side (DC server `:8765` vs app `:3002`, see `route-map.md`).

- [ ] spacing matches
- [ ] typography matches
- [ ] card sizes match
- [ ] paddings match
- [ ] responsive behavior approved (deviations logged, not silently "fixed")

Screenshot comparison required — both images attached to the report, not just the React side.

---

## 18. Report — parity score by category, not one number

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

Fill [`references/report-template.md`](../../.agents/skills/design-to-production/references/report-template.md)
from the `design-to-production` skill using this table in place of a single score. Include: files
changed, screenshot paths (§17), known gaps (honest, not overstated), readiness 🟢/🟡/🔴.

---

## Related

- [`designtoreact.md`](../designtoreact.md) — full build order and skill routing this template implements
- [`lessons.md`](./lessons.md)
- [`shoot/implementation-checklist.md`](./shoot/implementation-checklist.md)
- [`.agents/skills/design-to-production/SKILL.md`](../../.agents/skills/design-to-production/SKILL.md)
- [`design-to-production/references/report-template.md`](../../.agents/skills/design-to-production/references/report-template.md)
