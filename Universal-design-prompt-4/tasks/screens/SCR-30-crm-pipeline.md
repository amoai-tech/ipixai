# SCR-30 — CRM Pipeline

| Field | Value |
|---|---|
| **ID** | SCR-30 |
| **Route** | `/app/crm/pipeline` |
| **Priority** | P1 |
| **Status** | 🟡 stub (~10%) |
| **Linear** | [IPI-395](https://linear.app/amo100/issue/IPI-395) · parent IPI-392 |
| **Dependencies** | SC1 StatusChip · T1 EntityList · T2 Profile360 · CRM3 |
| **Branch** | `ipi/scr-30-crm-pipeline` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-30-crm-pipeline.md](./wireframes/SCR-30-crm-pipeline.md) |
| **Diagram** | [./diagrams/SCR-30-crm-pipeline.md](./diagrams/SCR-30-crm-pipeline.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/SCR-30-CRM-Pipeline.dc.html` |
| **React route** | `/app/crm/pipeline` |
| **Page file** | `app/src/app/(operator)/app/crm/pipeline/page.tsx` |
| **Route status** | **existing** |
| **Scope note** | Kanban — move-deal-stage tool. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/SCR-30-CRM-Pipeline.dc.html`](../../Pages/SCR-30-CRM-Pipeline.dc.html) |
| **Wireframe** | [./wireframes/SCR-30-crm-pipeline.md](./wireframes/SCR-30-crm-pipeline.md) |
| **Mermaid** | [./diagrams/SCR-30-crm-pipeline.md](./diagrams/SCR-30-crm-pipeline.md) |
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
| Backend | 🟢 |
| AI | 🟢 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/SCR-30-CRM-Pipeline.dc.html`](../../Pages/SCR-30-CRM-Pipeline.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `app/src/app/(operator)/app/crm/pipeline/page.tsx`
- `app/src/components/crm/crm-screen-gate.tsx`

## Files likely to modify

- `app/(operator)/app/crm/pipeline/page.tsx`
- `app/src/components/crm/ (replace gate with real UI)`

## Supabase dependency

crm_companies, crm_contacts, crm_deals, crm_activities + RLS — ✅ MCP verified

## AI dependency

crm-assistant Mastra agent — ✅ shipped

## Mobile dependency

M1 · SCR-MOBILE-CRM-Gallery ref

## Definition of Done

- [ ] Replace CrmScreenGate with DC-faithful UI
- [ ] EntityList or kanban (pipeline) wired to Supabase
- [ ] StatusChip with crmStatusDotToken
- [ ] crm-assistant suggestions in IntelligencePanel
- [ ] HITL on write actions

## Verification

```bash
cd app && npm run lint && npm test -- crm
```

## Risk

Medium — highest ROI; backend ready

## Notes

Route exists; CrmScreenGate placeholder only. Backend + agent shipped.

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

