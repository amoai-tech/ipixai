# SCR-18 wireframe — Collaboration

> **SSOT:** [`SCR-18-Collaboration-Audit.dc.html`](../../../Pages/SCR-18-Collaboration-Audit.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|      | Activity header + export                |            |
|      | Filter tabs (All/Comments/…)            |  Rail      |
|      | Timeline groups                         |  context   |
|      | Intel: attention + glance               |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 320px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Activity header + export | `*-workspace.tsx` region |
| 2 | Filter tabs (All/Comments/…) | `*-workspace.tsx` region |
| 3 | Timeline groups | `*-workspace.tsx` region |
| 4 | Intel: attention + glance | `*-workspace.tsx` region |

## States to implement

- [ ] open comment
- [ ] resolved
- [ ] empty feed

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Activity header + export | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Filter tabs (All/Comments/…) | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Timeline groups | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Intel: attention + glance | _from DC_ | _§0 Prove_ | _EmptyState_ |
