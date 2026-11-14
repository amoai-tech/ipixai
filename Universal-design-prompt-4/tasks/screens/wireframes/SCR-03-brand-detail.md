# SCR-03 wireframe — Brand Detail

> **SSOT:** [`Brand Detail.v2.image-first.dc.html`](../../../Pages/Brand Detail.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
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
|          | Hero image + chips                      |            |
|          | Tab bar                                 |  Digest /  |
|          | Tab panel (Overview/DNA/Shoots/Assets)  |  actions   |
|          |                                         |            |
+----------+---------------------------+------------+
DC grid: auto | minmax(0,1fr) auto
Mobile @1024: Nav→tab bar · Intel→bottom sheet
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Hero image + chips | `*-workspace.tsx` region |
| 2 | Tab bar | `*-workspace.tsx` region |
| 3 | Tab panel (Overview/DNA/Shoots/Assets) | `*-workspace.tsx` region |

## States to implement

- [ ] tab switch
- [ ] crawl progress
- [ ] empty tab

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Hero image + chips | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Tab bar | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Tab panel (Overview/DNA/Shoots/Assets) | _from DC_ | _§0 Prove_ | _EmptyState_ |
