# SCR-04 diagrams — Shoots List

> **SSOT:** [`Shoots List.v2.image-first.dc.html`](../../../Pages/Shoots List.v2.image-first.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 3
  blockNav["NavSidebar\n56px collapsible"]:1
  blockWs["Workspace\nHeader max-width 920px"]:2
  blockIntel["IntelligencePanel\n340px"]:1
```

## User flow

```mermaid
journey
  title Shoots List UX
  section Flow
    Filter shoots: 3: User
  section Flow
    Open shoot detail: 3: User
  section Flow
    New shoot CTA: 4: User
```

## State machine (if applicable)

```mermaid
stateDiagram-v2
  [*] --> Loading
  Loading --> Populated: data ok
  Loading --> Empty: zero rows
  Loading --> Error: fetch fail
  Error --> Loading: retry refresh
  Populated --> [*]
  Empty --> [*]
```

## Data touchpoints

```mermaid
flowchart LR
  UI[Workspace UI] --> RSC[page.tsx RSC]
  RSC --> SB[(Supabase RPC/tables)]
  RSC --> UI
```

_Validate diagrams in [Mermaid Live](https://mermaid.live) before PR._
