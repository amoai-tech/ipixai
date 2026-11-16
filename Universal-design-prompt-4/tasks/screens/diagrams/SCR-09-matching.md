# SCR-09 diagrams — Matching

> **SSOT:** [`SCR-09-Matching-Talent.dc.html`](../../../Pages/SCR-09-Matching-Talent.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 3
  blockNav["Nav\n56px fixed"]:1
  blockWs["Workspace\n4 tabs incl. Talent"]:2
  blockIntel["IntelligencePanel\n340px"]:1
```

## User flow

```mermaid
journey
  title Matching UX
  section Flow
    Search talent: 3: User
  section Flow
    Swipe review: 3: User
  section Flow
    Add shortlist → book: 4: User
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
