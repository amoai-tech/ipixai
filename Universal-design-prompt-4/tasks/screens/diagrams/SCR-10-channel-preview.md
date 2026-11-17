# SCR-10 diagrams — Channel Preview

> **SSOT:** [`Channel Preview.v2.image-first.dc.html`](../../../Pages/Channel Preview.v2.image-first.dc.html) · Skill: [`mermaid-diagrams`](../../../../.agents/skills/mermaid-diagrams/SKILL.md)

## Layout block (matches DC shell)

```mermaid
block-beta
  columns 3
  blockNav["NavSidebar\n56px collapsible"]:1
  blockWs["Workspace\nChannel tabs (IG/TikTok/…)"]:2
  blockIntel["IntelligencePanel\n340px"]:1
```

## User flow

```mermaid
journey
  title Channel Preview UX
  section Flow
    Pick channel: 3: User
  section Flow
    Preview post: 3: User
  section Flow
    Approve publish: 4: User
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
