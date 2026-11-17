# SCR-29 wireframe — Crm Contact Detail

> **SSOT:** [`SCR-29-CRM-Contact-Detail.dc.html`](../../../Pages/SCR-29-CRM-Contact-Detail.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|      | Contact header                          |            |
|      | Tabs Overview/Deals/Activity            |  Rail      |
|      | Multi email/phone                       |  context   |
|      |                                         |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 320px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Contact header | `*-workspace.tsx` region |
| 2 | Tabs Overview/Deals/Activity | `*-workspace.tsx` region |
| 3 | Multi email/phone | `*-workspace.tsx` region |

## States to implement

- [ ] Profile360

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Contact header | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Tabs Overview/Deals/Activity | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Multi email/phone | _from DC_ | _§0 Prove_ | _EmptyState_ |
