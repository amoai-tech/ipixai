# SCR-18 diagrams — Collaboration

> **SSOT:** [`SCR-18-Collaboration-Audit.dc.html`](../../../Pages/SCR-18-Collaboration-Audit.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 3
  blockNav["Nav\n56px fixed"]:1
  blockWs["Workspace\nActivity header + export"]:2
  blockIntel["IntelligencePanel\n320px"]:1
```

## User flow

```mermaid
journey
  title Collaboration UX
  section Flow
    Filter feed: 3: User
  section Flow
    Resolve comment: 3: User
  section Flow
    Export audit: 4: User
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
