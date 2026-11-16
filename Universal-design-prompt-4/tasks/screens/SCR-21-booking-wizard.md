# SCR-21 — Booking Wizard

| Field | Value |
|---|---|
| **ID** | SCR-21 |
| **Route** | `/app/matching/talent/[id]/book` |
| **Priority** | P2 |
| **Status** | ⚪ 0% |
| **Linear** | [IPI-410](https://linear.app/amo100/issue/IPI-410) · related [IPI-311](https://linear.app/amo100/issue/IPI-311) |
| **Dependencies** | BE-B0b booking agent · SCR-20 · T3 WizardShell |
| **Branch** | `ipi/ipi-311-booking-wizard` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-21-booking-wizard.md](./wireframes/SCR-21-booking-wizard.md) |
| **Diagram** | [./diagrams/SCR-21-booking-wizard.md](./diagrams/SCR-21-booking-wizard.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/Shoot Wizard.v2.image-first.dc.html (authoring shortcut — standalone route, NOT ?flow=booking)` |
| **React route** | `/app/matching/talent/[id]/book` |
| **Page file** | `app/src/app/(operator)/app/matching/talent/[id]/book/page.tsx` |
| **Route status** | **greenfield** |
| **Scope note** | Special flow — standalone booking wizard. Blocked on BE-B0b agent. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/Shoot Wizard.v2.image-first.dc.html`](../../Pages/Shoot%20Wizard.v2.image-first.dc.html) |
| **Wireframe** | [./wireframes/SCR-21-booking-wizard.md](./wireframes/SCR-21-booking-wizard.md) |
| **Mermaid** | [./diagrams/SCR-21-booking-wizard.md](./diagrams/SCR-21-booking-wizard.md) |
| **Shell** | `wizard-full` · grid `flex column 100vh` |

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
| AI | 🔴 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/Shoot Wizard.v2.image-first.dc.html`](../../Pages/Shoot%20Wizard.v2.image-first.dc.html) — authoring shortcut only; **standalone route**, not `?flow=booking`
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `No route — create matching/talent/[id]/book/page.tsx`

## Files likely to modify

- `book/page.tsx (new)`
- `app/src/components/booking/wizard/ (new)`

## Supabase dependency

create_booking_request — ✅ · transition_booking — ✅

## AI dependency

booking Mastra agent (BE-B0b) — draft-only HITL

## Mobile dependency

M1 · SCR-MOBILE-Booking-Shell ref

## Definition of Done

- [ ] Multi-step booking wizard from DC
- [ ] create_booking_request on operator approve
- [ ] CopilotKit agentId=booking draft-only
- [ ] Never auto-commit from agent

## Verification

```bash
cd app && npm test -- booking
```

## Risk

High — AI gate

## Notes

Reuse Shoot Wizard DC with flow=booking. Agent is blocker.

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

