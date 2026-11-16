# SCR-24 wireframe — Talent Onboarding

> **SSOT:** [`SCR-24-Talent-Onboarding.dc.html`](../../../Pages/SCR-24-Talent-Onboarding.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `split-2col` |
| DC grid | `400px | minmax(0,1fr)` |
| Intelligence width | — |

## ASCII layout (lo-fi)

```text
+--------------+-----------------------------------+
| Explainer    | Form / steps                      |
| 400px        | Form steps right                                  |
+--------------+-----------------------------------+
DC grid: 400px | minmax(0,1fr)
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Left explainer | `*-workspace.tsx` region |
| 2 | Form steps right | `*-workspace.tsx` region |

## States to implement

- [ ] step wizard

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Left explainer | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Form steps right | _from DC_ | _§0 Prove_ | _EmptyState_ |
