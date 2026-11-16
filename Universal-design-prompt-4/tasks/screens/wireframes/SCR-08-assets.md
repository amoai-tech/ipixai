# SCR-08 wireframe — Assets

> **SSOT:** [`Assets.v2.image-first.dc.html`](../../../Pages/Assets.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|          | Brand/shoot scope header                |            |
|          | Filter chips                            |  Digest /  |
|          | Masonry AssetCard grid                  |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Brand/shoot scope header | `*-workspace.tsx` region |
| 2 | Filter chips | `*-workspace.tsx` region |
| 3 | Masonry AssetCard grid | `*-workspace.tsx` region |

## States to implement

- [ ] masonry
- [ ] empty
- [ ] read-only first

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Brand/shoot scope header | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Filter chips | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Masonry AssetCard grid | _from DC_ | _§0 Prove_ | _EmptyState_ |
