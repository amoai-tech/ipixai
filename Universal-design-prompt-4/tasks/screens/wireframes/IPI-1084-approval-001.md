# IPI-1084 · APPROVAL-001 — ShootPlan Review / Approval Wireframe

> Current iPix V2 truth wins. Lumina is reference-only. This is a reusable embedded review surface, not a standalone route.

## Goal

Let an authenticated operator review, edit, request changes, reject, or explicitly approve the exact canonical ShootPlan revision before any shoot save is allowed.

APPROVAL-001 owns the human decision only. `IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization` owns durable shoot persistence.

## Current truth

- No current iPix application `ApprovalCard` implementation was found.
- No current application `useInterrupt` approval surface was found.
- Current iPix already has typed Mastra `suspend()` / resume behavior in `src/mastra/workflows/brand-intelligence.ts`, including a bounded hash identity.
- `ShootPlanSchema` is still owned by `IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan` and is not current implementation.
- CopilotKit/AG-UI/Mastra package family on current main: CopilotKit `1.68.1`, `@ag-ui/mastra` `1.1.2`, `@mastra/core` `1.63.2`.

**Readiness:** 86/100 — wireframe drafted and testable; implementation blocked by PLAN-001 and exact current application interrupt proof.

## User journey

```text
Canonical ShootPlan proposal
→ operator understands assumptions / warnings / deliverables / shots / budget
→ operator edits OR requests changes OR rejects
→ every accepted edit creates a new revision/hash
→ operator reviews the new revision
→ operator explicitly approves that exact revision
→ server verifies actor/org/run/step/revision/hash
→ workflow resumes once
→ UI confirms approval
→ downstream SHOOT-SAVE-001 may persist later
```

Reject/cancel/stale/close/disconnect must never unlock persistence.

## Desktop wireframe — 1440

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Shoot Plan Review                                            Revision R7     │
│ AI proposal · Review required                    [Pending human approval]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ MAIN REVIEW                                            APPROVAL SUMMARY      │
│                                                                              │
│ ┌──────────────────────────────────────────────────┐  ┌───────────────────┐ │
│ │ What the AI understood                          │  │ Status            │ │
│ │ Goal / products / channels / creative direction│  │ Pending           │ │
│ │ Assumptions + warnings when present             │  │ Revision R7       │ │
│ └──────────────────────────────────────────────────┘  │ Exact hash ••••   │ │
│                                                      ├───────────────────┤ │
│ ┌──────────────────────────────────────────────────┐  │ Changes           │ │
│ │ Deliverables                              [Edit] │  │ Operator edits    │ │
│ │ Canonical PLAN-001 values only                  │  │ Assumptions       │ │
│ └──────────────────────────────────────────────────┘  ├───────────────────┤ │
│                                                      │ Approval effect    │ │
│ ┌──────────────────────────────────────────────────┐  │ Unlocks downstream │ │
│ │ Visual Shot Plan                         [Edit]  │  │ save only         │ │
│ │ [trusted reference preview]                     │  │ No shoot write yet│ │
│ │ Keep · Replace · Edit · Remove                   │  └───────────────────┘ │
│ └──────────────────────────────────────────────────┘                        │
│                                                                              │
│ ┌──────────────────────────────────────────────────┐                        │
│ │ Budget                                    [Edit] │                        │
│ │ Estimate / currency / assumptions / warnings    │                        │
│ └──────────────────────────────────────────────────┘                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Reject] [Request changes]                          [Approve revision R7]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Edit state

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Editing <section>                                                Revision R7 │
│                                                                              │
│ Typed fields from canonical ShootPlan schema                                 │
│ [field] [field] [field]                                                      │
│                                                                              │
│ [Cancel edit]                                            [Apply changes]     │
└──────────────────────────────────────────────────────────────────────────────┘

