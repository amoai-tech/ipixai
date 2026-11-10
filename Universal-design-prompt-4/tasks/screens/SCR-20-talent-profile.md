# SCR-20 — Talent Profile

| Field | Value |
|---|---|
| **ID** | SCR-20 |
| **Route** | `/app/matching/talent/[id]` |
| **Priority** | P2 |
| **Status** | ⚪ 0% |
| **Linear** | [IPI-409](https://linear.app/amo100/issue/IPI-409) |
| **Dependencies** | T2 Profile360 · SCR-09 matching |
| **Branch** | `ipi/scr-20-talent-profile` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-20-talent-profile.md](./wireframes/SCR-20-talent-profile.md) |
| **Diagram** | [./diagrams/SCR-20-talent-profile.md](./diagrams/SCR-20-talent-profile.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/SCR-20-Talent-Profile.dc.html` |
| **React route** | `/app/matching/talent/[id]` |
| **Page file** | `app/src/app/(operator)/app/matching/talent/[id]/page.tsx` |
| **Route status** | **greenfield** |
| **Scope note** | Greenfield route — Profile360 pattern. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/SCR-20-Talent-Profile.dc.html`](../../Pages/SCR-20-Talent-Profile.dc.html) |
| **Wireframe** | [./wireframes/SCR-20-talent-profile.md](./wireframes/SCR-20-talent-profile.md) |
| **Mermaid** | [./diagrams/SCR-20-talent-profile.md](./diagrams/SCR-20-talent-profile.md) |
| **Shell** | `fixed-3col` · grid `56px | minmax(0,1fr) | 320px` |

Skills: [`ipix-wireframe`](../../../.agents/skills/ipix-wireframe/SKILL.md) · [`mermaid-diagrams`](../../../.agents/skills/mermaid-diagrams/SKILL.md)

### 2. Skill routing

| Skill | When | This screen |
|---|---|:---:|
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
| Backend | 🟢 |
| AI | 🟢 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/SCR-20-Talent-Profile.dc.html`](../../Pages/SCR-20-Talent-Profile.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `No route — create matching/talent/[id]/page.tsx`

## Files likely to modify

- `matching/talent/[id]/page.tsx (new)`
- `app/src/components/talent/ (new)`

## Supabase dependency

search_talent, talent profiles — ✅

## AI dependency

talent agent read-only context

## Mobile dependency

M1

## Definition of Done

- [ ] 360 profile matches SCR-20
- [ ] Shortlist + book CTA
- [ ] mode=operator|model

## Verification

```bash
cd app && npm test -- talent
```

## Risk

Medium

## Notes

Entry point for booking flow.

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

