# SCR-25 — Role Dashboards

| Field | Value |
|---|---|
| **ID** | SCR-25 |
| **Route** | `/app/model` · `/app/roster` |
| **Priority** | P3 |
| **Status** | ⚪ 0% |
| **Linear** | [IPI-414](https://linear.app/amo100/issue/IPI-414) |
| **Dependencies** | SCR-20 · SCR-22 |
| **Complexity** | L |
| **Branch** | `ipi/scr-25-role-dashboards` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-25-role-dashboards.md](./wireframes/SCR-25-role-dashboards.md) |
| **Diagram** | [./diagrams/SCR-25-role-dashboards.md](./diagrams/SCR-25-role-dashboards.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/SCR-25-Role-Dashboards.dc.html` |
| **React route** | `/app/model` · `/app/roster` |
| **Page file** | `app/src/app/(operator)/app/model/page.tsx` · `roster/page.tsx` |
| **Route status** | **greenfield** — create two routes |
| **Scope note** | Two routes sharing one DC with role switch. `/app/model` = talent's own view (my bookings, my shoots). `/app/roster` = agency/agent view (all talent in roster). |

### Route mapping

| Route | Audience | Content |
|---|---|---|
| `/app/model` | Talent/model | My upcoming bookings, my shoot schedule, pending approvals |
| `/app/roster` | Agency/agent | All talent in roster, upcoming bookings per talent, availability overview |

### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/SCR-25-Role-Dashboards.dc.html`](../../Pages/SCR-25-Role-Dashboards.dc.html) |
| **Wireframe** | [./wireframes/SCR-25-role-dashboards.md](./wireframes/SCR-25-role-dashboards.md) |
| **Mermaid** | [./diagrams/SCR-25-role-dashboards.md](./diagrams/SCR-25-role-dashboards.md) |
| **Shell** | `fixed-3col` · grid `56px \| minmax(0,1fr) \| 340px` |
| **DC workspace width** | auto (fills available) |

### Dashboard sections (per DC)

| Section | Model view | Roster view |
|---|---|---|
| KPI bar | Upcoming shoots, pending approvals, next booking | Total talent, upcoming shoots, pending availability |
| Upcoming bookings | My bookings list | All talent bookings list |
| Quick actions | View profile, check availability | Add talent, manage roster |
| Recent activity | My recent activity | Roster-wide activity |

Skills: [`ipix-wireframe`](../../../.agents/skills/ipix-wireframe/SKILL.md) · [`mermaid-diagrams`](../../../.agents/skills/mermaid-diagrams/SKILL.md)

### 2. Skill routing

| Skill | When | This screen |
|---|---|---|:---:|
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

### Phase 0 — Prove

#### Production-state

| Area | Exists today? | This PR changes? |
|---|---|---|
| Route | No `/app/model` or `/app/roster` routes | Create both routes |
| Shell | ✅ OperatorPanel | No |
| Workspace | N/A — greenfield | Yes |
| Data wiring | N/A — greenfield | Wire list_bookings + talent_profile queries |

#### API/RPC verification

| Endpoint | Status | Notes |
|---|---|---|
| `list_bookings` | 🟢 live | Filterable by talent_id for model view |
| `talent_profiles` table | 🟡 live — verify | Needed for roster listing |
| `get_talent_profile` | 🟢 live | For model's own profile |
| Upcoming shoots query | 🟡 needs RPC | Join bookings + shoots for combined view |
| KPI aggregation | 🟡 needs RPC | Count aggregates for KPI bar |

#### Data-source

| Block | Source | Empty | Error |
|---|---|---|---|
| KPI bar (model) | `list_bookings` aggregated | All-zero KPIs (no bookings yet) | ErrorState per KPI |
| KPI bar (roster) | `list_bookings` + talent count | Zero counts | ErrorState per KPI |
| Upcoming bookings | `list_bookings(status: 'confirmed')` | "No upcoming bookings" | ErrorState |
| Recent activity | activity log (if available) | "No recent activity" | ErrorState |
| Quick actions | Static links | N/A | N/A |

#### DC States

| State | DC class | AC |
|---|---|---|
| Populated (model) | Default | KPI bar + upcoming bookings + quick actions |
| Populated (roster) | Default | Talent list + upcoming shoots + add talent |
| Loading | Skeleton KPIs | 3 shimmer KPI cards |
| Empty (no bookings) | `sc-if viewState="empty"` | "No upcoming bookings" with CTA |
| Empty (roster) | `sc-if viewState="empty"` | "No talent in roster" with add-talent CTA |
| Error | `sc-if viewState="error"` | ErrorState with retry |
| Mobile | Responsive stack | KPI bar stacks 2x2, list full-width |

#### Negative rules

- No fake booking counts — use real data from `list_bookings`
- No fake talent roster — gate behind agency role for roster view
- Role-gate: model view only for talent role, roster only for agency/agent
- 0 bookings is valid state — show empty state, not error

#### DC style tokens

```css
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.kpi-card {
  padding: var(--spacing-6);
  border-radius: var(--radius-xl);
  background: var(--color-card-bg);
}
```

### Reuse audit

| Component | Reuse? | Notes |
|---|---|---|
| `EmptyState` | ✅ | |
| `ErrorState` | ✅ | |
| `Skeleton` | ✅ | KPI card skeleton |
| `StatusChip` | ✅ | For booking status |
| `KPI kit` | 🟡 RF-A6 deferred | Inline KPI cards for MVP — extract later |
| `IntelligencePanel` | ✅ | Not rebuilt |
| `OperatorPanel` | ✅ | Not rebuilt |

