# SCR-30 wireframe — Crm Pipeline

> **SSOT:** [`SCR-30-CRM-Pipeline.dc.html`](../../../Pages/SCR-30-CRM-Pipeline.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|      | Pipeline header                         |            |
|      | Kanban columns by stage                 |  Rail      |
|      | Deal cards draggable                    |  context   |
|      |                                         |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 320px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Pipeline header | `*-workspace.tsx` region |
| 2 | Kanban columns by stage | `*-workspace.tsx` region |
| 3 | Deal cards draggable | `*-workspace.tsx` region |

## States to implement

- [ ] kanban
- [ ] empty column

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Pipeline header | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Kanban columns by stage | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Deal cards draggable | _from DC_ | _§0 Prove_ | _EmptyState_ |
