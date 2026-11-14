# SCR-09 wireframe — Matching

> **SSOT:** [`SCR-09-Matching-Talent.dc.html`](../../../Pages/SCR-09-Matching-Talent.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `fixed-3col` |
| DC grid | `56px | minmax(0,1fr) | 340px` |
| Intelligence width | 340px |

## ASCII layout (lo-fi)

```text
+------+---------------------------+------------+
| Nav  | Workspace                 | Intelligence|
| 56px |                           | 340px|
+------+---------------------------+------------+
|      | 4 tabs incl. Talent                     |            |
|      | Casting/Grid/List mode                  |  Rail      |
|      | Shortlist drawer                        |  context   |
|      | 3-col talent cards                      |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 340px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | 4 tabs incl. Talent | `*-workspace.tsx` region |
| 2 | Casting/Grid/List mode | `*-workspace.tsx` region |
| 3 | Shortlist drawer | `*-workspace.tsx` region |
| 4 | 3-col talent cards | `*-workspace.tsx` region |

## States to implement

- [ ] discovery
- [ ] casting deck
- [ ] shortlist

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| 4 tabs incl. Talent | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Casting/Grid/List mode | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Shortlist drawer | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 3-col talent cards | _from DC_ | _§0 Prove_ | _EmptyState_ |
