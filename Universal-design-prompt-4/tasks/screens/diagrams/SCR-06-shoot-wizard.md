# SCR-06 diagrams — Shoot Wizard

> Current V2 behavior contract for `IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot`.
>
> Linear wireframe: https://linear.app/amo100/document/ipi-1085-shoot-wizard-001-implementation-ready-wireframe-1af361bf203c
>
> Visual DC remains reference-only; current iPix route/data/security owners win.

## User journey

```mermaid
flowchart LR
  E[Open New Shoot] --> G[1 Goal]
  G --> P[2 Products + Channels]
  P --> C[3 Creative Direction]
  C --> D[4 Canonical Deliverables]
  D --> V[5 Visual Shot Plan]
  V --> R[6 Budget + Review]
  R -->|Edit| N[New plan revision]
  N --> R
  R -->|Reject or Cancel| X[No durable shoot write]
  R -->|Approve exact revision| A[Approval identity]
  A --> S[SHOOT-SAVE-001]
  S -->|first save or safe retry| O[One shoot ID]
  O --> H[Open Shoot or Booking handoff]
```

## Ownership / dependency map

```mermaid
flowchart TB
  UI[SHOOT-WIZARD-001 composition UI]
  PROD[IPI-1165 PRODUCTS-001]
  PLAN[IPI-1081 PLAN-001]
  REF[IPI-644 Visual Reference Browser]
  APPR[IPI-1084 APPROVAL-001]
  SAVE[IPI-1083 SHOOT-SAVE-001]
  DB[(Supabase shoot truth)]

  PROD --> UI
  PLAN --> UI
  REF --> UI
  UI --> APPR
  APPR -->|exact approved revision| SAVE
  SAVE --> DB

  UI -. must not own product truth .-> PROD
  UI -. must not recompute plan .-> PLAN
  UI -. must not write shoot directly .-> DB
```

## AI / approval / save sequence

```mermaid
sequenceDiagram
  actor Operator
  participant UI as Shoot Wizard
  participant Planner as production-planner / PLAN-001
  participant Approval as APPROVAL-001
  participant Save as SHOOT-SAVE-001
  participant DB as Supabase shoot truth

  Operator->>UI: Complete Goal / Products / Direction
  UI->>Planner: Request canonical ShootPlan
  Planner-->>UI: Typed revision + assumptions + references
  Operator->>UI: Edit / Keep / Replace / Review
  UI->>Approval: Submit exact reviewed revision
  alt reject or revision requested
    Approval-->>UI: No save unlock
  else exact approval
    Approval-->>UI: Approved revision identity/hash
    UI->>Save: Save approved identity + retry identity
    Save->>DB: Atomic idempotent commit
    DB-->>Save: One shoot ID
    Save-->>UI: Durable success
    UI-->>Operator: Shoot created
  end
```

## Review / save state machine

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> NeedsInput: missing required input
  NeedsInput --> Draft: operator resolves input
  Draft --> Reviewing: canonical plan ready
  Reviewing --> Draft: material edit creates new revision
  Reviewing --> Rejected: reject
  Reviewing --> ApprovedNotSaved: approve exact revision
  Rejected --> Draft: revise or regenerate
  ApprovedNotSaved --> Draft: material edit invalidates approval
  ApprovedNotSaved --> Saving: explicit save
  Saving --> Saved: one durable shoot ID
  Saving --> ApprovedNotSaved: recoverable failure / safe retry
  Saving --> Conflict: mismatched or stale identity
  Conflict --> Reviewing: re-review required
  Saved --> [*]
```

## Negative / recovery path

```mermaid
flowchart TD
  A[Generate or save action] --> B{Result}
  B -->|needs_input| C[Show missing input]
  C --> D[Operator fixes input]
  D --> A
  B -->|tool/provider error| E[Recoverable error]
  E -->|Retry| A
  B -->|reject/cancel/stale approval| F[No durable shoot write]
  B -->|valid exact approval| G[Idempotent save]
  G --> H{Retry / duplicate?}
  H -->|Yes| I[Return same shoot ID]
  H -->|No| J[Create once]
```

## Responsive layout decisions

```mermaid
flowchart LR
  D[1440 desktop] --> D1[Sticky summary rail + full 6-step labels + 2-3 reference columns]
  T[1024 tablet] --> T1[Summary drawer/top strip + full-width step + 2 reference columns]
  M[390 mobile] --> M1[Step N of 6 + summary accordion + single-column cards + stacked review]
```

## Verification path

```mermaid
flowchart LR
  C[Component/state tests] --> I[Owner-contract integration]
  I --> R[Responsive + accessibility]
  R --> H[HITL reject/edit/approve]
  H --> ID[Save idempotency]
  ID --> O[Org A/B negative proof]
  O --> P[Playwright exact user journey]
```

_Validate Mermaid syntax in the target renderer before merge._
