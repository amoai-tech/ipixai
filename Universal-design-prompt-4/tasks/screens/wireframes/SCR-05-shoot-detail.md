# SCR-05 wireframe — Shoot Detail

> **SSOT:** [`Shoot Detail.v2.image-first.dc.html`](../../../Pages/Shoot Detail.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|          | Cover image + status                    |            |
|          | 6–9 tab shell                           |  Digest /  |
|          | Tab content panels                      |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Cover image + status | `*-workspace.tsx` region |
| 2 | 6–9 tab shell | `*-workspace.tsx` region |
| 3 | Tab content panels | `*-workspace.tsx` region |

## States to implement

- [ ] per-tab empty
- [ ] loading
- [ ] HITL approval inline

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Cover image + status | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 6–9 tab shell | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Tab content panels | _from DC_ | _§0 Prove_ | _EmptyState_ |
