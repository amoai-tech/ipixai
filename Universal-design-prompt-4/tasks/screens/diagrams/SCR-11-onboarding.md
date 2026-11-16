# SCR-11 diagrams — Onboarding

> **SSOT:** [`Onboarding.v2.zeely.dc.html`](../../../Pages/Onboarding.v2.zeely.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
flowchart LR
  S1[Welcome] --> S2[Brand URL]
  S2 --> S3[Intake steps]
  S3 --> S4[Crawl kickoff]
  S4 --> S5["/app Command Center"]
```

## User flow

```mermaid
journey
  title Onboarding UX
  section Flow
    Step through intake: 3: User
  section Flow
    Crawl kickoff: 3: User
  section Flow
    Land /app: 4: User
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
