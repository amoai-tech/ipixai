# SCR-06 wireframe — Shoot Wizard

> **SSOT:** [`Shoot Wizard.v2.image-first.dc.html`](../../../Pages/Shoot Wizard.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `wizard-full` |
| DC grid | `flex column 100vh` |
| Intelligence width | — |

## ASCII layout (lo-fi)

```text
+--------------------------------------------------+
| Topbar · step indicator · save/back              |
+----------+---------------------------------------+
| Sticky   | Step workspace                        |
| summary  | 266px sticky left summary                         |
| ~266px   |                                       |
+----------+---------------------------------------+
| PersistentChatDock (CopilotKit)                  |
+--------------------------------------------------+
DC: flex column 100vh — no 3-panel shell
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Topbar steps (6 ship scope) | `*-workspace.tsx` region |
| 2 | 266px sticky left summary | `*-workspace.tsx` region |
| 3 | Step content + review grid | `*-workspace.tsx` region |

## States to implement

- [ ] step 1–6
- [ ] validation error
- [ ] review commit

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Topbar steps (6 ship scope) | _from DC_ | _§0 Prove_ | _EmptyState_ |
| 266px sticky left summary | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Step content + review grid | _from DC_ | _§0 Prove_ | _EmptyState_ |