- [ ] Components · hooks · CSS modules · utils · RPCs · routes searched

### Screen-specific Done criteria

- [ ] `/app/model` route with model KPI dashboard
- [ ] `/app/roster` route with agency roster dashboard
- [ ] Model view: upcoming bookings, KPI bar, quick actions
- [ ] Roster view: talent list, upcoming shoots, quick actions
- [ ] Empty states for zero-bookings scenarios
- [ ] Role-gated: model = talent role, roster = agency/agent role
- [ ] loading.tsx + error boundary per route
- [ ] KPI cards using tokens.css

### Verification gate

```bash
cd app && npm run lint && npm test && npx tsc --noEmit && CI=true npm run build
```

Browser: `qa@ipix.test` · `:3002` · 1280 + 390 · screenshots → `docs/qa/screenshots/YYYY-MM-DD/`
Visual regression: DC `:8765` vs React `:3002`

### Browser / Playwright matrix

| State | Route | Device | Target |
|---|---|---|---|
| Populated | `/app/model` | 1280px | KPI bar 3-col, upcoming bookings list |
| Populated | `/app/roster` | 1280px | Talent grid, upcoming shoots |
| Loading | Both | 1280px | 3 shimmer KPI cards |
| Empty (no bookings) | `/app/model` | 1280px | "No upcoming bookings" + CTA |
| Empty (no talent) | `/app/roster` | 1280px | "No talent in roster" + add CTA |
| Error | Both | 1280px | ErrorState + retry |
| Mobile | Both | 390px | KPI bar 2x2 stack, list full-width |

### Data flow

```
RSC page.tsx (role gate — check user role)
  /app/model:
  └─ await rpc('list_bookings', { talent_id: user.talent_id, status: 'confirmed' })
  └─ passes to model-dashboard-workspace.tsx (client)

  /app/roster:
  └─ agency query: list all talent + their upcoming bookings
  └─ passes to roster-dashboard-workspace.tsx (client)

Shared components:
  └─ KPIBar (reusable grid of stat cards)
  └─ BookingList (reusable list of upcoming bookings)
  └─ QuickActions (static action chips)
```

### Out of scope

- Shell / nav / IntelligencePanel / chat dock rebuild
- Backend migrations (separate BE-* PR)
- Mobile shell (MOB-* track)
- RF-A6 KPI kit extraction — inline KPI cards for MVP
- Real-time updates (RT1)
- Booking management (create/cancel — see SCR-21/22)

## Readiness

| Layer | Status |
|---|---|
| React | ⚪ |
| Backend | 🟢 |
| AI | 🟡 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/SCR-25-Role-Dashboards.dc.html`](../../Pages/SCR-25-Role-Dashboards.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `app/src/app/(operator)/app/crm/page.tsx` (reference — role-based route pattern)
- `app/src/lib/booking/` (existing booking queries)

## Files likely to modify

- `model/page.tsx` (new)
- `roster/page.tsx` (new)
- `app/src/components/dashboards/model-dashboard-workspace.tsx` (new)
- `app/src/components/dashboards/roster-dashboard-workspace.tsx` (new)
- `app/src/components/dashboards/dashboards.module.css` (new)
- `app/src/lib/booking/queries.ts` (extend with aggregate queries)

## Supabase dependency

`list_bookings` — ✅ live. May need aggregation RPC for KPIs (count queries on bookings + shoots).

## AI dependency

Role-specific CopilotKit suggestions (future — not in MVP scope)

## Mobile dependency

M1 — primary surface for model role (mobile-first). KPI bar stacks 2x2, bookings list full-width.

## Definition of Done

- [ ] Model vs roster dashboards per role param
- [ ] KPI bar, upcoming bookings, quick actions
- [ ] Role-gated access (talent vs agency)
- [ ] loading.tsx + error boundary per route
- [ ] Empty states for zero-bookings scenarios
- [ ] CSS module, no inline styles
- [ ] lint · test · tsc · build green
- [ ] NavSidebar shows model/roster links based on role

## Verification

```bash
cd app && npm run lint
```

## Risk

| Risk | Likelihood | Mitigation |
|---|---|---|
| KPI aggregation needs new RPC | Medium | Client-side count from `list_bookings` for MVP; extract to RPC later |
| Role detection not yet implemented | Medium | Use existing role check from `profiles` table |
| Two routes = double the pages | Low | Shared components (KPIBar, BookingList, QuickActions) |
| `/app/roster` may overlap with agency features | Low | Clear scope: read-only dashboard, not agency management |

## Notes

Two routes sharing one DC with role switch. `/app/model` = talent's self-view. `/app/roster` = agency's team view. Two distinct audiences but same visual layout per DC. KPI bar aggregation likely needs a new small RPC or can use client-side count from existing endpoints for MVP.

HTML coverage check:
- Pages: ✅ SCR-25-Role-Dashboards.dc.html exists
- Components: KPI card, booking row, quick-action chip, talent row (roster)
- States: loading, populated, empty (no bookings), empty (no talent), error — all in DC
- Dialogs: None
- Cards: KPICard, BookingRow, TalentRow (roster)

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `designtoreact` · `ipix-supabase`
