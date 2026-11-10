# SCR-01 wireframe — Command Center

> **SSOT:** [`Command Center.v2.image-first.dc.html`](../../../Pages/Command Center.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|          | Header + greeting                       |            |
|          | KPI metric row                          |  Digest /  |
|          | Needs attention list                    |  actions   |
|          | Brand cards grid                        |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Header + greeting | `*-workspace.tsx` region |
| 2 | KPI metric row | `*-workspace.tsx` region |
| 3 | Needs attention list | `*-workspace.tsx` region |
| 4 | Brand cards grid | `*-workspace.tsx` region |

## States to implement

- [ ] populated
- [ ] empty brands
- [ ] loading

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Header + greeting | _from DC_ | _§0 Prove_ | _EmptyState_ |
| KPI metric row | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Needs attention list | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Brand cards grid | _from DC_ | _§0 Prove_ | _EmptyState_ |
