# SCR-21 wireframe — Booking Wizard

> **SSOT:** [`Shoot Wizard.v2.image-first.dc.html`](../../../Pages/Shoot Wizard.v2.image-first.dc.html) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Rule:** ASCII zones must match DC `grid-template-columns` and Workspace blocks — not invented layout.

## Shell archetype

| Field | Value |
|---|---|
| Archetype | `wizard-full` |
| DC grid | `flex column 100vh` |
| Intelligence width | Copilot dock |

## ASCII layout (lo-fi)

```text
+--------------------------------------------------+
| Topbar · step indicator · save/back              |
+----------+---------------------------------------+
| Sticky   | Step workspace                        |
| summary  | Rate/dates/message                                |
| ~266px   |                                       |
+----------+---------------------------------------+
| PersistentChatDock (CopilotKit)                  |
+--------------------------------------------------+
DC: flex column 100vh — no 3-panel shell
```

## Workspace zones (from DC)

| # | Zone | React target |
|---:|---|---|
| 1 | Standalone booking steps | `*-workspace.tsx` region |
| 2 | Rate/dates/message | `*-workspace.tsx` region |
| 3 | HITL draft review | `*-workspace.tsx` region |

## States to implement

- [ ] draft
- [ ] submit request

## Zone spec table

| Zone | Interaction | Data | Empty |
|---|---|---|---|
| Standalone booking steps | _from DC_ | _§0 Prove_ | _EmptyState_ |
| Rate/dates/message | _from DC_ | _§0 Prove_ | _EmptyState_ |
| HITL draft review | _from DC_ | _§0 Prove_ | _EmptyState_ |
