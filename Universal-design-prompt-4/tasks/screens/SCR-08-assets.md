# SCR-08 — Assets

| Field | Value |
|---|---|
| **ID** | SCR-08 |
| **Route** | `/app/assets` |
| **Priority** | P2 |
| **Status** | 🔴 ~5% stub |
| **Linear** | [IPI-404](https://linear.app/amo100/issue/IPI-404) |
| **Dependencies** | SC4 AssetCard · optional ST1 for upload |
| **Complexity** | M |
| **Branch** | `ipi/ipi-248-assets-readonly` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-08-assets.md](./wireframes/SCR-08-assets.md) |
| **Diagram** | [./diagrams/SCR-08-assets.md](./diagrams/SCR-08-assets.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/Assets.v2.image-first.dc.html` |
| **React route** | `/app/assets` |
| **Page file** | `app/src/app/(operator)/app/assets/page.tsx` |
| **Route status** | **existing** (SectionPlaceholder stub) |
| **Scope note** | Read-only masonry first — upload in follow-up (BE-ST1). |

### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/Assets.v2.image-first.dc.html`](../../Pages/Assets.v2.image-first.dc.html) |
| **Wireframe** | [./wireframes/SCR-08-assets.md](./wireframes/SCR-08-assets.md) |
| **Mermaid** | [./diagrams/SCR-08-assets.md](./diagrams/SCR-08-assets.md) |
| **Shell** | `standard-v2` · grid `auto \| minmax(0,1fr) auto` |
| **DC workspace width** | auto (fills available) |
| **DC grid** | 3-column masonry, 16px gap |
| **AssetCard** | `max-width: 280px` per card |

Skills: [`ipix-wireframe`](../../../.agents/skills/ipix-wireframe/SKILL.md) · [`mermaid-diagrams`](../../../.agents/skills/mermaid-diagrams/SKILL.md)

### 2. Skill routing

| Skill | When | This screen |
|---|---|---|:---:|
| `design-to-production` | Load before coding | ✅ |
| `nextjs-developer` | Load before coding | ✅ |
| `vercel-react-best-practices` | Load before coding | ✅ |
| `ipix-supabase` | Load before coding | ✅ |
| `copilotkit` | Load before coding | ✅ |
| `cloudinary` | Asset thumbnails | ✅ |
| `mastra` | Load before coding | — |
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
| Route | `/app/assets` page.tsx exists (SectionPlaceholder) | Yes — replace stub |
| Shell | ✅ OperatorPanel | No |
| Workspace | SectionPlaceholder | Yes — full workspace component |
| Data wiring | None | Yes — wire assets query |

#### API/RPC verification

| Endpoint | Status | Notes |
|---|---|---|
| `assets` table (direct) | 🟢 live | Read-only assets via Supabase client |
| Cloudinary URLs | 🟢 live | URLs stored in `assets.cloudinary_url` |
| Storage upload RPC | 🔴 not needed | Read-only scope — no upload |
| Filter/search assets | 🟡 needs RPC | Current `assets` table has brand_id, type, created_at columns |

#### Data-source

| Block | Source | Empty | Error | Image |
|---|---|---|---|---|
| Asset masonry | `assets` table via RSC query | EmptyState illustration | ErrorState with retry | Cloudinary `f_auto/q_auto` |
| Filter bar | client-side from URL params | No-match state | N/A | N/A |
| Select mode (deferred) | N/A | N/A | N/A | N/A |

#### DC States

| State | DC class | AC |
|---|---|---|
| Populated | Default grid | 3-col masonry, AssetCards with thumb + name + type |
| Loading | Skeleton placeholders | 6 skeleton cards (shimmer) matching card aspect ratio |
| Empty | `sc-if viewState="empty"` | "No assets yet" illustration + CTA |
| Filtered (no match) | — | "No assets match filter" with clear-filter button |
| Error | `sc-if viewState="error"` | ErrorState with message + retry button |

#### Negative rules

- No fake thumbnails, scores, dates when API null
- No fallback images for missing Cloudinary URLs — show placeholder icon
- Existing route → preserve wiring unless §0 proves wrong
- **Do not** add upload controls (deferred to ST1 PR)

#### DC grid spec

```css
.assets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
```

### Reuse audit

