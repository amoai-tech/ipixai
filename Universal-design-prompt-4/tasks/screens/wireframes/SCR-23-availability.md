# SCR-23 wireframe — Availability

> **SSOT:** [`SCR-23-Availability-Editor.dc.html`](../../../Pages/SCR-23-Availability-Editor.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `two-panel` |
| DC grid | `56px | minmax(0,1fr)` |
| Intelligence width | — |

## ASCII layout (lo-fi)

```text
+------+------------------------------------------+
| Nav  | Workspace (no intelligence column)       |
| 56px | Month header                                      |
+------+------------------------------------------+
DC grid: 56px | minmax(0,1fr)
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Month header | `*-workspace.tsx` region |
| 2 | 7-col week grid | `*-workspace.tsx` region |
| 3 | Batch select cells | `*-workspace.tsx` region |

## States to implement

- [ ] edit cells
- [ ] save batch

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Month header | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 7-col week grid | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Batch select cells | _from DC_ | _§0 Prove_ | _EmptyState_ |
