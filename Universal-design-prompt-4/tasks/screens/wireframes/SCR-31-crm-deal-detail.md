# SCR-31 wireframe — Crm Deal Detail

> **SSOT:** [`SCR-31-CRM-Deal-Detail.dc.html`](../../../Pages/SCR-31-CRM-Deal-Detail.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|      | Deal header + stage chip                |            |
|      | 2-col facts                             |  Rail      |
|      | Won/lost HITL + convert                 |  context   |
|      |                                         |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 320px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Deal header + stage chip | `*-workspace.tsx` region |
| 2 | 2-col facts | `*-workspace.tsx` region |
| 3 | Won/lost HITL + convert | `*-workspace.tsx` region |

## States to implement

- [ ] open
- [ ] won
- [ ] lost

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Deal header + stage chip | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 2-col facts | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Won/lost HITL + convert | _from DC_ | _§0 Prove_ | _EmptyState_ |
