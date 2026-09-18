Yes. After reviewing the **live Linear MIGRATEv2 set, the launch dependencies, ONBOARD-001, and the actual Lumina `app/` source**, the plan should be **reuse-first across almost every task**—but the reuse level differs sharply.

The key rule is:

> **Reuse Lumina product behavior, React components, schemas, pure business logic, fixtures, and tests. Adapt them to current ipixai V2 auth/org/data/runtime contracts. Do not port obsolete Cloudflare, service-role, old CopilotKit/Mastra runtime, legacy HITL, or unsafe write paths.**

Lumina really does contain the major reusable component families: `analytics`, `assets`, `booking`, `brand-hub`, `command-center`, `crm`, `matching`, `notifications`, `onboarding`, approval primitives, and more.

## Correct overall order

There should **not** be one giant serial queue. Executable checklist: [`tasks/todo.md`](./tasks/todo.md) (implementation order).

```text
GATES (certify — do not rebuild)
APP-001 (merged shell) → Done
STREAM-001 → Done
Next.js ≥16.3.3 → separate security task

LANE A · FIRST USER / PUBLIC (∥ dashboard)
MARKETING-NAV ∥ MARKETING-LOGIN → ONBOARD
SERVICES → (Planner off `/`) → MARKETING-HOME → MEDIA → SEO

LANE B · DASHBOARD FIRST (after APP certify; do not wait for marketing or Brand/Shoot UI)
DASH-MAIN-001 (/app Command Center)   ← START HERE
 ↓
BRAND → SHOOT
 ↓
Intelligence Rail
 ↓
ASSETS → CRM → OPERATIONS → TALENT
 ↓
PLANS → ANALYTICS

AI (after STREAM; ∥ dashboard if capacity)
PLANNER → TOOL
BRAND-INTEL after Brand UI (APP+AUTH hard only)

M3 LAUNCH
BRAND + SHOOT + PLANNER + TOOL
 ↓
PLAN → APPROVAL → SHOOT-SAVE → SHOOT-WIZARD → PLANNER-CONTEXT
```

**Route ownership:** public `/` = **MARKETING-HOME-001**; authenticated `/app` = **DASH-MAIN-001**. Do not rename `/app` to `/dashboard`.

**DASH-MAIN-001 does not hard-depend on BRAND-001 or SHOOT-001 UI** — it reads `public.brands`, `shoot.shoots`, and planner tables via trusted org directly. Brand/Shoot UI after Dashboard is a product sequencing choice (full workspaces next), not a technical gate.

**BRAND-INTEL** is a parallel capability after APP/AUTH, preferably once the Brand surface exists. It does **not** block the initial dashboard migration or PLAN-001.

Marketing pages are **not** a prerequisite for Dashboard Main.

---

# Full task order + Lumina reuse map

