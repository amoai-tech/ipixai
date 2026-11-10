# SCR-26 wireframe — Crm Companies

> **SSOT:** [`SCR-26-CRM-Companies-List.dc.html`](../../../Pages/SCR-26-CRM-Companies-List.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|      | Organizations header + New              |            |
|      | Search + status filters                 |  Rail      |
|      | EntityList rows + StatusChip            |  context   |
|      |                                         |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 320px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Organizations header + New | `*-workspace.tsx` region |
| 2 | Search + status filters | `*-workspace.tsx` region |
| 3 | EntityList rows + StatusChip | `*-workspace.tsx` region |

## States to implement

- [ ] list
- [ ] empty
- [ ] no-match

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Organizations header + New | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Search + status filters | _from DC_ | _§0 Prove_ | _EmptyState_ |
| EntityList rows + StatusChip | _from DC_ | _§0 Prove_ | _EmptyState_ |
