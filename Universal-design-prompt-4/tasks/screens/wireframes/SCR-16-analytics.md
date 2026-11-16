# SCR-16 wireframe — Analytics

> **SSOT:** [`Analytics.v2.image-first.dc.html`](../../../Pages/Analytics.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `standard-v2` |
| DC grid | `auto | minmax(0,1fr) auto` |
| Intelligence width | 340px |

## ASCII layout (lo-fi)

```text
+----------+---------------------------+------------+
| NavSidebar| Workspace (flex)         | Intelligence|
| collapsible|                        | Panel 340px|
| auto width |                        |            |
+----------+---------------------------+------------+
|          | Date range header                       |            |
|          | KPI row                                 |  Digest /  |
|          | Chart panels                            |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Date range header | `*-workspace.tsx` region |
| 2 | KPI row | `*-workspace.tsx` region |
| 3 | Chart panels | `*-workspace.tsx` region |

## States to implement

- [ ] empty D2
- [ ] loading

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Date range header | _from DC_ | _§0 Prove_ | _EmptyState_ |
| KPI row | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Chart panels | _from DC_ | _§0 Prove_ | _EmptyState_ |
