# SCR-27 diagrams — Crm Company Detail

> **SSOT:** [`SCR-27-CRM-Company-Detail.dc.html`](../../../Pages/SCR-27-CRM-Company-Detail.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 3
  blockNav["Nav\n56px fixed"]:1
  blockWs["Workspace\nCompany header + status"]:2
  blockIntel["IntelligencePanel\n320px"]:1
```

## User flow

```mermaid
journey
  title Crm Company Detail UX
  section Flow
    Switch tab: 3: User
  section Flow
    Link to contact/deal: 4: User
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
