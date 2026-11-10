# SCR-27 wireframe — Crm Company Detail

> **SSOT:** [`SCR-27-CRM-Company-Detail.dc.html`](../../../Pages/SCR-27-CRM-Company-Detail.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|      | Company header + status                 |            |
|      | Tabs: Overview/Contacts/Deals/Activity  |  Rail      |
|      | Profile360 panels                       |  context   |
|      |                                         |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 320px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Company header + status | `*-workspace.tsx` region |
| 2 | Tabs: Overview/Contacts/Deals/Activity | `*-workspace.tsx` region |
| 3 | Profile360 panels | `*-workspace.tsx` region |

## States to implement

- [ ] tab empty gated
- [ ] linked rows

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Company header + status | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Tabs: Overview/Contacts/Deals/Activity | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Profile360 panels | _from DC_ | _§0 Prove_ | _EmptyState_ |
