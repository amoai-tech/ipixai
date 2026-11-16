# SCR-15 — Notification Center

| Field | Value |
|---|---|
| **ID** | SCR-15 |
| **Route** | `/app/inbox` |
| **Priority** | P2 |
| **Status** | ⚪ 0% |
| **Linear** | [IPI-407](https://linear.app/amo100/issue/IPI-407) |
| **Dependencies** | RT1 optional for live updates |
| **Complexity** | M |
| **Branch** | `ipi/scr-15-notifications-inbox` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-15-notifications.md](./wireframes/SCR-15-notifications.md) |
| **Diagram** | [./diagrams/SCR-15-notifications.md](./diagrams/SCR-15-notifications.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/SCR-15-Notification-Center.dc.html` |
| **React route** | `/app/inbox` |
| **Page file** | `app/src/app/(operator)/app/inbox/page.tsx` |
| **Route status** | **greenfield** — create new route |
| **Scope note** | Wire list_notifications RPC + mark read. Realtime (RT1) is optional follow-up — poll-based refresh suffices for MVP. |

### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/SCR-15-Notification-Center.dc.html`](../../Pages/SCR-15-Notification-Center.dc.html) |
| **Wireframe** | [./wireframes/SCR-15-notifications.md](./wireframes/SCR-15-notifications.md) |
| **Mermaid** | [./diagrams/SCR-15-notifications.md](./diagrams/SCR-15-notifications.md) |
| **Shell** | `fixed-3col` · grid `56px \| minmax(0,1fr) \| 320px` |
| **DC workspace width** | auto (fills available) |
| **Row spec** | Avatar/icon (32px) + title (bold) + preview (truncated) + timestamp + unread dot |

Skills: [`ipix-wireframe`](../../../.agents/skills/ipix-wireframe/SKILL.md) · [`mermaid-diagrams`](../../../.agents/skills/mermaid-diagrams/SKILL.md)

### Notification row anatomy

```
┌─────────────────────────────────────────────────────────┐
│ [icon]  Title text (bold if unread)        2m ago  ●    │
│         Preview line truncated to 1 line                 │
├─────────────────────────────────────────────────────────┤
│ [icon]  Different notification             Yesterday  ● │
│         Second preview line                            │
└─────────────────────────────────────────────────────────┘
```

Group dividers: "Today", "Yesterday", "This week", "Earlier"

### 2. Skill routing

| Skill | When | This screen |
|---|---|---|:---:|
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

### Phase 0 — Prove

#### Production-state

| Area | Exists today? | This PR changes? |
|---|---|---|
| Route | No `/app/inbox` route | Create route + nav link |
| Shell | ✅ OperatorPanel | No |
| Workspace | N/A — greenfield | Yes |
| Data wiring | N/A — greenfield | Wire list_notifications + mark_read RPCs |

#### API/RPC verification

| Endpoint | Status | Notes |
|---|---|---|
| `list_notifications` | 🟢 live | Returns paginated notifications for org |
| `mark_notifications_read` | 🟢 live | Batch mark-as-read by ID array |
| `notifications` table (direct) | 🟢 live | Read-only via RSC |
| Realtime publication (RT1) | 🔴 not started | Optional for live push — defer |

#### Data-source

| Block | Source | Empty | Error | Image |
|---|---|---|---|---|
| Notification list | `list_notifications(org_id)` | "No notifications yet" | ErrorState + retry | N/A — icon only |
| Group headers | derived from `created_at` | N/A | N/A | N/A |
| Unread badge | `notifications.read_at IS NULL` | No badge | N/A | N/A |

#### DC States

| State | DC class | AC |
|---|---|---|
| Populated | Default list | Grouped rows with avatar/icon, title, timestamp, unread dot |
| Loading | Skeleton rows | 5 shimmer rows matching notification row height |
| Empty | `sc-if viewState="empty"` | Illustration + "No notifications yet" |
| Error | `sc-if viewState="error"` | ErrorState with retry |
| Marking-read | Optimistic update | Dot removed, row dims slightly |

#### Negative rules

- No fake notification content — `list_notifications` returns real data
- No polling interval > 30s without RT1 (Realtime) — use client-side refresh button
- Existing NotificationBell/badge in nav sidebar must update count
- Route must appear in NavSidebar with notification count badge

#### DC style spec

```css
.notification-row {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
}
.notification-row:hover {
  background: var(--color-hover-bg);
}
.notification-row.unread {
  background: var(--color-unread-bg); /* very subtle tint */
}
.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
}
```

### Reuse audit

