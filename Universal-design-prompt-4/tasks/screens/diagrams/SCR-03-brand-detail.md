# SCR-03 diagrams — Brand Detail

> **SSOT:** [`Brand Detail.v2.image-first.dc.html`](../../../Pages/Brand Detail.v2.image-first.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 3
  blockNav["NavSidebar\n56px collapsible"]:1
  blockWs["Workspace\nHero image + chips"]:2
  blockIntel["IntelligencePanel\n332px"]:1
```

## User flow

```mermaid
journey
  title Brand Detail UX
  section Flow
    Open brand: 3: User
  section Flow
    Switch tab: 3: User
  section Flow
    Start crawl / shoot: 4: User
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
