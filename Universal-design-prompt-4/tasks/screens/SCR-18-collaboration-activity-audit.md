# SCR-18 — Collaboration / Activity Audit

| Field | Value |
|---|---|
| **ID** | SCR-18 |
| **Route** | `/app/activity` |
| **Priority** | P3 |
| **Status** | ⚪ 0% |
| **Linear** | [IPI-408](https://linear.app/amo100/issue/IPI-408) · blocked by IPI-398 |
| **Dependencies** | [BE-ACT1](../backend/BE-ACT1-org-activity-log.md) (`org_activity_events` + `list_org_activity`) |
| **Branch** | `ipi/scr-18-collaboration-audit` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-18-collaboration.md](./wireframes/SCR-18-collaboration.md) |
| **Diagram** | [./diagrams/SCR-18-collaboration.md](./diagrams/SCR-18-collaboration.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/SCR-18-Collaboration-Audit.dc.html` |
| **React route** | `/app/activity` |
| **Page file** | `app/src/app/(operator)/app/activity/page.tsx` |
| **Route status** | **greenfield** |
| **Scope note** | Blocked on BE-ACT1 — federation RPC. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/SCR-18-Collaboration-Audit.dc.html`](../../Pages/SCR-18-Collaboration-Audit.dc.html) |
| **Wireframe** | [./wireframes/SCR-18-collaboration.md](./wireframes/SCR-18-collaboration.md) |
| **Mermaid** | [./diagrams/SCR-18-collaboration.md](./diagrams/SCR-18-collaboration.md) |
| **Shell** | `fixed-3col` · grid `56px | minmax(0,1fr) | 320px` |

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
| Backend | 🔴 blocked on ACT1 |
| AI | — |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/SCR-18-Collaboration-Audit.dc.html`](../../Pages/SCR-18-Collaboration-Audit.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `No route — create app/src/app/(operator)/app/activity/page.tsx`

## Files likely to modify

- `activity/page.tsx (new)`
- `app/src/components/activity/ (new)`

## Supabase dependency

- **BE-ACT1:** `org_activity_events` + `list_org_activity` RPC (federates `crm_activities`, `agent_decision_log`)
- CRM detail tabs keep using `crm_activities` directly — SCR-18 is org-wide feed only

## AI dependency

—

## Mobile dependency

M1

## Definition of Done

- [ ] Timeline of team actions
- [ ] Filter by user/entity
- [ ] Matches SCR-18 DC

## Verification

```bash
cd app && npm run lint
```

## Risk

Low after ACT1 — federation RPC complexity; keep migration-only PR separate from UI

## Notes

Design complete. Backend spec: [BE-ACT1](../backend/BE-ACT1-org-activity-log.md).

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

