# SCR-11 wireframe — Onboarding

> **SSOT:** [`Onboarding.v2.zeely.dc.html`](../../../Pages/Onboarding.v2.zeely.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `onboarding-full` |
| DC grid | `full-bleed centered card` |
| Intelligence width | — |

## ASCII layout (lo-fi)

```text
+--------------------------------------------------+
| Fixed top chrome · back · logo · skip · progress |
+--------------------------------------------------+
|           centered stage card (max ~480px)         |
|           Stage card max 480px                              |
+--------------------------------------------------+
| Full-bleed dark bg · no operator shell           |
+--------------------------------------------------+
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Top chrome + progress 3-seg | `*-workspace.tsx` region |
| 2 | Stage card max 480px | `*-workspace.tsx` region |
| 3 | 13 screens / zeely flow | `*-workspace.tsx` region |

## States to implement

- [ ] welcome
- [ ] brand URL
- [ ] payoff

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Top chrome + progress 3-seg | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Stage card max 480px | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 13 screens / zeely flow | _from DC_ | _§0 Prove_ | _EmptyState_ |
