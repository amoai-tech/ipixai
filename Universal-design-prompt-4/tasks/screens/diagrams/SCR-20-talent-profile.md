# SCR-20 diagrams — Talent Profile

> **SSOT:** [`SCR-20-Talent-Profile.dc.html`](../../../Pages/SCR-20-Talent-Profile.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 3
  blockNav["Nav\n56px fixed"]:1
  blockWs["Workspace\nProfile hero"]:2
  blockIntel["IntelligencePanel\n320px"]:1
```

## User flow

```mermaid
journey
  title Talent Profile UX
  section Flow
    View talent: 3: User
  section Flow
    Toggle shortlist: 3: User
  section Flow
    Book wizard: 4: User
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
