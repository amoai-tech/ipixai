# IPI-1084 · APPROVAL-001 — Mermaid diagrams

> These diagrams describe the same contract as `../wireframes/IPI-1084-approval-001.md`. Current iPix V2 runtime/data ownership wins; Lumina is reference-only.

## End-to-end decision flow

```mermaid
flowchart LR
  P[PLAN-001 canonical ShootPlan] --> V[Validate artifact]
  V --> S[Mastra suspend]
  S --> I[AG-UI interrupt]
  I --> R[Operator review UI]
  R -->|Edit| N[New revision + hash]
  N --> R
  R -->|Request changes| Q[No save; revision requested]
  R -->|Reject / cancel| X[No save; terminal non-approved]
  R -->|Approve exact revision| A[Server verifies actor/org/run/revision/hash]
  A --> H[Resume once]
  H --> O[Approved artifact identity]
  O --> D[SHOOT-SAVE-001 downstream]
```

## State machine

```mermaid
stateDiagram-v2
  [*] --> PendingReview
  PendingReview --> Editing: Edit
  Editing --> PendingReview: Apply new revision
  Editing --> PendingReview: Cancel edit
  PendingReview --> Approved: Approve exact revision
  PendingReview --> RevisionRequested: Request changes
  PendingReview --> Rejected: Reject
  PendingReview --> Cancelled: Cancel
  PendingReview --> Stale: Artifact changed / expired
  Stale --> PendingReview: Reload current revision
  Approved --> [*]
  RevisionRequested --> [*]
  Rejected --> [*]
  Cancelled --> [*]
```

## Trust / resume sequence

```mermaid
sequenceDiagram
  actor O as Operator
  participant UI as CopilotKit Review UI
  participant M as Mastra Workflow
  participant A as Approval Validator
  participant S as SHOOT-SAVE-001

  M-->>UI: Interrupt with bounded review identity
  UI-->>O: Render exact ShootPlan revision
  O->>UI: Approve revision R8
  UI->>A: Decision + trusted runtime identity
  A->>A: Verify actor, org, run, step, R8, hash
  A->>M: Resume approved R8 once
  M-->>UI: Approved artifact identity
  Note over M,S: APPROVAL-001 writes no shoot
  UI-->>O: Approved confirmation
  UI->>S: Downstream handoff only when user continues
```

## Edit invalidation

```mermaid
flowchart TD
  R7[Render revision R7] --> E[Operator edits]
  E --> V[Validate typed edit]
  V --> R8[Create revision R8 + new hash]
  R8 --> X[Invalidate any R7 approval identity]
  X --> RR[Require review of R8]
  RR -->|Approve| A[Approve exact R8]
```

## Negative / recovery paths

```mermaid
flowchart TD
  D{Decision attempt} -->|Current exact revision| V[Validate trusted context]
  D -->|Stale revision| ST[Conflict: reload current artifact]
  D -->|Malformed / missing decision| F[Fail closed]
  D -->|Unauthorized / cross-org| U[Fail closed + no protected data]
  D -->|Duplicate / concurrent| C[Resolve against authoritative decision]
  D -->|Network response lost| REC[Reconcile by run + revision identity]

  V -->|Valid approve| R[Resume once]
  V -->|Reject / request / cancel| N[Explicit non-approved result]

  ST --> Z[Zero save unlock]
  F --> Z
  U --> Z
  C --> Z2[No second authoritative outcome]
  REC --> Z2
  N --> Z
```

## Ownership boundaries

```mermaid
flowchart LR
  PLAN[IPI-1081 PLAN-001\nCanonical ShootPlan] --> AP[IPI-1084 APPROVAL-001\nExact human decision]
  REF[IPI-644 Visual References] --> AP
  UI[CopilotKit / AG-UI\nControlled review UI] --> AP
  M[Mastra\nSuspend / resume] --> AP
  AP --> SAVE[IPI-1083 SHOOT-SAVE-001\nDurable shoot write]

  AP -. no shoot-domain write .-> DB[(Shoot domain)]
```

## Verification map

```mermaid
flowchart LR
  H[Happy path] --> E1[Edit invalidates old revision]
  E1 --> E2[Approve exact current revision]
  E2 --> E3[Approved identity returned]
  E3 --> E4[Zero shoot write in APPROVAL-001]

  N1[Reject / cancel / request changes] --> N2[Explicit non-approved state]
  N2 --> N3[Zero save unlock]

  S1[Stale / malformed / unauthorized] --> S2[Fail closed]
  S2 --> S3[Reload or terminal error]

  R1[Duplicate / lost response] --> R2[Reconcile stable identity]
  R2 --> R3[No double resume / decision]
```