| Component | Reuse? | Notes |
|---|---|---|
| `EmptyState` | ✅ | From `app/src/components/ui/empty-state.tsx` |
| `ErrorState` | ✅ | From `app/src/components/ui/error-state.tsx` |
| `Skeleton` | ✅ | From `app/src/components/ui/skeleton.tsx` |
| `StatusChip` | ✅ | For asset status badges |
| `IntelligencePanel` | ✅ | Not rebuilt |
| `OperatorPanel` | ✅ | Not rebuilt |

- [ ] Components · hooks · CSS modules · utils · RPCs · routes searched

### Screen-specific Done criteria

- [ ] Replace SectionPlaceholder with real AssetCard masonry
- [ ] 3-col responsive grid matching DC
- [ ] Loading skeleton, empty state, error state all distinct
- [ ] Cloudinary thumbnails via CldImage
- [ ] Filter by brand/type/date (client-side)
- [ ] CSS module using tokens.css variables (no inline hex)
- [ ] loading.tsx with skeleton grid

### Verification gate

```bash
cd app && npm run lint && npm test -- assets && npx tsc --noEmit && CI=true npm run build
```

Browser: `qa@ipix.test` · `:3002` · 1280 + 390 · screenshots → `docs/qa/screenshots/YYYY-MM-DD/`
Visual regression: DC `:8765` vs React `:3002`

### Browser / Playwright matrix

| State | Device | Target |
|---|---|---|
| Loaded | 1280px | 3-col grid, thumbs visible |
| Loading | 1280px | Skeleton cards (no layout shift) |
| Empty | 1280px | Illustration + CTA rendered |
| Error | 1280px | Error message + retry button |
| Mobile | 390px | Single column, no overflow |

### Data flow

```
RSC page.tsx
  └─ await supabase.from('assets').select('*')  (org-scoped via RLS)
  └─ passes data to AssetsWorkspace (client component)
       ├─ populates AssetCard[] grid
       ├─ filter state managed via URL search params
       └─ empty/loading/error via view-state derivation
```

### Out of scope

- Shell / nav / IntelligencePanel / chat dock rebuild
- Upload controls or BE-ST1 storage — must be separate PR
- Backend migrations (separate BE-* PR)
- Mobile shell (MOB-* track)
- Bulk select / multi-delete

## Readiness

| Layer | Status |
|---|---|
| React | 🔴 |
| Backend | 🟢 |
| AI | 🟡 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/Assets.v2.image-first.dc.html`](../../Pages/Assets.v2.image-first.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `app/src/app/(operator)/app/assets/page.tsx`
- `app/src/components/media/`

## Files likely to modify

- `assets/page.tsx`
- `app/src/components/media/asset-card.tsx` (new or extend existing)
- `app/src/components/media/assets-workspace.tsx` (new)
- `app/src/components/media/assets.module.css` (new)

## Supabase dependency

assets table (brand_id, type, url, cloudinary_url, created_at) — existing. Query via RSC `supabase.from('assets').select('*').eq('org_id', orgId)`. Filter RPC optional for performance.

## AI dependency

EvidenceBlock on asset metadata (defer — not in read-only scope)

## Mobile dependency

M1 — 2-up masonry grid on mobile

## Definition of Done

- [ ] Replace SectionPlaceholder with real masonry grid
- [ ] AssetCard grid with working thumbnails
- [ ] Filter bar: by brand, type, date
- [ ] All 5 DC states implemented
- [ ] CSS module, no inline styles
- [ ] lint · test · tsc · build green
- [ ] Side-by-side screenshots vs DC

## Verification

```bash
cd app && npm test -- assets
```

## Risk

| Risk | Likelihood | Mitigation |
|---|---|---|
| Large asset count causes slow grid | Low | Pagination via cursor or offset in follow-up |
| Cloudinary URL format mismatch | Low | Verify format in assets table — stored as full URL |
| Filter/search requires new RPC | Medium | Client-side filter first, RPC in separate PR |

## Notes

Backend assets table + Cloudinary URLs ready. UI is SectionPlaceholder stub. Largest gap: no filter/search RPC exists — defer to follow-up unless client-side filter suffices for MVP.

HTML coverage check:
- Pages: ✅ Assets.v2.image-first.dc.html exists
- Components: AssetCard shape per DC design
- States: loading, empty, populated, filtered, error — all in DC
- Dialogs: None for read-only scope
- Cards: AssetCard with thumb, name, type, status

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `cloudinary` · `designtoreact`