Apply changes
→ validate canonical schema
→ create R8 + new hash
→ return to Review
→ R7 approval can no longer be used
```

## Approved state

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ✓ Approved                                                         R8       │
│ Exact reviewed revision approved · no shoot saved by this step               │
│                                                                              │
│ [View reviewed plan]                           [Continue to downstream save] │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Reject / request-changes state

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Plan not approved                                                            │
│ Reason / requested changes                                                   │
│                                                                              │
│ Nothing has been saved to the shoot domain.                                  │
│ [Return to plan]                                      [Generate revision]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Reuse map

| Area | Decision |
|---|---|
| Current app/operator shell | REUSE |
| Current CopilotKit/AG-UI boundary | REUSE |
| Current Mastra suspend/resume primitive | REUSE pattern after installed-source proof |
| PLAN-001 canonical artifact | REUSE — sole approvable object |
| IPI-644 trusted reference visuals | REUSE when available |
| Existing iPix Button/Card/Error/loading primitives | REUSE |
| Lumina `ApprovalCard` visual hierarchy | COPY UI STRUCTURE + REWRITE DATA/WORKFLOW LOGIC |
| Lumina runtime / direct write behavior | DROP |
| Unsupported confidence scores | DROP unless PLAN-001 supplies a real value |

## Data / state contract

APPROVAL-001 must display and preserve the canonical artifact identity and current review state. Exact domain field names come from PLAN-001; this wireframe does not invent them.

Required identity/provenance available to the UI/runtime:

```text
artifact identity
revision identity
hash
assumptions
warnings
missing-input state
trusted reference IDs/provenance where present
```

States:

```text
loading
pending_review
editing
pending_review(new revision)
approved
revision_requested
rejected
cancelled
expired/stale
recoverable_error
```

Rules:

- absence of a decision is not rejection or approval;
- `approved:false` cannot be interpreted as “not resumed yet”;
- edits invalidate old approval identity;
- stale rendered revision cannot resume/save;
- duplicate/concurrent decisions converge on one authoritative outcome;
- approval contains exact reviewed revision/hash;
- this task writes no `shoot.shoots` or other application-domain shoot records.

## AI / HITL

```text
Planner produces canonical ShootPlan Rn
→ validate artifact
→ Mastra suspend with bounded review identity
→ AG-UI interrupt
→ CopilotKit controlled review UI
→ human edit / reject / request changes / approve
→ server revalidates actor + org + run + step + revision + hash
→ resume exact decision once
→ return approved artifact identity or terminal non-approved result
```

Humans decide. AI cannot self-approve.

## Responsive behavior

### 1440
- Main review + sticky/compact approval summary.
- Full section detail visible.
- Action footer remains visible without covering content.

### 1024
- Single primary column.
- Approval summary moves above/below main review.
- Visual references can use two columns.
- Action footer spans width.

### 390
- One column.
- Revision/status directly under heading.
- Context → deliverables → shots/references → budget.
- Full-width actions with Approve clearly primary and Reject separated.
- No hover-only information.
- Edit uses inline/full-screen sheet.
- Sticky actions never cover fields/errors.

## Accessibility

- Status not color-only.
- Revision identity is readable text.
- Every edit input is labelled.
- Error summary focuses/links invalid fields.
- Approve and Reject have distinct names.
- Reject is not triggered by Enter in an edit field.
- New revision and approval result are announced.
- Keyboard-only Edit → Apply → Approve works.

## Acceptance criteria

- [ ] PLAN-001 canonical artifact is the only approvable object.
- [ ] Exact current revision and material assumptions/warnings are visible.
- [ ] Edit creates a new revision/hash and invalidates old approval.
- [ ] Approve binds the exact rendered revision/hash.
- [ ] Reject/request changes/cancel/close are explicit non-approved states.
- [ ] Missing/false/malformed decision cannot count as approval.
- [ ] Stale approval fails closed and requires review of the current revision.
- [ ] Duplicate/concurrent decisions cannot produce two authoritative outcomes.
- [ ] Unauthorized/cross-org decisions fail closed without protected-data leakage.
- [ ] APPROVAL-001 performs zero shoot-domain writes.
- [ ] Approved identity is consumable by SHOOT-SAVE-001 without recomputing the plan.
- [ ] 1440 / 1024 / 390 layouts are usable and keyboard accessible.

## Deterministic Playwright scenarios

1. **Edit + approve:** R7 → edit → R8 → approve R8 → approved confirmation names R8 → zero shoot write.
2. **Reject:** pending R7 → Reject → explicit rejected state → zero save unlock/write.
3. **Request changes:** explicit revision-requested state → no write.
4. **Stale:** render R7 → authoritative revision changes to R8 → approving R7 fails closed → reload/review R8.
5. **Duplicate/race:** double approve or approve-vs-reject → one authoritative result; second call deterministic conflict/already-decided.
6. **Network retry:** lost response reconciles by stable run/revision identity; no double resume.
7. **Responsive:** 1440 / 1024 / 390 no clipped actions, hidden status, horizontal dependency or footer overlap.
8. **Tenant:** Org B/tampered identity cannot read/decide Org A artifact or resume its run.

## Blockers

- `IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan` is not Done/current.
- Exact current application `useInterrupt` contract must be proven from installed source/types when implementation begins.

## Faster/better approach

Finish PLAN-001 first, then add the smallest controlled ShootPlan review component and explicit decision state on the current Mastra suspend → AG-UI interrupt → CopilotKit `useInterrupt` path. Do not create a standalone approval route, duplicate ShootPlan schema, second workflow, or persistence path.
