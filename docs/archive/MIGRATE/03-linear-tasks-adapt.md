Yes. The deeper Lumina audit suggests **one new V2 migration task**, several **existing tasks that should be strengthened**, and **no major change to the critical dependency order**.

## Recommended Linear changes

| Action     | Linear task                                                                                                          | What to adapt from old Lumina                                                                                   | Priority |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------: |
| **CREATE** | **New · INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace**           | `components/intelligence-panel/*`, route briefing, DNA scores, activity, approvals, AI context, evidence dialog | **High** |
| **UPDATE** | **IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles**                              | `brand-hub/*` **plus** `lib/brand-hub*`, filters, greetings, tests                                              |     High |
| **UPDATE** | **IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records**                               | shoot components **plus** pure shoot helpers/tests                                                              |     High |
| **UPDATE** | **IPI-1066 · HOME-001 — Reuse the Proven iPix Command Center in the New App**                                        | `command-center/*` **plus underlying query/model/helpers**, empty/error/loading states                          |     High |
| **UPDATE** | **IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records**                                     | `components/assets/*` + `lib/assets/*`                                                                          |     High |
| **UPDATE** | **IPI-1070 · CRM-001 — Bring the Proven iPix CRM Workspace Into the New App**                                        | `components/crm/*` + CRM helpers/tests; no old CRM agent yet                                                    |     High |
| **UPDATE** | **IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings**                                    | `matching/*`, `booking/*`, `lib/booking/*`, EvidenceBlock match explanations                                    |     High |
| **UPDATE** | **IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App**                  | notifications/inbox components + deterministic helpers                                                          |     High |
| **UPDATE** | **IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics**          | `components/analytics/*` + **`lib/analytics.ts` + tests**                                                       |     High |
| **UPDATE** | **IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans**                          | planner workspace UI + deterministic plan display helpers                                                       |     High |
| **UPDATE** | **IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant**                                  | Planner prompt, vocabulary, sequence, guardrails, tests                                                         |     High |
| **UPDATE** | **IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely**               | proven Mastra tools and pure business rules/tests                                                               |     High |
| **UPDATE** | **IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning**                 | `currentPageContext`, shoot/brand/CRM context patterns                                                          |   Medium |
| **UPDATE** | **IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan**                                   | schemas, fixtures, workflow test cases → one V2 schema                                                          |     High |
| **UPDATE** | **IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved**       | generic `approval-card/*` + shoot approval cards/tests                                                          |     High |
| **UPDATE** | **IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile**                             | Brand Intelligence agent/tools/workflow/evidence/tests                                                          |     High |
| **UPDATE** | **IPI-172 · AI-EVIDENCE-001 — Persist Provider-Neutral Evidence and Citations for iPix AI Decisions**                | make old `EvidenceBlock` the V2 presentation reference                                                          |     High |
| **UPDATE** | **IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup**         | old auth/login UI, not auth implementation                                                                      |     High |
| **UPDATE** | **IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace** | full old onboarding UX/state machine/tests + current V2 atomic DB path                                          |     High |

### Do **not** create separate tasks for

I would **not** create `LIB-MIGRATION`, `EVIDENCE-UI`, `APPROVAL-COMPONENT`, `ERROR-PAGES`, or `STYLE-MIGRATION` tasks.

Those are implementation details of existing tasks. Creating separate tickets would add dependencies without delivering independent user value.

The exception is **Intelligence Rail**, because it is a real cross-page product surface with no clean current V2 executable owner.

---

# New task I recommend

**Suggested title:**

**`INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace`**

### Purpose

Reuse the proven Lumina Intelligence Panel inside the APP-001 right rail so operators see useful Brand/Shoot context, evidence, attention items, and approvals without creating another AI agent.

### Reuse

```text
components/intelligence-panel/*
components/evidence-block/*
route-briefing.ts
AIContextCard
DNA scores
recent activity
approvals section
health/context sections
```

The old implementation already exposes these pieces as reusable components rather than one monolithic page.

### Adapt

```text
old route-derived context
→ current trusted APP/AUTH org context

old panel contracts
→ current Brand/Shoot/Asset data

old AI suggestions
→ only real supported V2 signals
```

### Drop

- old data APIs
    
- old AI runtime
    
- fake suggestions
    
- browser-trusted tenant IDs
    
- old write actions
    
- separate chat runtime
    

### Scope lock

First version is **read/display-first**.

The AI drafts or explains; operators decide. No autonomous domain mutations.

---

# Does this change the task order?

**Only slightly.**

The core sequence remains correct:

```text
APP
├── BRAND
├── SHOOT
└── HOME

STREAM
└── PLANNER
    └── TOOL
```

Then:

```text
BRAND + SHOOT + PLANNER + TOOL
               ↓
             PLAN
               ↓
           APPROVAL
               ↓
          SHOOT-SAVE
               ↓
         SHOOT-WIZARD
               ↓
       PLANNER-CONTEXT
```

The new Intelligence Rail does **not** belong before Brand/Shoot.

It becomes useful once those domains provide real data.

