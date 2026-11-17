# SCR-22 wireframe — Booking Detail

> **SSOT:** [`Shoot Detail.v2.image-first.dc.html`](../../../Pages/Shoot Detail.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `standard-v2` |
| DC grid | `auto | minmax(0,1fr) auto` |
| Intelligence width | 332px |

## ASCII layout (lo-fi)

```text
+----------+---------------------------+------------+
| NavSidebar| Workspace (flex)         | Intelligence|
| collapsible|                        | Panel 332px|
| auto width |                        |            |
+----------+---------------------------+------------+
|          | Booking status header                   |            |
|          | FSM actions                             |  Digest /  |
|          | History timeline                        |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Booking status header | `*-workspace.tsx` region |
| 2 | FSM actions | `*-workspace.tsx` region |
| 3 | History timeline | `*-workspace.tsx` region |

## States to implement

- [ ] requested→quoted→confirmed
- [ ] transition_booking

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Booking status header | _from DC_ | _§0 Prove_ | _EmptyState_ |
| FSM actions | _from DC_ | _§0 Prove_ | _EmptyState_ |
| History timeline | _from DC_ | _§0 Prove_ | _EmptyState_ |
