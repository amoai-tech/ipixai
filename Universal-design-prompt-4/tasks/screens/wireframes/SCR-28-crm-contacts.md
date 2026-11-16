# SCR-28 wireframe — Crm Contacts

> **SSOT:** [`SCR-28-CRM-Contacts-List.dc.html`](../../../Pages/SCR-28-CRM-Contacts-List.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|      | Contacts header                         |            |
|      | Search + filters                        |  Rail      |
|      | EntityList contact rows                 |  context   |
|      |                                         |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 320px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Contacts header | `*-workspace.tsx` region |
| 2 | Search + filters | `*-workspace.tsx` region |
| 3 | EntityList contact rows | `*-workspace.tsx` region |

## States to implement

- [ ] list
- [ ] empty

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Contacts header | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Search + filters | _from DC_ | _§0 Prove_ | _EmptyState_ |
| EntityList contact rows | _from DC_ | _§0 Prove_ | _EmptyState_ |
