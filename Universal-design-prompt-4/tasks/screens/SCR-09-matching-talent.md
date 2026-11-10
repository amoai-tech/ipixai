# SCR-09 — Matching / Talent

| Field | Value |
|---|---|
| **ID** | SCR-09 |
| **Route** | `/app/matching` |
| **Priority** | P2 |
| **Status** | 🟡 ~60% |
| **Linear** | [IPI-405](https://linear.app/amo100/issue/IPI-405) |
| **Dependencies** | T1 EntityList · do NOT merge Matching.v2 legacy |
| **Complexity** | M |
| **Branch** | `ipi/ipi-250-matching-tabs` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-09-matching.md](./wireframes/SCR-09-matching.md) |
| **Diagram** | [./diagrams/SCR-09-matching.md](./diagrams/SCR-09-matching.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/SCR-09-Matching-Talent.dc.html` |
| **React route** | `/app/matching` |
| **Page file** | `app/src/app/(operator)/app/matching/page.tsx` |
| **Route status** | **existing** (TalentTab live) |
| **Scope note** | Full rewrite of workspace column to match DC. Current code uses inline styles (`p-6`, `text-lg`, `text-[#111]`) — must migrate to tokens.css. |

### Known current-code issues (to fix)
- Inline `p-6`, `text-lg`, `text-[#111]` instead of tokens.css variables
- No loading/empty/error boundary at page level
- TalentTab only — Casting/Grid/List sub-views not implemented
- No mobile responsive layout

### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/SCR-09-Matching-Talent.dc.html`](../../Pages/SCR-09-Matching-Talent.dc.html) |
| **Wireframe** | [./wireframes/SCR-09-matching.md](./wireframes/SCR-09-matching.md) |
| **Mermaid** | [./diagrams/SCR-09-matching.md](./diagrams/SCR-09-matching.md) |
| **Shell** | `fixed-3col` · grid `56px \| minmax(0,1fr) \| 340px` |
| **DC workspace width** | auto (fills available) |
| **View modes** | Swipe deck (card view), Table (list view) |

Skills: [`ipix-wireframe`](../../../.agents/skills/ipix-wireframe/SKILL.md) · [`mermaid-diagrams`](../../../.agents/skills/mermaid-diagrams/SKILL.md)

### 2. Skill routing

| Skill | When | This screen |
|---|---|---|:---:|
| `design-to-production` | Load before coding | ✅ |
| `nextjs-developer` | Load before coding | ✅ |
| `vercel-react-best-practices` | Load before coding | ✅ |
| `ipix-supabase` | Load before coding | ✅ |
| `copilotkit` | Load before coding | ✅ |
| `mastra` | Load before coding | ✅ |
| `gemini` | Load before coding | — |
| `task-verifier` | Load before coding | ✅ |
| `ipix-wireframe` | Wireframe matches DC | ✅ |
| `mermaid-diagrams` | Layout/flow diagrams | ✅ |

### Definition of Ready

- [ ] DC file read; Workspace zones identified
- [ ] §0 Prove tables filled below
- [ ] Reuse audit complete
- [ ] No conflicting PR/worktree
- [ ] Linear assigned
- [ ] Out of scope listed

### Phase 0 — Prove

#### Production-state

| Area | Exists today? | This PR changes? |
|---|---|---|
| Route | `/app/matching` page.tsx exists | Yes — workspace rewrite |
| Shell | ✅ OperatorPanel | No |
| Workspace | TalentTab with inline styles | Yes — full DC parity rewrite |
| Data wiring | search_talent RPC | Yes — wire to new workspace component |

#### API/RPC verification

| Endpoint | Status | Notes |
|---|---|---|
| `search_talent` | 🟢 live | Returns paginated talent profiles |
| `toggle_shortlist_item` | 🟢 live | Add/remove from shortlist |
| `shortlists` | 🟢 live | Read current shortlist |
| `get_talent_profile` | 🟢 live | Full profile detail |
| Talent images | 🟢 live | Cloudinary URLs in profile |

#### Data-source

| Block | Source | Empty | Error | Image |
|---|---|---|---|---|
| Swipe deck | `search_talent(params)` | "No talent matches" illustration | Error banner + retry | Cloudinary headshot |
| Table view | `search_talent(params)` | EmptyState | ErrorState | Avatar thumb |
| Shortlist panel | `toggle_shortlist_item` | "Shortlist empty" | N/A | Avatar thumb |
| Filter bar | client-side params → RPC | No-match state | N/A | N/A |

#### DC States

| State | DC class | AC |
|---|---|---|
| Swipe view | `sc-if viewState="swipe"` | Card deck with name, role, match %, shortlist toggle |
| Table view | `sc-if viewState="table"` | Sortable columns: name, role, match, availability |
| Loading | Skeleton cards | Shimmer cards (6) matching card aspect ratio |
| Empty | `sc-if viewState="empty"` | "No talent matches this brief yet" + "Adjust filters" |
| Error | `sc-if viewState="error"` | Red banner with retry button |
| HasShortlist | `sc-if hasShortlist` | Shortlist count badge in filter bar |
| Filter active | `showFilters` | Filter bar expanded with active filter chips |

#### Negative rules

- No fake match scores — use real `match_score` from `search_talent`
- No fallback images — use `avatar_url` from profile, placeholder icon on null
- **Must not** reuse Matching.v2 DC HTML — SCR-09 has its own `SCR-09-Matching-Talent.dc.html`
- Current inline styles (`p-6`, `text-lg`, `text-[#111]`) must be replaced with tokens.css
- Preserve existing talent-match-tools Mastra wiring

#### DC grid / style spec

```css
/* Workspace column — auto-fill from shell */
.workspace {
  padding: var(--spacing-8);
}

/* Swipe deck cards */
.talent-card {
  max-width: 360px;
  border-radius: var(--radius-xl);
  background: var(--color-card-bg);
}

/* Table */
.talent-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 4px;
}
```

### Reuse audit

| Component | Reuse? | Notes |
|---|---|---|
| `EmptyState` | ✅ | From `app/src/components/ui/empty-state.tsx` |
| `ErrorState` | ✅ | From `app/src/components/ui/error-state.tsx` |
| `StatusChip` | ✅ | For availability status |
| `EntityList` | ✅ | For table view |
| `Skeleton` | ✅ | For card skeleton |
| `IntelligencePanel` | ✅ | Not rebuilt |
| `OperatorPanel` | ✅ | Not rebuilt |

- [ ] Components · hooks · CSS modules · utils · RPCs · routes searched

### Screen-specific Done criteria

- [ ] Swipe deck view matching DC card layout
- [ ] Table view with sortable columns
- [ ] Shortlist toggle wired to RPC
- [ ] View-mode toggle (swipe/table)
- [ ] Filter bar with brand/brief context
- [ ] All 6 DC states implemented
- [ ] CSS module using tokens.css — zero inline hex
- [ ] Replace all `p-6`/`text-lg`/`text-[#111]` with tokens

### Verification gate

```bash
cd app && npm run lint && npm test -- matching && npx tsc --noEmit && CI=true npm run build
```
```bash
rg 'p-6|text-lg|text-\[#111\]' app/src/components/matching/  # Should return 0
```

Browser: `qa@ipix.test` · `:3002` · 1280 + 390 · screenshots → `docs/qa/screenshots/YYYY-MM-DD/`
Visual regression: DC `:8765` vs React `:3002`

### Browser / Playwright matrix

| State | Device | Target |
|---|---|---|
| Swipe | 1280px | Card deck, navigation arrows, shortlist toggle |
| Table | 1280px | Columns sortable, status chips visible |
| Loading | 1280px | 6 skeleton cards |
| Empty | 1280px | No-match illustration with filter-adjust CTA |
| Error | 1280px | Error banner + retry |
| Shortlist active | 1280px | Count badge, items appear in panel |
| Mobile | 390px | Single column, filter bar wraps |

### Data flow

```
RSC page.tsx
  └─ await rpc('search_talent', { org_id, brief_id?, query? })
  └─ passes to matching-workspace.tsx (client)
       ├─ swipe/table view managed by local state
       ├─ filters → URL search params → re-fetch
       ├─ shortlist toggle → rpc('toggle_shortlist_item')
       └─ empty/loading/error via derived view state
```

### Out of scope

- Shell / nav / IntelligencePanel / chat dock rebuild
- Backend migrations (separate BE-* PR)
- Mobile shell (MOB-* track)
- Matching.v2 (brand↔creator matching) — separate screen per ADR-002
- Casting Review sub-view (deferred)

## Readiness

| Layer | Status |
|---|---|
| React | 🟡 |
| Backend | 🟢 |
| AI | 🟡 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/SCR-09-Matching-Talent.dc.html`](../../Pages/SCR-09-Matching-Talent.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `app/src/app/(operator)/app/matching/page.tsx`
- `app/src/components/matching/`
- `app/src/components/matching/talent-tab.tsx`

## Files likely to modify

- `matching/page.tsx`
- `app/src/components/matching/talent-match-tabs.tsx`
- `app/src/components/matching/talent-tab.tsx`
- `app/src/components/matching/matching-workspace.tsx` (new)
- `app/src/components/matching/matching.module.css` (new or replace inline)

## Supabase dependency

`search_talent`, `toggle_shortlist_item`, `shortlists` — ✅ live. No new RPCs needed.

## AI dependency

talent-matching suggestions via `model-match` Mastra agent — already wired. Verify agent route context in `route-agent-map.ts`.

## Mobile dependency

M1 — swipe deck full-bleed on mobile, BottomSheet for shortlist

## Definition of Done

- [ ] Talent tab matches SCR-09 DC (not legacy Matching.v2)
- [ ] Swipe + table view modes
- [ ] Shortlist toggle wired
- [ ] All 6 DC states implemented
- [ ] Zero inline styles — all tokens.css
- [ ] lint · test · tsc · build green
- [ ] Side-by-side screenshots vs DC

## Verification

```bash
cd app && npm test -- matching
```

## Risk

| Risk | Likelihood | Mitigation |
|---|---|---|
| Inline style cleanup breaks existing layout | Medium | Visual regression screenshots before/after |
| TalentMatchTabs has 4 tabs but only 1 built | Low | Gate on Talent tab only — mark Casting/Grid/List deferred |
| ADR-002 confusion with Matching.v2 | Low | Document in code: two distinct screens |

## Notes

Only Talent tab partially built. Legacy Matching.v2 (brand↔creator) is separate — never merge the two. Current code uses inline `p-6 text-lg text-[#111]` which must be migrated to `tokens.css`.

HTML coverage check:
- Pages: ✅ SCR-09-Matching-Talent.dc.html exists
- Components: talent card, swipe deck, table
- States: swipe, table, loading, empty, error, hasShortlist — all in DC
- Dialogs: shortlist panel as right column
- Cards: TalentCard with headshot, name, role, match score, shortlist toggle

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact` · `ipix-supabase` · `mastra`
