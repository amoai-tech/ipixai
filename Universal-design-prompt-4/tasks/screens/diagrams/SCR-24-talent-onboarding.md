# SCR-24 diagrams — Talent Onboarding

> **SSOT:** [`SCR-24-Talent-Onboarding.dc.html`](../../../Pages/SCR-24-Talent-Onboarding.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 2
  blockLeft["Explainer 400px"]:1
  blockRight["Form steps"]:2
```

## User flow

```mermaid
journey
  title Talent Onboarding UX
  section Flow
    Complete profile: 3: User
  section Flow
    Submit for review: 4: User
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
