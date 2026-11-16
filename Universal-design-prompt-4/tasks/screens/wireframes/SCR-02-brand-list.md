# SCR-02 wireframe — Brand List

> **SSOT:** [`Brand List.v2.image-first.dc.html`](../../../Pages/Brand List.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|          | PageHeader + New brand                  |            |
|          | Search + FilterBar                      |  Digest /  |
|          | 3-col BrandCard grid                    |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | PageHeader + New brand | `*-workspace.tsx` region |
| 2 | Search + FilterBar | `*-workspace.tsx` region |
| 3 | 3-col BrandCard grid | `*-workspace.tsx` region |

## States to implement

- [ ] grid
- [ ] empty
- [ ] no-match
- [ ] loading

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| PageHeader + New brand | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Search + FilterBar | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 3-col BrandCard grid | _from DC_ | _§0 Prove_ | _EmptyState_ |
