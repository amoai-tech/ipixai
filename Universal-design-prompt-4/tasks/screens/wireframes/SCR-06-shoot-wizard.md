# SCR-06 wireframe — Shoot Wizard

> **Current V2 truth first.** `/app/shoots/new` is not implemented on current `main` as of 2026-09-13. This wireframe is the implementation contract for `IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot`.
>
> **Execution contract:** https://linear.app/amo100/document/ipi-1085-shoot-wizard-001-implementation-ready-wireframe-1af361bf203c
>
> **Visual reference:** [`Shoot Wizard.v2.image-first.dc.html`](../../../Pages/Shoot%20Wizard.v2.image-first.dc.html) remains presentation reference only. Current repo/data/security contracts win.

## Goal

One authenticated operator completes six phases:

```text
Goal
→ Products + Channels
→ Creative Direction
→ Deliverables
→ Visual Shot Plan
→ Budget + Approval
→ exact approved revision saves once
→ Open Shoot / Booking handoff
```

No wizard navigation, AI generation, rejection, cancellation, or retry may create a durable shoot.

## Current-state correction

| Area | Current truth |
|---|---|
| Route | `/app/shoots` exists; `/app/shoots/new` does not |
| Shell/auth | Reuse current server-side app-shell + runtime-org patterns |
| Planner | Current `production-planner` + TOOL-001 exist |
| Canonical ShootPlan | Owned by `IPI-1081 · PLAN-001`; not yet current/Done |
| Products | Owned by `IPI-1165 · PRODUCTS-001`; Backlog |
| Visual references | `shoot.shot_type_references`; browser/replace UI owned by `IPI-644` |
| Approval | Owned by `IPI-1084 · APPROVAL-001`; Backlog |
| Save | Owned by `IPI-1083 · SHOOT-SAVE-001`; Backlog |

**Implementation status:** design-ready, implementation BLOCKED until the owner contracts above are current.

## Desktop — 1440

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Shoots      New Shoot                          Step 4 of 6      Draft only │
│ Goal ─ Products ─ Creative ─ Deliverables ─ Visual Plan ─ Budget/Approval   │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ STICKY SUMMARY       │ CURRENT STEP WORKSPACE                                │
│                      │                                                       │
│ Brand                │  Deliverables                                         │
│ [verified context]   │  ┌─────────────────────────────────────────────────┐  │
│                      │  │ Instagram Feed        8     confirmed/assumed   │  │
│ Products             │  │ Shopify PDP          12     confirmed           │  │
│ 3 selected           │  │ Story / Reel          6     needs_input         │  │
│                      │  └─────────────────────────────────────────────────┘  │
│ Channels             │                                                       │
│ IG · Shopify         │  Assumptions / warnings / missing inputs              │
│                      │  are always visible                                   │
│ Direction            │                                                       │
│ “Clean studio…”      │                                                       │
│                      │                                                       │
│ Plan                 │                                                       │
│ Deliverables         │                                                       │
│ Shots                │                                                       │
│ Budget               │                                                       │
│                      │                                                       │
│ Status               │                                                       │
│ Draft — not saved    │                                                       │
├──────────────────────┴───────────────────────────────────────────────────────┤
│ [Back]                                                [Continue / Review →] │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Phase 5 — Visual Shot Plan

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Visual Shot Plan                                                    │
│ Canonical shots · trusted references only                           │
│                                                                     │
│ ┌─────────────────────┐ ┌─────────────────────┐                    │
│ │ Reference preview   │ │ Reference preview   │                    │
│ │ Full body front     │ │ Detail / texture    │                    │
│ │ Product: Dress A    │ │ Product: Dress A    │                    │
│ │ Channel: PDP + IG   │ │ Channel: PDP        │                    │
│ │ trusted referenceId │ │ trusted referenceId │                    │
│ │ Keep Replace Edit   │ │ Keep Replace Edit   │                    │
│ └─────────────────────┘ └─────────────────────┘                    │
│                                                                     │
│ No trusted match → explicit “No reference available”                │
└─────────────────────────────────────────────────────────────────────┘
```

## Phase 6 — Budget + Approval

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Final Review                                                         │
│ Exact plan revision/hash supplied by APPROVAL-001                    │
│                                                                      │
│ Goal / Products / Channels / Direction                               │
│ Deliverables                                                         │
│ Shot plan + trusted references                                       │
│ Budget + assumptions + warnings                                      │
│                                                                      │
│ [Edit section]                                                       │
│                                                                      │
│ [Reject] [Request revision]                     [Approve exact plan] │
│                                                                      │
│ After explicit approval only: [Save Shoot]                           │
└──────────────────────────────────────────────────────────────────────┘
```

