# SCR-01 — Command Center

| Field | Value |
|---|---|
| **ID** | SCR-01 |
| **Route** | `/app` |
| **Priority** | P0 |
| **Status** | ✅ ~90% |
| **Linear** | [IPI-306](https://linear.app/amo100/issue/IPI-306) |
| **Dependencies** | — |
| **Branch** | `ipi/scr-01-command-center-polish` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-01-command-center.md](./wireframes/SCR-01-command-center.md) |
| **Diagram** | [./diagrams/SCR-01-command-center.md](./diagrams/SCR-01-command-center.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/Command Center.v2.image-first.dc.html` |
| **React route** | `/app` |
| **Page file** | `app/src/app/(operator)/app/page.tsx` |
| **Route status** | **existing** |
| **Scope note** | Parity polish only — route shipped. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/Command Center.v2.image-first.dc.html`](../../Pages/Command%20Center.v2.image-first.dc.html) |
| **Wireframe** | [./wireframes/SCR-01-command-center.md](./wireframes/SCR-01-command-center.md) |
| **Mermaid** | [./diagrams/SCR-01-command-center.md](./diagrams/SCR-01-command-center.md) |
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
| Data wiring | _verify_ | Yes — layout PR preserves queries |

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
| React | ✅ |
| Backend | 🟢 |
| AI | 🟡 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/Command Center.v2.image-first.dc.html`](../../Pages/Command Center.v2.image-first.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `app/src/app/(operator)/app/page.tsx`
- `app/src/components/command-center/`

## Files likely to modify

- `Polish only — KPI wiring, suggested actions`

## Supabase dependency

brands, shoots, notifications (read)

## AI dependency

CopilotKit dock — deepen page-context suggestions

## Mobile dependency

M1 MobileShell (later)

## Definition of Done

- [ ] Layout matches DC within 2px on desktop
- [ ] Live data: brands, shoots, pending approvals
- [ ] IntelligencePanel shows page-context suggestions
- [ ] No regressions on existing wiring

## Verification

```bash
cd app && npm run lint && npm test
```

## Risk

Low — maintenance/polish only

## Notes

Shipped. Task = polish + mobile pass later.

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

