# SCR-02 diagrams — Brand List

> **SSOT:** [`Brand List.v2.image-first.dc.html`](../../../Pages/Brand List.v2.image-first.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 3
  blockNav["NavSidebar\n56px collapsible"]:1
  blockWs["Workspace\nPageHeader + New brand"]:2
  blockIntel["IntelligencePanel\n340px"]:1
```

## User flow

```mermaid
journey
  title Brand List UX
  section Flow
    Search/filter: 3: User
  section Flow
    Select card: 3: User
  section Flow
    Navigate to detail: 4: User
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
