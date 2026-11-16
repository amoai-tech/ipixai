# SCR-20 wireframe — Talent Profile

> **SSOT:** [`SCR-20-Talent-Profile.dc.html`](../../../Pages/SCR-20-Talent-Profile.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|      | Profile hero                            |            |
|      | Stats + availability                    |  Rail      |
|      | Book CTA                                |  context   |
|      |                                         |            |
+------+---------------------------+------------+
DC grid: 56px | minmax(0,1fr) | 320px
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Profile hero | `*-workspace.tsx` region |
| 2 | Stats + availability | `*-workspace.tsx` region |
| 3 | Book CTA | `*-workspace.tsx` region |

## States to implement

- [ ] operator vs model mode

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Profile hero | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Stats + availability | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Book CTA | _from DC_ | _§0 Prove_ | _EmptyState_ |
