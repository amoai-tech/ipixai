# SCR-23 — Availability Editor

| Field | Value |
|---|---|
| **ID** | SCR-23 |
| **Route** | `talent-scoped (e.g. /app/talent/availability)` |
| **Priority** | P3 |
| **Status** | ⚪ 0% |
| **Linear** | [IPI-413](https://linear.app/amo100/issue/IPI-413) · blocked by IPI-402 |
| **Dependencies** | BE-B4 set_availability_batch (optional) |
| **Branch** | `ipi/scr-23-availability-editor` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-23-availability.md](./wireframes/SCR-23-availability.md) |
| **Diagram** | [./diagrams/SCR-23-availability.md](./diagrams/SCR-23-availability.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/SCR-23-Availability-Editor.dc.html` |
| **React route** | `talent-scoped` |
| **Page file** | `app/src/app/(operator)/app/TBD talent availability route` |
| **Route status** | **greenfield** |
| **Scope note** | Optional BE-B4 batch RPC. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/SCR-23-Availability-Editor.dc.html`](../../Pages/SCR-23-Availability-Editor.dc.html) |
| **Wireframe** | [./wireframes/SCR-23-availability.md](./wireframes/SCR-23-availability.md) |
| **Mermaid** | [./diagrams/SCR-23-availability.md](./diagrams/SCR-23-availability.md) |
| **Shell** | `two-panel` · grid `56px | minmax(0,1fr)` |

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
| Backend | 🟡 |
| AI | — |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/SCR-23-Availability-Editor.dc.html`](../../Pages/SCR-23-Availability-Editor.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `No route`

## Files likely to modify

- `talent/availability/page.tsx (new)`

## Supabase dependency

talent availability tables · B4-RPC for batch

## AI dependency

—

## Mobile dependency

M1 — calendar UX critical on mobile

## Definition of Done

- [ ] Calendar grid matches DC
- [ ] Save availability slots
- [ ] Batch RPC if B4 landed

## Verification

```bash
cd app && npm run lint
```

## Risk

Medium

## Notes

Route TBD — talent-scoped per design.

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

