# SCR-25 wireframe — Role Dashboards

> **SSOT:** [`SCR-25-Role-Dashboards.dc.html`](../../../Pages/SCR-25-Role-Dashboards.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `fixed-3col` |
| DC grid | `56px | minmax(0,1fr) | 340px` |
| Intelligence width | 340px |

## ASCII layout (lo-fi)

```text
+------+---------------------------+------------+
| Nav  | Workspace                 | Intelligence|
| 56px |                           | 340px|
+------+---------------------------+------------+
|      | Role switch model/roster                |            |
|      | 4 KPI cards                             |  Rail      |
|      | Upcoming bookings list                  |  context   |
|      |                                         |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 340px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Role switch model/roster | `*-workspace.tsx` region |
| 2 | 4 KPI cards | `*-workspace.tsx` region |
| 3 | Upcoming bookings list | `*-workspace.tsx` region |

## States to implement

- [ ] model view
- [ ] agency roster

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Role switch model/roster | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 4 KPI cards | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Upcoming bookings list | _from DC_ | _§0 Prove_ | _EmptyState_ |