| Order / lane   | Task                                                                                                                 | Lumina reuse                                                                                            | Adapt level                    | What NOT to port                                                            | Why here                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Gate A**     | **IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App**                                 | Shell already merged on `main` (PR #43) — **certify only**                                              | Done/verify                    | redesign / duplicate shell                                                  | Hard gate for dashboard pages; not an implementation rewrite |
| **Gate B**     | **IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely**                             | No product port needed                                                                                  | certify current V2             | legacy streaming/runtime                                                    | Hard gate for PLANNER only                               |
| **0A**         | **IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup**         | old login/signup UX                                                                                     | **Strong UI reuse**            | old auth plumbing                                                           | Hard blocker for ONBOARD                                 |
| **0B**         | **IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace** | onboarding route/components/state machine + existing session/materialization concepts                   | **Very strong**                | loose browser inserts, second onboarding backend, AI-first path             | First-user journey; independent of dashboard build       |
| **1**          | **IPI-1066 · DASH-MAIN-001 — Reuse the Proven iPix Command Center as the Main Dashboard Page**                       | `command-center/*` presentation + pure helpers — **not** wholesale `queries.ts`                         | **Very strong UI**             | `user_id` tenancy, BrandSync mutation, `?skip=` fixtures, Dashboard AI      | **FIRST product screen** after APP; reads Brand/Shoot truth directly |
| **2**          | **IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles**                              | `brand-hub/*`, old brand routes/tests                                                                   | **Very strong**                | draft/crawl/restart/Brand Intel runtime                                     | Primary business context; data contract first            |
| **3**          | **IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records**                               | shoot list/card/detail/tabs/tests                                                                       | **Strong**                     | wizard, HITL, active-brand mutation, agent context                          | Core production record; detail direct-query first        |
| **4A**         | **IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records**                                     | `assets/*`                                                                                              | **Strong**                     | upload/approval/delivery runtime                                            | Natural extension of Shoot                               |
| **4B**         | **IPI-1070 · CRM-001 — Bring the Proven iPix CRM Workspace Into the New App**                                        | `crm/*`, companies/contacts/pipeline/detail                                                             | **Very strong**                | fake AI scores, CRM AI                                                      | Self-contained deterministic port                        |
| **4C**         | **IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App**                  | notifications/inbox                                                                                     | **Very strong**                | campaigns, AI triage, Worker dispatcher                                     | Cheap operational value                                  |
| **4D**         | **IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings**                                    | `matching/*`, `booking/*`                                                                               | **Strong, more adaptation**    | Booking AI, fake matching tabs, new booking model                           | Crosses more routes/contracts                            |
| **5A**         | **IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans**                          | old planner hub/timeline/kanban/calendar/list                                                           | **Strong**                     | conversational Planner, incomplete mutations                                | Saved-plan workspace after operator spine                |
| **5B**         | **IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics**          | `analytics/*`, charts/layout/tests                                                                      | **Strong UI reuse**            | fake CTR/conversions, AI explanations                                       | Honest downstream read surface                           |
| **AI-1**       | **IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant**                                  | Planner role/instructions/production vocabulary/guardrails/tests                                        | **Very strong behavior reuse** | old runtime/storage/router/multi-agent/HITL                                 | Starts after STREAM                                      |
| **AI-2**       | **IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely**               | `recommendShootType`, `planDeliverables`, `generateShotListDraft`, `estimateShootBudget`, schemas/tests | **Extremely strong**           | save tools, network, DB writes, service-role wrappers                       | After canonical Planner                                  |
| **Capability** | **IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile**                             | brand-intelligence agent + tools + workflow + citations + tests                                         | **Very strong domain reuse**   | old CF orchestration, silent approved writes, old HITL                      | Parallel after APP/AUTH; preferably Brand UI exists      |
| **M3-1**       | **IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan**                                   | old shoot workflow schemas, tool outputs, fixtures/tests                                                | **Partial/composition**        | entire workflow runtime, duplicate schemas                                  | Requires Brand + Shoot + Planner + Tool                  |
| **M3-2**       | **IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved**       | approval cards/chrome/fixtures/tests                                                                    | **UX/tests only**              | old resume endpoints, HITL shims, writes                                    | Requires canonical ShootPlan                             |
| **M3-3**       | **IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization**                       | commit input/serialization patterns + auth tests                                                        | **Behavior reference only**    | old RPC as-is, caller-supplied creator, service-role architecture           | Requires approved exact plan                             |
| **M3-4**       | **IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot**                   | wizard page/layout/stepper/CSS/HITL visuals/E2E ideas                                                   | **Strong UI reuse**            | old Mastra `shoot-wizard` workflow, resume routes, duplicate business logic | Thin orchestration after PLAN/APPROVAL/SAVE exist        |
| **M3-5**       | **IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning**                 | `currentPageContext.ts` trust model/tests + wizard/detail context ideas                                 | **Strong contract reuse**      | old route maps/browser authority/compat wrappers                            | Reuse wizard/shared-state context; no new context system |

---

# Important findings by task

## ONBOARD-001 should be much more reuse-oriented

This is stronger than the earlier plan suggested.

Lumina contains a completed standalone onboarding implementation with a deterministic state machine, and its history documents the `onboarding_sessions` + idempotent `materialize_onboarding_session` approach.

Live Linear now says the backend problem is essentially already solved:

- `onboarding_sessions`
    
- resumable state
    
- idempotency key
    
- atomic `materialize_onboarding_session(...)`
    
- automatic owner membership trigger
    
- RLS
    

The task should therefore be:

```text
reuse old onboarding UX/state ideas
+
reuse current live atomic DB contract
+
adapt routing/auth to current ipixai
```

not:

```text
invent new onboarding
```

Its current only hard blocker is **IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup**.

**Reuse score: 95/100.**

---

# Dashboard lane

## DASH-MAIN → BRAND → SHOOT is the best solo order

Waiting for Brand/Shoot UI before Dashboard was a **soft optimization, not a technical dependency**. Dashboard Main can safely go first:

```text
DASH-MAIN-001 (/app)
 ↓
BRAND
 ↓
SHOOT
 ↓
Intelligence Rail
```

**Why Dashboard can go first:** it does not need BRAND-001 or SHOOT-001 workspaces. It reads canonical truth under the trusted active org (`public.brands`, `shoot.shoots`, planner tables, verified approval source) and links into placeholder or full routes as they ship.

Public marketing homepage remains a separate task (**MARKETING-HOME-001**).

Default method: **trusted-org server loaders + cross-org proof before Lumina UI**. Dashboard tasks remain primarily **COPY+CLEAN React migrations**, not AI work.

### Wave B should be parallel

I would **not** enforce:

```text
Assets → Talent → CRM → Operations
```

as hard serialization.

Use:

```text
ASSETS ∥ CRM ∥ OPERATIONS ∥ TALENT
```

If one developer must serialize them, my order would be:

1. Assets
    
2. CRM
    
3. Operations
    
4. Talent
    

because Talent/Booking has the largest adaptation surface.

---

# PLANS vs ANALYTICS

I would slightly change the earlier flat list.

Use:

```text
PLANS ∥ ANALYTICS
```

rather than treating one as a dependency of the other.

If forced to choose:

> **PLANS before ANALYTICS.**

Why: saved production planning is closer to the core Brand → Shoot → Production journey. Analytics is valuable but deeper real measurement belongs later.

Both remain M2 UI migrations.

---

# Planner/tool lane

## PLANNER-001

Strong adaptation.

The old agent already contains production-specific sequencing and guardrails. The V2 task should extract those business instructions into the current secure agent, while retaining the current `ipixai` auth, memory, Postgres, CopilotKit and AG-UI runtime.

**Reuse score: 85/100 product behavior, near 0% runtime reuse.**

## TOOL-001

This is probably the strongest code reuse opportunity.

Lumina already has real typed tools such as `recommendShootType`, and the existing registry/documents explicitly identify the shoot-planning tool spine.

Use:

```text
existing pure function/business logic
→ verify current schema
→ adapt Mastra wrapper
→ port tests
```

Do not rewrite equivalent calculators.

**Reuse score: 90–95/100.**

---

# PLAN → APPROVAL → SAVE → WIZARD

This order is now correct and explicitly represented in Linear.

## PLAN-001

Hard blockers are:

- **IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles**
    
- **IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records**
    
- **IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant**
    
- **IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely**
    

Then it creates **one canonical `ShootPlanSchema`**.

Lumina is input/reference, not the final schema authority.

**Reuse score: 65–75/100.**

---

## APPROVAL-001

Linear is now very clear:

> Lumina = **UX/test reference only**.

Reuse:

- approval card layout;
    
- Deliverables review;
    
- Shot List review;
    
- Budget review;
    
- edit/approve/reject UX;
    
- accessibility and duplicate-click tests.
    

Do not reuse:

- `/api/workflows/resume`;
    
- custom runner;
    
- old interrupt hacks;
    
- old Worker/DurableAgent;
    
- direct writes.
    

The current required path remains current Mastra suspend → AG-UI interrupt → CopilotKit `useInterrupt`.

**Reuse score: UI 85/100; runtime 0/100.**

---

## SHOOT-SAVE-001 is a special case

This should **not** be described as “reuse the old commit implementation.”

Live Linear has now corrected that.

The existing legacy/hosted commit contract is unsafe for V2 because it:

- trusts caller-supplied `p_created_by`;
    
- is service-role oriented;
    
- lacks DB-backed idempotency;
    
- always inserts a new shoot.
    

So reuse only:

- input/serialization shape;
    
- deliverables/shot insertion pattern;
    
- authorization test concepts;
    
- previous defense-in-depth rules.
    

Then build the **smallest new V2-safe atomic/idempotent commit contract**.

**Reuse score: 35–45/100 implementation; 75/100 behavioral knowledge.**

This is the biggest exception to “copy old iPix.”

---

## SHOOT-WIZARD-001

This should be:

> **COPY+CLEAN the old wizard UI; do not port the old wizard engine.**

Lumina has an actual `/app/shoots/new/page.tsx`, wizard context, styling and approval-card integration.

Linear now explicitly says:

```text
deterministic form stages
→ PLAN-001
→ APPROVAL-001
→ SHOOT-SAVE-001
→ Continue to Booking
```

and specifically says **do not port the legacy Mastra shoot-wizard workflow wholesale**.

Reuse:

- page shell;
    
- vertical rail/mobile stepper;
    
- wizard CSS;
    
- form/stage UX;
    
- E2E journey cases.
    

Drop:

- old workflow;
    
- old resume APIs;
    
- duplicate calculations;
    
- workflow-run IDs;
    
- direct commit path.
    

**Reuse score: UI 90/100; workflow 0–20/100.**

---

# PLANNER-CONTEXT-001

Lumina already has exactly the right conceptual trust boundary.

Its `currentPageContext.ts` documents UI `useAgentContext` inputs feeding the agent while the current-page context layer resolves trusted context.

The old repo also contains shoot detail/wizard context patterns.

So reuse:

```text
browser sends ID hint
→ server authenticates
→ server verifies entity in trusted org
→ only verified data reaches Planner
```

Do **not** blindly port the old tool if current CopilotKit context can do this more simply.

### One remaining Linear issue

Current live relations still show PLANNER-CONTEXT blocked by both:

- SHOOT-WIZARD
    
- SHOOT-SAVE
    

even though the issue's own description says WIZARD is the real build dependency.

Because:

```text
SHOOT-SAVE → WIZARD → CONTEXT
```

the direct SAVE → CONTEXT edge is redundant.

I would still remove it for dependency hygiene.

---

# BRAND-INTEL-001

This absolutely belongs in the reuse audit even though it is not in the current 17-item MIGRATEv2 label result.

Lumina already has:

- Brand Intelligence Agent;
    
- Brand Intelligence tools;
    
- workflow;
    
- tests;
    
- evidence/citation behavior.
    

Linear explicitly requires mining those files before coding.

But V2 must change the approval architecture:

```text
Brand URL
→ evidence
→ draft
→ human review
→ atomic approval
→ brands.ai_profile + brand_scores
```

No model/crawler callback should silently promote approved Brand Brain truth.

**Reuse score: 80–90/100 domain logic; much lower for infrastructure.**

---

# Final recommended roadmap

## Now — close gates + start Dashboard first

```text
APP-001 hosted certification → Done   (do not redesign shell)
STREAM-001 certification → Done

START: DASH-MAIN-001
  ↓
BRAND-001 → SHOOT-001 → Rail → Wave B…

∥ MARKETING-LOGIN → ONBOARD   (independent lane; not a Dashboard gate)
∥ PLANNER-001 after STREAM    (AI lane)
```

Onboarding can run as its own M1 lane. Dashboard does **not** wait for marketing pages or Brand/Shoot UI.

---

## M2 Wave A — Dashboard first + Planner

```text
DASH-MAIN-001   (/app Command Center)  ← first product screen
BRAND-001
SHOOT-001
PLANNER-001     (AI lane; after STREAM; can ∥ Brand/Shoot)
```

Dashboard Main is the first visible operator experience. Brand + Shoot follow as full workspaces.

Planner is a separate AI lane.

---

## M2 Wave B

```text
ASSETS-001
CRM-001
OPERATIONS-001
TALENT-BOOKING-001
```

Parallel where capacity permits.

At the same time:

```text
PLANNER-001
    ↓
TOOL-001

BRAND-001
    ↓
BRAND-INTEL-001
```

---

## M2 Wave C

```text
PLANS-001 ∥ ANALYTICS-001
```

Neither should block the core production launch chain.

---

## M3 core launch chain

```text
BRAND-001 ─────┐
SHOOT-001 ─────┤
PLANNER-001 ───┼→ PLAN-001
TOOL-001 ──────┘
                   ↓
              APPROVAL-001
                   ↓
              SHOOT-SAVE-001
                   ↓
              SHOOT-WIZARD-001
                   ↓
            PLANNER-CONTEXT-001
```

That matches current task ownership much better than porting the old monolithic shoot workflow.

# Reuse classification summary

|Category|Tasks|
|---|---|
|**COPY+CLEAN heavily**|HOME, BRAND, SHOOT, ASSETS, CRM, OPERATIONS, TALENT, PLANS, ANALYTICS, ONBOARD|
|**Adapt domain behavior heavily**|PLANNER, TOOL, BRAND-INTEL|
|**Reuse schemas/tests; compose new V2 contract**|PLAN|
|**Reuse UX/tests only**|APPROVAL|
|**Reuse behavior/security lessons, rewrite implementation**|SHOOT-SAVE|
|**Reuse UI shell, reject old workflow**|SHOOT-WIZARD|
|**Reuse trust contract, simplify implementation if possible**|PLANNER-CONTEXT|

## Score

|Area|Score|
|---|--:|
|Lumina reuse opportunity|**96/100**|
|Dashboard migration strategy|**100/100**|
|Planner/tool reuse strategy|**99/100**|
|M3 ownership separation|**98/100**|
|Onboarding reuse|**97/100**|
|Current dependency hygiene|**94/100**|
|**Overall plan**|**98/100**|

**Faster/better approach:** before every migration task, require a tiny four-column audit:

```text
Lumina source
→ proven value
→ COPY / ADAPT / DROP
→ current V2 source of truth
```

That should be mandatory before new code. It will prevent agents from rebuilding features that already exist.

### Summary:

- **Best decision:** use Lumina as the primary reuse source for the full migration set.
    
- **Why:** most UI, production planning logic, onboarding, tool logic, approval UX, context patterns, and Brand Intelligence behavior already exist.
    
- **Next action:** execute **BRAND ∥ SHOOT ∥ HOME ∥ PLANNER** after their respective APP/STREAM gates, while **MARKETING-LOGIN → ONBOARD** runs independently; then move through the M3 chain **PLAN → APPROVAL → SAVE → WIZARD → CONTEXT**.