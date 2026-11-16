# SCR-15 wireframe — Notifications

> **SSOT:** [`SCR-15-Notification-Center.dc.html`](../../../Pages/SCR-15-Notification-Center.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `fixed-3col` |
| DC grid | `56px | minmax(0,1fr) | 320px` |
| Intelligence width | 320px |

## ASCII layout (lo-fi)

```text
+------+---------------------------+------------+
| Nav  | Workspace                 | Intelligence|
| 56px |                           | 320px|
+------+---------------------------+------------+
|      | Inbox header                            |            |
|      | Filter tabs                             |  Rail      |
|      | Notification rows + read state          |  context   |
|      |                                         |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 320px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Inbox header | `*-workspace.tsx` region |
| 2 | Filter tabs | `*-workspace.tsx` region |
| 3 | Notification rows + read state | `*-workspace.tsx` region |

## States to implement

- [ ] unread
- [ ] empty inbox
- [ ] mark read

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Inbox header | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Filter tabs | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Notification rows + read state | _from DC_ | _§0 Prove_ | _EmptyState_ |
