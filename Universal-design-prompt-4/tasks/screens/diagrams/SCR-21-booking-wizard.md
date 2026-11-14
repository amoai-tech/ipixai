# SCR-21 diagrams — Booking Wizard

> **SSOT:** [`Shoot Wizard.v2.image-first.dc.html`](../../../Pages/Shoot Wizard.v2.image-first.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
flowchart TD
  A[Topbar steps] --> B[Left summary rail]
  B --> C[Step content]
  C --> D{Valid?}
  D -->|Yes| E[Next step]
  D -->|No| C
  E --> F[HITL commit]
```

## User flow

```mermaid
journey
  title Booking Wizard UX
  section Flow
    Draft with agent: 3: User
  section Flow
    Operator approve: 3: User
  section Flow
    create_booking_request: 4: User
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
