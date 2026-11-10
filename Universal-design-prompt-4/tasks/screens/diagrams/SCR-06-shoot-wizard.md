# SCR-06 diagrams — Shoot Wizard

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
  title Shoot Wizard UX
  section Flow
    Step forward/back: 3: User
  section Flow
    HITL review: 3: User
  section Flow
    commit_shoot_draft: 4: User
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
