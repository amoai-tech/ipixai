# SCR-17 wireframe — Campaign Performance

> **SSOT:** [`Campaign Performance.v2.image-first.dc.html`](../../../Pages/Campaign Performance.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|          | Campaign selector                       |            |
|          | Performance KPIs                        |  Digest /  |
|          | Channel breakdown                       |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Campaign selector | `*-workspace.tsx` region |
| 2 | Performance KPIs | `*-workspace.tsx` region |
| 3 | Channel breakdown | `*-workspace.tsx` region |

## States to implement

- [ ] blocked D1+D2

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Campaign selector | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Performance KPIs | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Channel breakdown | _from DC_ | _§0 Prove_ | _EmptyState_ |