| Component | Reuse? | Notes |
|---|---|---|
| `EmptyState` | ✅ | With notification-specific illustration |
| `ErrorState` | ✅ | With retry action |
| `Skeleton` | ✅ | Custom notification-row skeleton |
| `StatusChip` | — | Not needed for notifications |
| `IntelligencePanel` | ✅ | Not rebuilt |
| `OperatorPanel` | ✅ | Not rebuilt |
| `NotificationBell` | 🟡 | NavSidebar badge — update count |

- [ ] Components · hooks · CSS modules · utils · RPCs · routes searched

### Screen-specific Done criteria

- [ ] New route `/app/inbox`
- [ ] List notifications from `list_notifications` RPC
- [ ] Mark-read on click
- [ ] Grouped by date (Today/Yesterday/This week/Earlier)
- [ ] Loading skeleton (5 shimmer rows)
- [ ] EmptyState + ErrorState
- [ ] NavSidebar link with unread badge
- [ ] CSS module using tokens.css

### Verification gate

```bash
cd app && npm run lint && npm test -- notifications && npx tsc --noEmit && CI=true npm run build
```

Browser: `qa@ipix.test` · `:3002` · 1280 + 390 · screenshots → `docs/qa/screenshots/YYYY-MM-DD/`
Visual regression: DC `:8765` vs React `:3002`

### Browser / Playwright matrix

| State | Device | Target |
|---|---|---|
| Populated | 1280px | Grouped rows, unread dots, timestamps |
| Loading | 1280px | 5 shimmer rows |
| Empty | 1280px | "No notifications yet" illustration |
| Error | 1280px | Error message + retry |
| Mark-read | 1280px | Click row → dot disappears, row dims |
| Mobile | 390px | Full-width rows, no overflow |

### Data flow

```
RSC page.tsx
  └─ await rpc('list_notifications', { p_org_id })
  └─ passes to inbox-workspace.tsx (client)
       ├─ grouped by date → rendered as sections
       ├─ onRowClick → rpc('mark_notifications_read', [id]) + optimistic remove dot
       └─ empty/loading/error via derived view state
```

### Out of scope

- Shell / nav / IntelligencePanel / chat dock rebuild
- Backend migrations (separate BE-* PR)
- Real-time push (RT1) — use poll/refresh for MVP
- Mobile shell (MOB-* track)
- Notification preferences/settings

## Readiness

| Layer | Status |
|---|---|
| React | ⚪ |
| Backend | 🟢 |
| AI | — |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/SCR-15-Notification-Center.dc.html`](../../Pages/SCR-15-Notification-Center.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `app/src/lib/notifications/` (existing lib)
- `app/src/app/(operator)/app/` (check sibling routes for pattern)

## Files likely to modify

- `inbox/page.tsx` (new)
- `app/src/components/notifications/inbox-workspace.tsx` (new)
- `app/src/components/notifications/notification-row.tsx` (new)
- `app/src/components/notifications/inbox.module.css` (new)
- `app/src/components/operator-panel/nav-sidebar.tsx` (add inbox link + badge)

## Supabase dependency

`list_notifications`, `mark_notifications_read` — ✅ live. No new RPCs needed.

## AI dependency

None

## Mobile dependency

M1 · BottomSheet for detail (if clicking opens detail panel)

## Definition of Done

- [ ] New route `/app/inbox`
- [ ] List + mark-read wired to RPCs
- [ ] Grouped by date per DC
- [ ] EmptyState + SkeletonLoader + ErrorState
- [ ] NavSidebar link active with count badge
- [ ] CSS module, no inline styles
- [ ] lint · test · tsc · build green
- [ ] Side-by-side screenshots vs DC

## Verification

```bash
cd app && npm test -- notifications
```

## Risk

| Risk | Likelihood | Mitigation |
|---|---|---|
| NavSidebar badge needs re-fetch after marking read | Low | Client-side counter; full re-fetch on nav |
| Large notification count slows list | Low | RPC returns max 50; pagination follow-up |
| Route doesn't exist yet — need to create | Low | Standard route creation per existing pattern |

## Notes

No route exists — must create `/app/inbox`. Backend RPCs verified live. RT1 (Realtime) deferred — poll on page focus suffices for MVP. NavSidebar badge must be wired in same PR to avoid stale-count UX.

HTML coverage check:
- Pages: ✅ SCR-15-Notification-Center.dc.html exists
- Components: notification row, group header, badge
- States: loading, populated, empty, error — all in DC
- Dialogs: None (row click marks read, no detail modal in MVP)
- Cards: NotificationRow with icon, title, preview, timestamp, unread dot

## Skills

`design-to-production` · `nextjs-developer` · `designtoreact` · `ipix-supabase`
