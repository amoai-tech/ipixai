# SCR-22 — Booking Detail

| Field | Value |
|---|---|
| **ID** | SCR-22 |
| **Route** | `/app/bookings/[id]` |
| **Priority** | P2 |
| **Status** | ⚪ 0% |
| **Linear** | [IPI-411](https://linear.app/amo100/issue/IPI-411) · related [IPI-312](https://linear.app/amo100/issue/IPI-312) |
| **Dependencies** | SCR-21 · T4 DetailShell |
| **Branch** | `ipi/ipi-312-booking-detail` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-22-booking-detail.md](./wireframes/SCR-22-booking-detail.md) |
| **Diagram** | [./diagrams/SCR-22-booking-detail.md](./diagrams/SCR-22-booking-detail.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/Shoot Detail.v2.image-first.dc.html (authoring shortcut — standalone route)` |
| **React route** | `/app/bookings/[id]` |
| **Page file** | `app/src/app/(operator)/app/bookings/[id]/page.tsx` |
| **Route status** | **greenfield** |
| **Scope note** | Special flow — FSM via transition_booking RPC. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/Shoot Detail.v2.image-first.dc.html`](../../Pages/Shoot%20Detail.v2.image-first.dc.html) |
| **Wireframe** | [./wireframes/SCR-22-booking-detail.md](./wireframes/SCR-22-booking-detail.md) |
| **Mermaid** | [./diagrams/SCR-22-booking-detail.md](./diagrams/SCR-22-booking-detail.md) |
| **Shell** | `standard-v2` · grid `auto | minmax(0,1fr) auto` |

Skills: [`ipix-wireframe`](../../../.agents/skills/ipix-wireframe/SKILL.md) · [`mermaid-diagrams`](../../../.agents/skills/mermaid-diagrams/SKILL.md)

### 2. Skill routing

| Skill | When | This screen |
|---|---|:---:|
| `design-to-production` | Load before coding | ✅ |
| `nextjs-developer` | Load before coding | ✅ |
| `vercel-react-best-practices` | Load before coding | ✅ |
| `ipix-supabase` | Load before coding | ✅ |
| `copilotkit` | Load before coding | ✅ |
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
| Backend | 🟢 |
| AI | — |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/Shoot Detail.v2.image-first.dc.html`](../../Pages/Shoot%20Detail.v2.image-first.dc.html) — authoring shortcut; standalone `/app/bookings/[id]`
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `No route — create bookings/[id]/page.tsx`

## Files likely to modify

- `bookings/[id]/page.tsx (new)`
- `app/src/components/booking/detail/ (new)`

## Supabase dependency

get_booking, transition_booking, confirm_booking — ✅

## AI dependency

booking agent for message drafts (optional)

## Mobile dependency

M1

## Definition of Done

- [ ] FSM status transitions via transition_booking
- [ ] Tabs adapted from Shoot Detail DC
- [ ] Optimistic lock on version field

## Verification

```bash
cd app && npm test -- booking
```

## Risk

Medium

## Notes

Reuse Shoot Detail shell with booking context.

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

