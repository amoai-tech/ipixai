# SCR-05 — Shoot Detail

| Field | Value |
|---|---|
| **ID** | SCR-05 |
| **Route** | `/app/shoots/[shootId]` |
| **Priority** | P1 |
| **Status** | 🟡 ~40% |
| **Linear** | [IPI-371](https://linear.app/amo100/issue/IPI-371) |
| **Dependencies** | T4 DetailShell · SC1 StatusChip |
| **Branch** | `ipi/ipi-371-shoot-detail-tabs` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-05-shoot-detail.md](./wireframes/SCR-05-shoot-detail.md) |
| **Diagram** | [./diagrams/SCR-05-shoot-detail.md](./diagrams/SCR-05-shoot-detail.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/Shoot Detail.v2.image-first.dc.html` |
| **React route** | `/app/shoots/[shootId]` |
| **Page file** | `app/src/app/(operator)/app/shoots/[shootId]/page.tsx` |
| **Route status** | **existing** |
| **Scope note** | Tab parity — replace Placeholder tabs. See shoot/PLAN/shoot-detail-dc-conversion.md. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/Shoot Detail.v2.image-first.dc.html`](../../Pages/Shoot%20Detail.v2.image-first.dc.html) |
| **Wireframe** | [./wireframes/SCR-05-shoot-detail.md](./wireframes/SCR-05-shoot-detail.md) |
| **Mermaid** | [./diagrams/SCR-05-shoot-detail.md](./diagrams/SCR-05-shoot-detail.md) |
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
| React | 🟡 |
| Backend | 🟡 |
| AI | 🟡 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/Shoot Detail.v2.image-first.dc.html`](../../Pages/Shoot Detail.v2.image-first.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `app/src/app/(operator)/app/shoots/[shootId]/page.tsx`
- `app/src/components/shoot/shoot-detail-client.tsx`

## Files likely to modify

- `shoot-detail-client.tsx — replace inline Placeholder tabs`
- `app/src/lib/shoot/get-shoot-detail.ts`

## Supabase dependency

shoots, deliverables, shot_list (verify tables)

## AI dependency

shoot-planner / creative agents on tab context

## Mobile dependency

M1

## Definition of Done

- [ ] All 9 tabs render real content (not Placeholder)
- [ ] Tab shell matches DC (Overview, Shot List, Deliverables, …)
- [ ] StatusChip on shoot header
- [ ] Data fetch via get-shoot-detail
- [ ] HITL on AI writes where applicable

## Verification

```bash
cd app && npm run lint && npm test -- shoot-detail
```

## Risk

Medium — large surface, many tabs

## Notes

Many tabs still use inline Placeholder component.

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