---

# Revised recommended execution order

## Gate / independent lane

|Order|Task|
|--:|---|
|A|**IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App** → certify Done|
|B|**IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely** → certify Done|
|C1|**IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup**|
|C2|**IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace**|

Login → Onboarding remains an independent first-user lane.

---

## M2 · Wave A

For capacity-limited execution:

|Order|Task|Why|
|--:|---|---|
|**1**|**IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles**|foundational business context|
|**2**|**IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records**|production context|
|**3**|**IPI-1066 · HOME-001 — Reuse the Proven iPix Command Center in the New App**|now has useful Brand/Shoot data|
|**4**|**New · INTELLIGENCE-RAIL-001**|can now render real route/Brand/Shoot context|

But with several developers, these can overlap:

```text
BRAND ∥ SHOOT ∥ HOME
             ↓
     INTELLIGENCE-RAIL
```

HOME does **not** technically require BRAND/SHOOT UI implementation; this remains product-priority ordering, not fake Linear blockers.

---

## Parallel AI lane

```text
STREAM Done
   ↓
IPI-1048 · PLANNER-001
   ↓
IPI-1049 · TOOL-001
```

At roughly the same time after Brand exists:

```text
BRAND
  ↓
IPI-1093 · BRAND-INTEL-001
  ↓
IPI-1128 · BRAND-KNOWLEDGE-001
```

`AI-EVIDENCE-001` can support this lane but should not unnecessarily serialize simple Brand UI work.

---

## M2 · Wave B

These remain mostly parallel:

|Soft order|Task|
|--:|---|
|5|**IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records**|
|6|**IPI-1070 · CRM-001 — Bring the Proven iPix CRM Workspace Into the New App**|
|7|**IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App**|
|8|**IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings**|

I put Talent last only because it has the greatest adaptation complexity.

Technically:

```text
ASSETS ∥ CRM ∥ OPERATIONS ∥ TALENT
```

is correct.

---

## M2 · Wave C

```text
IPI-1074 · PLANS-001
        ∥
IPI-1073 · ANALYTICS-001
```

If one developer:

**PLANS → ANALYTICS**.

---

# M3 remains unchanged

The deeper Lumina analysis actually **strengthens** this sequence rather than changing it:

|Order|Task|Lumina strategy|
|--:|---|---|
|1|**IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan**|schemas/tests/fixtures → new canonical schema|
|2|**IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved**|reuse UI/tests only|
|3|**IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization**|reuse business shape; rewrite unsafe commit contract|
|4|**IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot**|reuse wizard UI; reject old workflow|
|5|**IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning**|reuse context trust patterns|

No reason to move SHOOT-WIZARD earlier.

The old Lumina wizard bundled responsibilities that V2 deliberately separates. Current Linear already reflects the cleaner ownership model.

---

# Recommended reuse requirement for every migration issue

I would add this block to each applicable task:

> **Lumina reuse audit required before implementation**
> 
> Inspect the corresponding old:
> 
> - route/page
>     
> - components
>     
> - `lib` domain helpers
>     
> - schemas/types
>     
> - focused unit tests
>     
> - E2E fixtures
>     
> - loading/empty/error states
>     
> 
> Classify every relevant piece as **COPY / ADAPT / DROP**.
> 
> Current ipixai auth, trusted-org model, Supabase schema, Mastra/CopilotKit runtime, and current design tokens remain authoritative.

That is more useful than creating extra infrastructure tasks.

## Faster/better approach:

**Do not expand the roadmap horizontally just because Lumina contains more files.**

Use:

```text
existing V2 task
→ deeper Lumina audit
→ port proven UI + pure logic + tests
→ replace old plumbing
```

Create a new task only when the old capability represents a **distinct user-facing outcome with no V2 owner**.

Right now, **Intelligence Rail is the strongest such gap**.

## Recommended final structure

```text
NOW
APP cert
STREAM cert
MARKETING-LOGIN → ONBOARD

NEXT
BRAND ∥ SHOOT ∥ HOME ∥ PLANNER
             ↓         ↓
     INTELLIGENCE     TOOL
          ↓
ASSETS ∥ CRM ∥ OPS ∥ TALENT
          ↓
PLANS ∥ ANALYTICS

Parallel:
BRAND → BRAND-INTEL → BRAND-KNOWLEDGE

THEN
BRAND + SHOOT + PLANNER + TOOL
               ↓
              PLAN
               ↓
           APPROVAL
               ↓
             SAVE
               ↓
            WIZARD
               ↓
            CONTEXT
```

### Summary:

- **Best decision:** create **one new Intelligence Rail migration task**; strengthen existing tasks to reuse Lumina `lib`, tests, EvidenceBlock, approval primitives, context patterns, and error states.
    
- **Why:** those are significant reusable assets, but most do not justify separate Linear deliverables.
    
- **Next action:** the overall order changes only by inserting **INTELLIGENCE-RAIL after/alongside the first Brand/Shoot/Home wave**; the critical **PLAN → APPROVAL → SAVE → WIZARD → CONTEXT** chain stays unchanged.