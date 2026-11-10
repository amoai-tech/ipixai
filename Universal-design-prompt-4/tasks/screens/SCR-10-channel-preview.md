# SCR-10 — Channel Preview

| Field | Value |
|---|---|
| **ID** | SCR-10 |
| **Route** | `/app/preview` |
| **Priority** | P1 |
| **Status** | ✅ ~90% |
| **Linear** | [IPI-269](https://linear.app/amo100/issue/IPI-269) |
| **Dependencies** | — |
| **Branch** | `ipi/scr-10-preview-polish` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-10-channel-preview.md](./wireframes/SCR-10-channel-preview.md) |
| **Diagram** | [./diagrams/SCR-10-channel-preview.md](./diagrams/SCR-10-channel-preview.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/Channel Preview.v2.image-first.dc.html` |
| **React route** | `/app/preview` |
| **Page file** | `app/src/app/(operator)/app/preview/page.tsx` |
| **Route status** | **existing** |
| **Scope note** | Parity polish. |


### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/Channel Preview.v2.image-first.dc.html`](../../Pages/Channel%20Preview.v2.image-first.dc.html) |
| **Wireframe** | [./wireframes/SCR-10-channel-preview.md](./wireframes/SCR-10-channel-preview.md) |
| **Mermaid** | [./diagrams/SCR-10-channel-preview.md](./diagrams/SCR-10-channel-preview.md) |
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
| React | ✅ |
| Backend | 🟡 |
| AI | 🟡 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/Channel Preview.v2.image-first.dc.html`](../../Pages/Channel Preview.v2.image-first.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `app/src/app/(operator)/app/preview/page.tsx`

## Files likely to modify

- `Channel preview polish`

## Supabase dependency

deliverables / channel configs

## AI dependency

copy suggestions

## Mobile dependency

M1

## Definition of Done

- [ ] Preview frames match DC
- [ ] Channel switcher works

## Verification

```bash
cd app && npm test -- preview
```

## Risk

Low

## Notes

Shipped. Polish only.

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact`

