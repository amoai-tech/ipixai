# SCR-04 wireframe — Shoots List

> **SSOT:** [`Shoots List.v2.image-first.dc.html`](../../../Pages/Shoots List.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|          | Header max-width 920px                  |            |
|          | FilterBar + sort                        |  Digest /  |
|          | 3-col ShootCard grid                    |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Header max-width 920px | `*-workspace.tsx` region |
| 2 | FilterBar + sort | `*-workspace.tsx` region |
| 3 | 3-col ShootCard grid | `*-workspace.tsx` region |

## States to implement

- [ ] grid
- [ ] empty
- [ ] error
- [ ] loading skeleton

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Header max-width 920px | _from DC_ | _§0 Prove_ | _EmptyState_ |
| FilterBar + sort | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 3-col ShootCard grid | _from DC_ | _§0 Prove_ | _EmptyState_ |
