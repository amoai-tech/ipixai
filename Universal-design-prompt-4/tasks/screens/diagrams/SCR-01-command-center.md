# SCR-01 diagrams — Command Center

> **SSOT:** [`Command Center.v2.image-first.dc.html`](../../../Pages/Command Center.v2.image-first.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 3
  blockNav["NavSidebar\n56px collapsible"]:1
  blockWs["Workspace\nHeader + greeting"]:2
  blockIntel["IntelligencePanel\n332px"]:1
```

## User flow

```mermaid
journey
  title Command Center UX
  section Flow
    Land /app: 3: User
  section Flow
    Scan KPIs: 3: User
  section Flow
    Open brand card: 3: User
  section Flow
    Rail suggests next action: 4: User
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
