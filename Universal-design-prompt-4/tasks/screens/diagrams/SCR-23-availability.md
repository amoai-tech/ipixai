# SCR-23 diagrams — Availability

> **SSOT:** [`SCR-23-Availability-Editor.dc.html`](../../../Pages/SCR-23-Availability-Editor.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 2
  blockNav["Nav 56px"]:1
  blockWs["Workspace"]:3
```

## User flow

```mermaid
journey
  title Availability UX
  section Flow
    Select dates: 3: User
  section Flow
    Set availability: 3: User
  section Flow
    set_availability_batch: 4: User
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
