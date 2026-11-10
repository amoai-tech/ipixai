# SCR-07 wireframe — Campaigns

> **SSOT:** [`Campaigns.v2.image-first.dc.html`](../../../Pages/Campaigns.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|          | Header + filters                        |            |
|          | 3-col CampaignCard grid                 |  Digest /  |
|          | State toggles                           |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Header + filters | `*-workspace.tsx` region |
| 2 | 3-col CampaignCard grid | `*-workspace.tsx` region |
| 3 | State toggles | `*-workspace.tsx` region |

## States to implement

- [ ] grid
- [ ] empty
- [ ] blocked D1

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Header + filters | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 3-col CampaignCard grid | _from DC_ | _§0 Prove_ | _EmptyState_ |
| State toggles | _from DC_ | _§0 Prove_ | _EmptyState_ |
