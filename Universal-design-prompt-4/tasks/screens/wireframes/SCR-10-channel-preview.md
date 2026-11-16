# SCR-10 wireframe — Channel Preview

> **SSOT:** [`Channel Preview.v2.image-first.dc.html`](../../../Pages/Channel Preview.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|          | Channel tabs (IG/TikTok/…)              |            |
|          | Phone frame carousel                    |  Digest /  |
|          | Publish controls                        |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Channel tabs (IG/TikTok/…) | `*-workspace.tsx` region |
| 2 | Phone frame carousel | `*-workspace.tsx` region |
| 3 | Publish controls | `*-workspace.tsx` region |

## States to implement

- [ ] channel switch
- [ ] empty posts

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Channel tabs (IG/TikTok/…) | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Phone frame carousel | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Publish controls | _from DC_ | _§0 Prove_ | _EmptyState_ |
