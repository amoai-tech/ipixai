# SCR-17 — Campaign Performance

| Field | Value |
|---|---|
| **ID** | SCR-17 |
| **Route** | `/app/analytics/campaigns` |
| **Priority** | P3 |
| **Status** | ⚪ 0% |
| **Linear** | [IPI-297](https://linear.app/amo100/issue/IPI-297) |
| **Dependencies** | BE-D2 · SCR-07 campaigns data |
| **Branch** | `ipi/ipi-297-campaign-performance` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-17-campaign-performance.md](./wireframes/SCR-17-campaign-performance.md) |
| **Diagram** | [./diagrams/SCR-17-campaign-performance.md](./diagrams/SCR-17-campaign-performance.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/Campaign Performance.v2.image-first.dc.html` |
| **React route** | `/app/analytics/campaigns` |
| **Page file** | `app/src/app/(operator)/app/analytics/campaigns/page.tsx` |
| **Route status** | **greenfield** |
| **Scope note** | Greenfield — blocked on BE-D1 + BE-D2. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/Campaign Performance.v2.image-first.dc.html`](../../Pages/Campaign%20Performance.v2.image-first.dc.html) |
| **Wireframe** | [./wireframes/SCR-17-campaign-performance.md](./wireframes/SCR-17-campaign-performance.md) |
| **Mermaid** | [./diagrams/SCR-17-campaign-performance.md](./diagrams/SCR-17-campaign-performance.md) |
| **Shell** | `standard-v2` · grid `auto | minmax(0,1fr) auto` |

Skills: [`ipix-wireframe`](../../../.agents/skills/ipix-wireframe/SKILL.md) · [`mermaid-diagrams`](../../../.agents/skills/mermaid-diagrams/SKILL.md)

### 2. Skill routing

| Skill | When | This screen |
|---|---|:---:|
| `design-to-production` | Load before coding | ✅ |
| `nextjs-developer` | Load before coding | ✅ |
| `vercel-react-best-practices` | Load before coding | ✅ |
| `ipix-supabase` | Load before coding | ✅ |
| `copilotkit` | Load before coding | — |
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

### Phase 0 — Prove (fill before line 1)

#### Production-state

| Area | Exists today? | This PR changes? |
|---|---|---|
| Route | _verify disk_ | |
| Shell | ✅ OperatorPanel | No |
| Workspace | _verify_ | Yes (workspace column) |
| Data wiring | _verify_ | N/A — greenfield |

#### Data-source (per block — fill)

| Block | Data source | Empty | Error | Image slot |
|---|---|---|---|---|
| _TBD_ | | | | |

#### Negative rules

- No fake scores, dates, crew, or counts when API null
- No fallback images in asset/upload contexts
- Existing route → preserve wiring unless §0 proves wrong

### Reuse audit

- [ ] Components · hooks · CSS modules · utils · RPCs · routes searched

### Screen-specific Done criteria

_See § Definition of Done below — plus designtoreact §18 parity report before merge._

### Verification gate

```bash
cd app && npm run lint && npm test && npx tsc --noEmit && CI=true npm run build
```

Browser: `qa@ipix.test` · `:3002` · 1280 + 390 · screenshots → `docs/qa/screenshots/YYYY-MM-DD/`  
Visual regression: DC `:8765` vs React `:3002` ([§17 designtoreact](../docs/designtoreact.md))

### Out of scope

- Shell / nav / IntelligencePanel / chat dock rebuild
- Backend migrations (separate BE-* PR)
- Mobile shell (MOB-* track)

## Readiness

| Layer | Status |
|---|---|
| React | ⚪ |
| Backend | 🔴 |
| AI | ⚪ |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/Campaign Performance.v2.image-first.dc.html`](../../Pages/Campaign Performance.v2.image-first.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `No route — create analytics/campaigns/page.tsx`

## Files likely to modify

- `analytics/campaigns/page.tsx (new)`

## Supabase dependency

BE-D2 + IPI-268 campaigns

## AI dependency

—

## Mobile dependency

M1

## Definition of Done

- [ ] Campaign perf charts from D2
- [ ] Drill-down from SCR-07

## Verification

```bash
cd app && npm test -- analytics
```

## Risk

High

## Notes

Blocked on D1 + D2.

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

