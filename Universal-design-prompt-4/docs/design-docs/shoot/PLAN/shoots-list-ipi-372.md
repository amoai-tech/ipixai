---
title: Shoots List — DC → React conversion plan (IPI-372 restart)
version: "1.0"
lastUpdated: "2026-07-04"
linear: IPI-372
supersedes: IPI-273 (canceled — see shoots-list-dc-conversion.md, PR #191 closed, no code reused)
dc_source: Universal design prompt/Shoots List.v2.image-first.dc.html
react_route: /app/shoots
status: planning
---

# Shoots List — wireframe + conversion map (fresh build, IPI-372)

**Restart note:** IPI-273/PR #191 is canceled. Per explicit instruction, this build reuses **no
code** from `ipi/273-shoots-list-parity`. This doc is written fresh against current `main`
(`26c4f075`). The only things carried forward from the old effort are *lessons*
([`lessons-from-brand-parity.md`](../lessons-from-brand-parity.md)), not code or the old plan doc.

---

## 1. Target

| Field | Value |
|-------|-------|
| Linear | IPI-372 (DESIGN-055b · Shoots List — React Parity Workspace, restart v2 image-first) |
| HTML source | `Universal design prompt/Shoots List.v2.image-first.dc.html` + `components/ShootCard.dc.html` |
| React route | `/app/shoots` |
| Page file | `app/src/app/(operator)/app/shoots/page.tsx` |
| Route status | existing route (workspace-only rebuild) |
| PR scope | Shoots List only — no Shoot Detail, no Shoot Wizard (IPI-274), no new AI tools |
| Shell | ✅ OperatorPanel — **do not rebuild** |

---

## 2. §0 Prove — production-state table

| Area | Exists today? | This PR changes? |
|------|---------------|-------------------|
| Route | ✅ `/app/shoots` (`page.tsx`, 196 lines) | Rewrite to server-fetch + workspace split |
| Shell | ✅ `OperatorPanel` in `(operator)/layout.tsx` | No |
| Page entry | ✅ client component, `useEffect` fetch | Yes — move to Server Component |
| Workspace component | ❌ none — all inline in `page.tsx` | Yes — new `shoots-list-workspace.tsx` |
| Card component | ✅ `app/src/components/shoot/ShootCard.tsx` (73 lines) | Extend, don't replace |
| API / view | ✅ `shoot_portfolio_view` (Supabase) | No — reuse as-is (IPI-85 contract) |

---

## 3. §0 Prove — data-source table

| Block | Data source | Empty state | Error state | Image slot |
|-------|-------------|-------------|-------------|------------|
| Shoot grid | `shoot_portfolio_view` — `id, name, type, status, dna_score, target_channels, estimated_budget, updated_at` | "No shoots yet" + New shoot CTA | Retry button, real re-fetch | Decorative fallback (no cover-image column exists yet — see §8 gap) |
| Status filter chips | Derived client-side from `status` enum (5 values) | n/a | n/a | n/a |
| DNA badge | `dna_score` (nullable) | `—` dash, no fake number | n/a | n/a |

---

## 4. Negative rules

- Do not show fake DNA scores, budgets, or channel counts when the API returns null.
- Do not fabricate a cover photo from a random stock/AI image — `shoot_portfolio_view` has no
  cover-image column today, so the card uses the same decorative fallback pattern as
  `brandListCoverForBrand` (`sample-images.ts`) until a real column exists (log as gap, not silently fixed).
- Preserve `shoot_portfolio_view` query contract as-is — this PR does not touch IPI-85's fetch shape,
  only where/how it's called (client `useEffect` → Server Component).
- No `min-h-screen` / raw hex (`#FBF8F5`, `#1E293B`, `#E87C4D`, `#64748B`, `#E8E0D8`, `#94A3B8`) —
  replace with `tokens.css` vars.
- Treat fetch failure as an error state with retry, never as an empty list.

---

## 5. Reuse audit (mandatory, before creating anything)

- [x] Searched for an existing component — `ShootCard.tsx` exists (extend), no `ShootsListWorkspace` exists (create, modeled on `BrandListWorkspace`)
- [x] Searched for an existing hook — no `use-shoots-list*` hook exists; `useBrandListContext` is the sibling pattern (not directly reusable — different domain state, but same shape)
- [x] Searched for an existing CSS module — no `shoots-list.module.css`; `brand-list.module.css` (642 lines) is the direct structural template (card/grid/skeleton/filter-chip classes)
- [x] Searched for an existing utility — no `shoot-list-filters.ts`; `brand-list-filters.ts` is the pattern to mirror (status-enum → filter-chip predicate + count label)
- [x] Searched for an existing RPC/view — `shoot_portfolio_view` confirmed live, already used by current `page.tsx`; no new view needed
- [x] Searched for an existing route — `/app/shoots` exists, reused

**Verdict:** No Shoots-domain component satisfies the need (nothing to reuse directly), but the
**brand-hub sibling pattern satisfies ≥80% of the architecture** — reuse the *pattern*
(Server Component page → client Workspace → CSS module → Card → Skeleton), not any brand-domain code.

### 5a. Design token audit

| DC value | Token / utility |
|----------|-----------------|
| Card radius (`1.25rem`) | `--card-radius` (`--radius-xl`, 20px) |
| Card shadow | `--shadow-card` |
| Card border | `--color-border` / `--color-border-strong` (selected/hover) |
| Muted bg (cover placeholder) | `--color-bg-muted` / `--image-placeholder-bg` |
| Image scrim gradient | `--image-scrim` (already defined, top-to-bottom variant needed — DC uses `to bottom`, token is `to top`; confirm direction per real screenshot, may need a local override) |
| Text primary/secondary/muted | `--color-text-primary` / `--color-text-secondary` / `--color-text-muted` |
| Mono font (DNA badge, date) | `--font-mono` |
| Status dot colors (5 real enum values) | **Already defined** — `--status-planning-text/bg`, `--status-active-text/bg`, `--status-post-text/bg`, `--status-complete-text/bg`, `--status-archived-text/bg` (component tokens, `tokens.css:196-206`) — no new tokens needed |
| Primary button (black, "New shoot") | `--btn-primary-bg` / `--btn-primary-text` / `--btn-primary-hover` |

### 5b. Page architecture

```text
Server Component (page.tsx — createSupabaseServerClient, fetch shoot_portfolio_view)
    ↓
Data shaping (reuse existing column set + status→label/dot map, new lib/shoot-list-filters.ts)
    ↓
ShootsListWorkspace (client component — search/filter/status-chip state)
    ↓
ShootCard (extended: real cover image slot, date, brand/type row, DNA badge, status pill)
    ↓
No dialogs/detail panels in this PR (card click → navigate to /app/shoots/[id], existing route)
    ↓
AI surface: none new — IntelligencePanel/chat dock already shipped, read-only, no changes
    ↓
Actions: "New shoot" → navigate to /app/shoots/new (existing wizard route), no new mutation
```

---

## 6. Page integration matrix

**Frontend** — [x] Route · [x] Server Component · [x] Client Components · [x] Loading · [x] Error

**Supabase** — [ ] Tables · [x] Views (`shoot_portfolio_view`, reused) · [ ] RPCs · [ ] RLS (unchanged) · [ ] Types (regenerate only if a query shape changes — it doesn't)

**Cloudinary** — [ ] Images · [ ] Upload · [ ] Transformations (no real shoot cover-image pipeline yet — decorative fallback only, logged as gap)

**CopilotKit** — [ ] Chat · [ ] Suggestions · [ ] Approval UI (dock already shipped, unchanged)

**Mastra** — [ ] Agent · [ ] Workflow · [ ] Tool

**Gemini** — [ ] Generation · [ ] Structured Output · [ ] Grounding

---

## 7. AI integration — does this page need AI at all?

- [ ] CopilotKit? · [ ] Mastra? · [ ] Gemini?

No to all. `IntelligencePanel`/`PersistentChatDock` shells are already wired at the layout level and
untouched by this PR — the DC file's own IntelligencePanel section is explicitly labeled **"Target —
IntelligencePanel not production-wired"**, confirming its rich content is aspirational, not required.

---

## 8. Data contract

**Reads** — views: `shoot_portfolio_view` · tables: none directly · RPCs: none
**Writes** — mutations: none (this PR is read-only list view)
**Images** — Cloudinary: none yet (no cover-image column) · Supabase Storage: none
**External APIs** — no

### Field-level map

| DC label / field | DB column / RPC field | Transform |
|-------------------|------------------------|-----------|
| `title` | `shoot_portfolio_view.name` | direct |
| `brand` | *(not in current view)* | **gap** — view has no brand name join; show shoot `type` in its place until IPI-85 extends the view (log as known gap, do not fabricate) |
| `date` | `shoot_portfolio_view.updated_at` | format as DC mono short date (e.g. "Apr 18") |
| `coverKey` / cover image | *(not in current view)* | decorative fallback image (same pattern as `brandListCoverForBrand`), log as gap |
| `status` (DC: draft/confirmed/in-production/complete) | `shoot_portfolio_view.status` (real: planning/active/post_production/complete/archived) | explicit map — see below |
| `score` (DNA badge) | `shoot_portfolio_view.dna_score` (nullable) | show `—` when null, never fabricate |
| Channel count | `shoot_portfolio_view.target_channels` (array, nullable) | `.length ?? 0` |

**Status enum map** (DB → DC-style label + existing component token):

| DB value | Display label | Token |
|----------|---------------|-------|
| `planning` | Planning | `--status-planning-text` / `--status-planning-bg` |
| `active` | Active | `--status-active-text` / `--status-active-bg` |
| `post_production` | Post-Production | `--status-post-text` / `--status-post-bg` |
| `complete` | Complete | `--status-complete-text` / `--status-complete-bg` |
| `archived` | Archived | `--status-archived-text` / `--status-archived-bg` |

Document this map in new `app/src/lib/shoot-list-filters.ts` (mirrors `brand-list-filters.ts`).

---

## 9. Backend wiring (post-layout)

**Supabase** — tables: unchanged · views: `shoot_portfolio_view` already wired (IPI-85), unchanged · RPCs: none · Edge Functions: none · Storage: none · Auth: unchanged (existing session guard) · RLS: unchanged · generated types: no regen needed (no schema change)
**Cloudinary** — none this PR (cover images are decorative fallback, not real uploads)
**API** — route handlers: none new · server actions: none
**State** — optimistic updates: n/a · cache: none (server-rendered, revalidate on navigation) · refresh: retry button re-fetches on error
**Testing** — integration tests: cover the 5 states + status-filter logic (unit tests on `shoot-list-filters.ts`, component test on `ShootsListWorkspace`)

---

## 10. Component map

| `.dc.html` component | React component | Reuse / Create / Defer | Notes |
|---|---|---|---|
| Workspace shell (header, toolbar, chips, grid) | `shoots-list-workspace.tsx` | Create (pattern-reuse from `brand-list-workspace.tsx`) | New file |
| `components/ShootCard.dc.html` | `app/src/components/shoot/ShootCard.tsx` | Extend existing | Add cover image, date, brand/type row, DC-style status pill + DNA badge |
| IntelligencePanel | *(existing)* | Reuse, no changes | Shell only, per §7 |
| PersistentChatDock / OperatorChatDock | *(existing)* | Reuse, no changes | |
| OperatorPanel/NavSidebar | *(existing)* | Reuse, no changes | Never rebuild |

### 10a. Wireframe (scope boundary — center workspace column only)

```text
┌──────────┬──────────────────────────────────────────────┬─────────────┐
│ NavSidebar│  WORKSPACE (this PR)                        │ Intelligence│
│ (shell)  │  ┌ header: "Shoots" + count + New shoot CTA ┐│ Panel       │
│          │  ├ toolbar: search + Brand·Date filter ─────┤│ (shell only)│
│          │  ├ filter chips (5 status values) ──────────┤│             │
│          │  ├ 3-col grid, 20px gap, ShootCard ×N ───────┤│             │
│          │  └ chat dock (shell — CopilotKit, unchanged)┘│             │
└──────────┴──────────────────────────────────────────────┴─────────────┘
```

| Zone | DC selector / lines | Width / padding | Typography | Notes |
|------|---------------------|-----------------|------------|-------|
| Workspace column | DC L1-50 (`x-dc` root) | max-width 920px, centered | — | matches `brand-list.module.css` `.workspace`/`.workspaceInner` |
| Header row | DC "Shoots" + count + New shoot button | — | title `--font-size-2xl` | mirrors brand header |
| Grid | DC 3-col, 20px gap | `--card-gap` (20px) | — | breakpoints: ≥1280 3-col, ≤1280 2-col, ≤720 1-col (mirrors brand grid) |
| Card | `ShootCard.dc.html` L21-34 | aspect-ratio 4/3 cover | title `0.875rem` semibold, brand/date `0.75rem` | scrim `linear-gradient(to bottom, transparent 45%, rgba(0,0,0,.5))`, DNA badge top-right, status pill bottom-left |

### 10b. Implementation commit order

| # | Commit | Files | Verify |
|---|--------|-------|--------|
| 1 | Layout shell CSS | `shoots-list-workspace.tsx`, `shoots-list.module.css` | static fixture data in browser vs DC `:8765` |
| 2 | Card parity | `ShootCard.tsx` (extended) | side-by-side vs `ShootCard.dc.html` |
| 3 | Server/client data | `page.tsx` → Server Component, `shoot-list-filters.ts` | real rows render, existing `shoot_portfolio_view` query unchanged |
| 4 | States | empty/error/loading (`loading.tsx`)/no-match | toggle manually, retry re-fetches |
| 5 | Tests + report | `*.test.tsx`, QA doc | lint, test, build all green |

---

## 11. States checklist

- [ ] populated
- [ ] selected / detail *(n/a — card click navigates to existing `/app/shoots/[id]` route, no in-page detail panel)*
- [ ] loading (skeleton + `loading.tsx`)
- [ ] empty (real empty state, "No shoots yet" + New shoot CTA)
- [ ] error + retry (retry re-fetches)
- [ ] no-match (search/filter chips)

---

## 12. Responsive checklist

| Breakpoint | DC behavior | React target |
|------------|-------------|---------------|
| ≥1280 | 3-col grid | 3-col grid |
| ≤1280 | 2-col grid (mirrors brand-list) | 2-col grid |
| ≤720 | 1-col grid, filter chips wrap | 1-col grid |

- [ ] desktop 1440
- [ ] tablet 1024
- [ ] mobile 390

---

## 13. Accessibility checklist

- [ ] keyboard navigation (card is a `<button>`/`<Link>`, tab reaches all chips + search + CTA)
- [ ] visible focus ring
- [ ] tab order matches visual order
- [ ] `aria-label` on icon-only search/filter controls
- [ ] color contrast AA on status pills (verify amber/grey text on light bg per DC dot+label style)
- [ ] screen-reader accessible name per card (`aria-label={"Open " + shoot.name}`)

---

## 14. Performance checklist

- [ ] Server Component for `page.tsx` fetch (moves off client `useEffect`)
- [ ] `"use client"` only on `ShootsListWorkspace` (search/filter interactivity)
- [ ] No dialogs/heavy panels below the fold in this PR — no lazy-load needed
- [ ] `next/image` for card cover (even decorative fallback)
- [ ] No virtualization needed (grid size matches brand-list scale)

---

## 15. Out of scope (explicit)

- Shoot Detail tabs (IPI-337, separate issue)
- Shoot Wizard (IPI-274, separate issue)
- Real cover-image pipeline / Cloudinary upload for shoots (tracked as a data-contract gap, not this PR)
- `shoot_portfolio_view` query/column changes (IPI-85 territory — flag as follow-up if `brand`/cover fields are needed)
- New AI tools/agents — IntelligencePanel content stays shell-only per DC's own "not production-wired" label
- Any code or file from the canceled `ipi/273-shoots-list-parity` branch

---

## 16. Verification gate

```bash
cd app
npm run lint
npm test
npx tsc --noEmit
CI=true npm run build
```

Browser: QA account `qa@ipix.test`, app on `:3002`, desktop 1280 + mobile 390, console clean, network 200s.

---

## 17. Visual regression gate

Compare HTML → React side by side (DC server `:8765` vs app `:3002`).

- [ ] spacing matches
- [ ] typography matches
- [ ] card sizes match
- [ ] paddings match
- [ ] responsive behavior approved

---

## 18. Report — parity score by category

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

Fill [`report-template.md`](../../../../.agents/skills/design-to-production/references/report-template.md) at ship time.

---

## Related

- [`../../dc-to-react-plan-template.md`](../../dc-to-react-plan-template.md)
- [`../../designtoreact.md`](../../designtoreact.md)
- [`../lessons-from-brand-parity.md`](../lessons-from-brand-parity.md)
- Canceled reference (do not reuse code): `shoots-list-dc-conversion.md` (IPI-273/PR #191, closed)