## Component reuse

| Need | Decision |
|---|---|
| Authenticated app entry + trusted org | **REUSE** current app-shell/runtime-org server pattern |
| Shared error UI | **REUSE** current `ErrorState` |
| Post-save read/navigation | **REUSE** current `/app/shoots/:shootId` conventions |
| Stepper / wizard client shell | **CREATE** only if still absent when blockers clear; copy-clean Lumina presentation only |
| Products | **REUSE** `IPI-1165 · PRODUCTS-001` |
| Deliverables / shots / budget | **REUSE** canonical `IPI-1081 · PLAN-001` artifact |
| Visual reference browser | **REUSE** `IPI-644 · SHOOT-DATA-002C` |
| Exact review / approval | **REUSE** `IPI-1084 · APPROVAL-001` |
| Durable save | **REUSE** `IPI-1083 · SHOOT-SAVE-001` |
| Legacy Lumina shoot workflow | **DROP** — duplicate planning/HITL/save authority |

## Important states

```text
loading
ready
needs_input
validation_error
tool_error
reviewing
revision_requested
rejected
approved_not_saved
saving
saved
save_conflict
unauthorized
```

There is no state where “AI finished” means “shoot saved.”

## AI / HITL

```text
trusted server context + operator input
→ production-planner proposes one canonical ShootPlan revision
→ UI renders that exact artifact
→ operator edits / rejects / requests revision
→ material edit creates a new revision/hash
→ operator approves exact rendered revision/hash
→ server revalidates actor/org/approval
→ SHOOT-SAVE-001 commits once
→ UI reads back one shoot ID
```

Rules:

- reject/cancel/stale/timeout = zero shoot writes;
- approval becomes invalid after a material edit;
- browser org/product/plan values are not authority;
- duplicate save/retry/concurrent submit cannot create a second shoot.

## Responsive

### 1440
- Full six-step indicator.
- Sticky ~250–280px summary rail.
- Main workspace fills remaining width.
- Reference grid 2–3 columns.

### 1024
- Summary becomes compact top summary / drawer.
- Full-width step workspace.
- Reference grid 2 columns.

### 390
- `Step N of 6` + current title in header.
- No permanent summary rail; use expandable summary sheet/accordion.
- Single-column forms/reference cards.
- Review sections become stacked accordions.
- Sticky actions must not cover validation/error content.
- No horizontal page scroll.

## Acceptance criteria

- [ ] Six phases only: Goal → Products + Channels → Creative Direction → Deliverables → Visual Shot Plan → Budget + Approval.
- [ ] Navigation alone performs no durable write.
- [ ] Exact trusted products/variants come from PRODUCTS-001.
- [ ] Deliverables/shots/budget render PLAN-001; no wizard recomputation.
- [ ] Visual references use stable trusted IDs; empty state never fabricates a reference.
- [ ] Assumptions/warnings/`needs_input` remain visible.
- [ ] Operator can edit/reject/request revision before approval.
- [ ] Approval binds the exact reviewed revision/hash.
- [ ] Reject/cancel/stale approval writes nothing.
- [ ] Approved save executes once; safe retry returns the same shoot.
- [ ] Success returns one shoot ID with Open Shoot / Booking handoff.
- [ ] 1440 / 1024 / 390 behavior is verified.
- [ ] Org B cannot use Org A product/approval/shoot identities.

## Playwright scenarios

1. Happy path: Goal → trusted product/channel → direction → plan → reference replace → exact approve → save → one shoot ID → refresh detail.
2. Reject: final review → Reject → no save unlock / no new shoot.
3. Edit after review: material edit invalidates earlier approval; new revision must be approved.
4. Tool failure: recoverable error + Retry preserves prior valid inputs and writes nothing.
5. Save retry/idempotency: double-click/retry returns the same shoot ID.
6. No trusted reference: explicit empty state, never invented reference/image.
7. Responsive: 1440 / 1024 / 390, no clipped actions or horizontal page scroll.
8. Tenant: Org A identity reused by Org B fails closed.
9. Navigation: Back/Continue preserves local draft state and never saves.

## Blockers

- `IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan`
- `IPI-1165 · PRODUCTS-001 — Let Operators Connect and Use Their Product Catalog Across iPix`
- `IPI-644 · SHOOT-DATA-002C — Visual Shot-Type Reference Browser`
- `IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved`
- `IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization`

**Faster/better approach:** finish those owner contracts first, then build only the `/app/shoots/new` route + client step state + composition UI. Do not port Lumina’s old workflow/runtime.
