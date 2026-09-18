# iPix New App Migration Strategy & Roadmap

**Repository:** https://github.com/amoai-tech/ipixai  
**Reference implementation:** https://github.com/amoai-tech/luminaai  
**Linear MIGRATEv2:** https://linear.app/amo100/view/migratev2-6e501438c58a  
**Strategy date:** 2026-09-03

---

# 1. Executive decision

The new `amoai-tech/ipixai` application is the **authoritative implementation** of iPix going forward.

`amoai-tech/luminaai` is **not** the architecture to migrate wholesale.

Use Lumina as a proven reference library for:

- operator workflows
- UI composition
- fashion-production terminology
- deterministic planning logic
- schemas
- test fixtures
- interaction patterns
- acceptance-test ideas

Do **not** copy Lumina's old runtime, tenancy, deployment, AI orchestration, persistence, or broad agent/tool architecture into the new app.

The migration rule is:

```text
current ipixai truth
→ verify source/data/security contract
→ inspect exact Lumina reference
→ COPY+CLEAN proven presentation or pure business logic
→ ADAPT to current architecture
→ DROP legacy infrastructure
→ write only the smallest remaining custom gap
```

This is faster and safer than either:

1. rebuilding everything from scratch, or
2. treating Lumina as a codebase that should simply be moved into the new application.

---

# 2. Product goal

Build iPix into a practical AI-native operating system for fashion brands covering:

```text
Brand URL
→ Brand intelligence
→ editable Brand DNA
→ human approval
→ saved Brand Brain

Campaign
→ creative brief
→ shoot plan
→ approval
→ production

Shoot
→ assets
→ Cloudinary
→ DNA analysis
→ approval
→ product linking

Approved assets
→ content
→ publishing
→ analytics
→ learning back into Brand Brain
```

The shortest MVP path is not to implement every module at once.

The priority is to make one reliable operator journey work end-to-end:

```text
Sign in
→ trusted organization
→ operator workspace
→ Brand
→ Shoot
→ Production Planner
→ structured plan
→ human approval
→ safe shoot save
→ assets
```

Everything else should expand from this foundation.

---

# 3. Architecture principles

## 3.1 System ownership

| Layer | Owner | Responsibility |
|---|---|---|
| Durable application truth | Supabase / Postgres | Brands, shoots, assets, CRM, bookings, approvals, planning records |
| Tenant protection | Supabase RLS + server auth | Organization-level isolation |
| User identity | Supabase Auth | Verified authenticated user |
| Active organization | Server-side iPix resolver | Never browser/user metadata authority |
| AI agents/tools/workflows | Mastra | Planner, tools, memory, orchestration |
| Interactive AI UI | CopilotKit + AG-UI | Streaming, chat, generative UI, interaction |
| Media bytes/transforms | Cloudinary | Images/video delivery and transformations |
| Media business metadata | Supabase | Asset ownership, brand/shoot relationships, status |
| Hosting | Vercel / Next.js | New app runtime |
| Human approval | iPix domain workflow | Consequential actions require operator review |

## 3.2 AI governance

Default principle:

> **Humans decide. AI assists.**

For consequential writes:

```text
AI proposes
→ operator reviews
→ operator edits if needed
→ operator approves
→ approved action executes
→ system records result
```

Do not allow the AI to silently:

- publish
- save a shoot
- approve assets
- spend money
- change booking state
- mutate tenant-critical records
- promote Brand DNA drafts
- perform destructive actions

---

# 4. Current new-app foundation

Current `ipixai` already has the important architectural foundation.

## Current stack

At audit time:

- Next.js `16.1.2`
- React `19.2.x`
- Mastra `1.27.2`
- `@mastra/core` `1.63.2`
- `@mastra/memory` `1.28.1`
- `@mastra/pg` `1.22.2`
- CopilotKit runtime/react-core `1.68.1`
- AG-UI client `0.0.58`
- `@ag-ui/mastra` `1.1.2`
- Supabase JS `2.112.4`
- Supabase SSR `0.12.5`
- Cloudinary `2.11.x`
- next-cloudinary `6.18.x`
- Zod `3.25.x`
- Vercel / Next.js deployment

Source:

https://github.com/amoai-tech/ipixai/blob/main/package.json

## Current operational rules

The repo already establishes:

- `origin/main` is authoritative
- installed package types beat stale docs
- Graphify before broad code reading
- one concern per PR
- no production Supabase mutations during audits
- targeted tests before broad testing
- task-verifier Quick before implementation
- task-verifier Full before Done
- `/app` and agent dev servers run separately
- tenant isolation must be proven with Org A / Org B tests

Source:

https://github.com/amoai-tech/ipixai/blob/main/AGENTS.md

---

# 5. Improvements already made in the new app

The new app is not starting from zero.

## 5.1 Authentication and tenancy

The new architecture has moved toward:

```text
verified session
→ server-derived organization membership
→ trusted active organization
→ domain query
→ RLS defense in depth
```

Important improvement:

Browser-selected `org_id` and `user_metadata` are not authorization authorities.

## 5.2 Shared operator shell

**IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App**

is Done.

The new app now has:

- one `/app/*` workspace
- centralized operator navigation
- authenticated layout
- consistent shell
- placeholders owned by downstream domain tasks

This avoids every domain shipping its own mini application.

## 5.3 Cleaner AI runtime

The new app owns:

- current Mastra versions
- current CopilotKit/AG-UI runtime
- current Postgres-backed memory
- authenticated streaming
- organization/thread isolation

Lumina's older runtime should not replace this.

## 5.4 Cloudinary separation

The new architecture treats:

```text
Cloudinary = media bytes + delivery + transforms
Supabase = media business truth
```

This is a major improvement over designs that try to use Cloudinary Search as the application database.

## 5.5 Better verification discipline

The migration process now requires:

```text
current code
→ installed source/types
→ live read-only Supabase
→ official docs
→ Lumina reference
→ smallest implementation
→ observable proof
```

This sharply reduces stale-task implementation.

---

# 6. The role of Lumina

Lumina should be treated like a working prototype and reference implementation.

Repository:

https://github.com/amoai-tech/luminaai

## What Lumina is valuable for

Lumina contains proven examples of:

- Brand Hub UX
- Command Center
- shoot workflows
- production-planning terminology
- deliverable planning
- shot-list behavior
- budget planning
- operator shell ideas
- Intelligence Panel
- CRM interfaces
- Talent / Booking interfaces
- Operations UI
- Analytics UI
- planning screens
- Brand Intelligence interactions
- tests and fixtures

## What Lumina is not

Lumina is not the new system's:

- security architecture
- tenancy authority
- deployment architecture
- package/version authority
- Mastra runtime authority
- CopilotKit runtime authority
- database ownership model
- write authorization model
- active-organization model

---

# 7. Reuse strategy: COPY / ADAPT / DROP

Every migration task should classify Lumina code into these buckets before implementation.

## COPY+CLEAN

Use nearly unchanged when it is:

- presentational
- pure
- deterministic
- tenant-neutral
- infrastructure-neutral

Examples:

- cards
- layouts
- list grids
- empty states
- filters
- display helpers
- visual patterns
- test fixtures
- deterministic calculations

## ADAPT

Use the idea/structure but modify it to current iPix.

Examples:

- route names
- server data loaders
- active-org queries
- data models
- CopilotKit integration
- Mastra `Agent` APIs
- tool registration
- Cloudinary delivery
- current Design System components

## DROP

Do not migrate when it belongs to old infrastructure.

Examples:

- Cloudflare Worker deployment assumptions
- old model routing
- old active-brand tenancy
- old service-role browser/server patterns
- duplicate auth
- duplicate database truth
- old workflow persistence
- hidden write tools
- broad shared tool registries
- fake/demo data
- stale sample-image business truth
- old `/app/brand` route assumptions
- duplicate CopilotKit context injection

## BUILD CUSTOM ONLY LAST

Custom code is justified only after proving:

```text
current ipixai doesn't already solve it
AND
vendor feature doesn't solve it
AND
official module/example doesn't solve it
AND
Lumina doesn't already contain a safe reusable core
```

---

# 8. What to reuse from Lumina

## 8.1 Operator UI

Reuse presentation from:

- Command Center
- Brand Hub
- Shoot list/detail
- Assets
- CRM
- Talent
- Operations
- Analytics
- Plans
- Intelligence Panel

But remove:

- legacy auth
- legacy active-brand tenant state
- hidden AI side effects
- demo data
- route-specific agent assumptions

## 8.2 Production Planner behavior

Primary reference:

https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/agents/index.ts

Reuse:

- fashion-production identity
- terminology
- planning sequence
- uncertainty language
- narrow domain scope
- no-silent-write philosophy
- "never invent shot angles" principle
- human approval concepts

Do not reuse:

- old model router
- old workflows
- old persistence
- old broad tool registry
- old HITL implementation
- old memory implementation
- Cloudflare-specific behavior

## 8.3 Four deterministic planning tools

Reuse/adapt the pure cores from:

### Shoot type

https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/recommendShootType.ts

### Deliverables

https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/planDeliverables.ts

### Shot list

https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/generateShotListDraft.ts

### Budget

https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/estimateShootBudget.ts

Corrections required:

- no silent ecommerce fallback when evidence is weak
- deliverable quantities are assumptions until approved
- shot references must come from trusted input
- budget rates must be inputs/assumptions, not market truth

## 8.4 Structured shoot-plan ideas

Primary legacy reference:

https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/shoot-wizard.ts

Reuse:

- field ideas
- ordering
- validation concepts
- representative fixtures
- production vocabulary

Do not reuse:

- old workflow runtime
- old suspend/resume implementation
- persistence logic
- duplicated schemas

Create one new V2 `ShootPlanSchema`.

---

# 9. What not to reuse from Lumina

## 9.1 Old operator shell wholesale

Lumina's `OperatorPanel` mixes:

- nav
- active brand state
- route-to-agent routing
- CopilotKit context
- frontend tools
- threads
- CRM context
- notification state
- dynamic suggestions
- Cloudflare bundle workarounds

Reference:

https://github.com/amoai-tech/luminaai/blob/main/app/src/components/operator-panel/operator-panel.tsx

The new app should reuse only presentation/layout ideas where needed.

Why:

> A shell should not become the hidden owner of every domain's auth, tenant state, AI context, and business logic.

## 9.2 Lumina deployment architecture

Lumina contains Cloudflare/OpenNext-specific infrastructure.

The new app is Vercel / Next.js.

Do not migrate:

- Wrangler configuration
- Worker bundle hacks
- Cloudflare model routing
- OpenNext deployment code
- Cloudflare-specific runtime assumptions

unless a separate future hosting decision explicitly changes the new app architecture.

## 9.3 Broad agent registries

Do not give the Production Planner every available tool because the tool exists in a shared registry.

Prefer:

```text
agent
→ smallest explicitly allowed tool set
```

This reduces accidental writes and cross-domain behavior.

## 9.4 Active-brand state as authorization

Lumina often uses client active-brand state to help UX.

Keep it only as a **presentation hint**.

Authorization must always come from:

```text
verified user
→ trusted organization
→ server-side brand/shoot ownership check
```

## 9.5 Hidden CopilotKit context inside domain UI

Example:

Lumina Brand components inject `useAgentContext`.

That belongs to:

**IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning**

not Brand browsing.

Domain tasks should not silently pull AI context work forward.

## 9.6 Legacy write tools

Do not migrate write tools simply because they worked previously.

Every consequential write must be re-certified against:

- current org model
- verified actor
- RLS
- idempotency
- approved artifact/revision
- current schema

---

# 10. Supabase strategy

Supabase/Postgres owns durable application truth.

## 10.1 Current schema landscape

Current hosted database includes important domains such as:

```text
public
  organizations
  org_members
  brands
  brand_scores
  assets
  cloudinary_assets
  notifications
  notification_reads
  CRM tables
  ...

shoot
  shoots
  ...

planner
  instances
  tasks
  gate_approvals
  ...

talent
  bookings
  ...

mastra
  memory/runtime tables
```

## 10.2 Canonical data ownership

### Brands

Use:

- `public.brands`
- `public.brand_scores`

Approved DNA:

```text
brands.ai_profile
```

Draft DNA:

```text
brands.ai_profile_draft
```

Do not confuse them.

### Shoots

Canonical V2 truth:

```text
shoot.shoots
```

Do not recreate new product behavior on legacy `public.shoots`.

### Assets

Business asset records:

```text
public.assets
```

Cloudinary mirror/link metadata:

```text
public.cloudinary_assets
```

Cloudinary stores bytes/transforms; Supabase stores business ownership and relationships.

### Planner

Use:

```text
planner.instances
planner.tasks
planner.gate_approvals
```

for durable planning/approval truth where applicable.

### Talent

Use current `talent.*` schemas and certified RPC/contracts.

Do not copy old booking write semantics without security review.

---

# 11. Tenant-security strategy

## Golden rule

RLS is required but is not always sufficient to represent the **active organization**.

Example:

A user can belong to Org A and Org B.

A membership-union RLS policy may legally allow rows from both.

The application still needs:

```text
trusted active org = Org A
→ query explicitly filters org_id = Org A
→ RLS confirms user can access Org A
```

## Required pattern

```text
Verified session
→ resolve trusted org server-side
→ domain loader receives trustedOrgId
→ explicit domain ownership filter
→ RLS defense in depth
→ map to minimal display model
```

## Never use as authorization authority

- browser query parameter
- local storage
- client active-brand state
- `user_metadata`
- arbitrary client `org_id`
- thread ID by itself
- Cloudinary public ID by itself

---

# 12. Planner architecture

## Target architecture

```text
CopilotKit UI
→ authenticated AG-UI stream
→ Production Planner
→ approved narrow tools
→ structured ShootPlan
→ human approval
→ safe write
```

## One canonical Planner

Use one canonical `productionPlannerAgent`.

If both IDs are needed:

```text
default
production-planner
```

they should reference the same underlying agent instance.

Do not create duplicate Planner agents.

## Planner responsibility

Planner should:

- understand fashion production
- reason about the operator request
- use trusted context
- call deterministic planning tools
- surface uncertainty
- return structured plans

Planner should not:

- bypass approvals
- directly mutate database state
- invent shot references
- invent pricing as fact
- silently publish/save

---

# 13. Structured ShootPlan strategy

Create one canonical V2 schema.

Recommended fields:

```text
schemaVersion
purpose
objective
channels
shootType
photoRequirements
videoRequirements
deliverables
shotList
location
indoorOutdoor
lighting
setBackground
talent
crew
studio
equipment
schedule
budget
risks
assumptions
openQuestions
referenceProvenance
```

## Unknown-value model

Important uncertain fields should use:

```ts
{
  value: ...,
  status: "confirmed" | "assumed" | "needs_input"
}
```

This prevents AI assumptions becoming hidden business truth.

## Versioning

Start with:

```text
schemaVersion = "1"
```

APPROVAL and SHOOT-SAVE should consume the exact same schema/type.

No duplicate plan schemas.

---

# 14. Human approval architecture

The end-to-end production path should be:

```text
Planner draft
→ validated ShootPlanSchema
→ operator review
→ operator edit
→ operator approval
→ immutable approved revision/hash
→ idempotent save
```

Approval should bind to the exact plan version that was reviewed.

Do not approve "whatever the latest object happens to be."

---

# 15. Shoot-save strategy

This is one of the highest-risk migration points.

Target write contract:

```text
verified JWT actor
+ trusted active organization
+ exact approved ShootPlan revision/hash
+ idempotency key
→ atomic transaction
→ canonical shoot.shoots + child records
```

Requirements:

- no caller-supplied actor authority
- no browser service role
- no cross-org write
- idempotent retry
- atomic transaction
- approval-bound data
- safe failure
- auditability

Do not blindly copy legacy `commit_shoot_draft` behavior.

---

# 16. Brand Intelligence strategy

Target journey:

```text
Brand website
→ safe bounded research
→ draft Brand DNA
→ operator review
→ operator edits
→ approval
→ brands.ai_profile
```

Key controls:

- SSRF protections
- bounded crawling
- source/evidence tracking
- draft ≠ approved
- explicit human approval
- revision-bound promotion
- no silent overwrite of approved DNA

`BRAND-001` displays approved data.

`BRAND-INTEL-001` owns generation/review/promotion.

Keep those responsibilities separate.

---

# 17. Intelligence Rail strategy

The Intelligence Rail should be a shared operator capability, not a second agent system.

Reuse from Lumina:

- visual presentation
- contextual evidence patterns
- suggestions/panels
- explainable insight UI

Do not reuse:

- route-to-agent sprawl
- duplicate tenant state
- hidden domain writes
- fake evidence
- broad agent registry behavior

The Rail should use the current authenticated Planner/runtime and verified current-page context.

---

# 18. Product migration roadmap

## NOW — Core operator journey

### Foundation already completed

**IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App**

Status: Done.

### Current implementation order

1. **IPI-1066 · DASH-MAIN-001 — Reuse the Proven iPix Command Center as the Main Dashboard Page**
2. **IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles**
3. **IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records**
4. **IPI-1140 · INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace**
5. **IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records**
6. **IPI-1070 · CRM-001 — Bring the Proven iPix CRM Workspace Into the New App**
7. **IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App**
8. **IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings**
9. **IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans**
10. **IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics**

Why this order:

```text
Dashboard
→ core entities
→ AI context surface
→ media
→ relationships
→ operational coordination
→ talent/booking
→ planning workspace
→ analytics
```

It delivers usable product value early without blocking on optional horizontal features.

---

# 19. AI / Shoot planning lane

Run in parallel where file ownership allows.

## Required sequence

1. **IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely**
   - certification gate
2. **IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant**
3. **IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely**
4. **IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan**
5. **IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved**
6. **IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization**
7. **IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot**
8. **IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning**

## Dependency model

```text
STREAM certification
        ↓
PLANNER
        ↓
TOOL
        ↓
PLAN
        ↓
APPROVAL
        ↓
SHOOT-SAVE
        ↓
SHOOT-WIZARD
        ↓
PLANNER-CONTEXT refinement
```

---

# 20. Brand Intelligence lane

After Brand browsing is stable:

```text
IPI-1068 · BRAND-001
        ↓
IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile
```

This gives a clear separation:

```text
BRAND-001 = browse approved truth
BRAND-INTEL-001 = create/review/promote new Brand DNA
```

---

# 21. Marketing and first-user lane

This can progress separately from most operator product work.

Recommended dependency order:

1. **IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout**
2. **IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup**
3. **IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace**
4. **IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App**
5. **IPI-1060 · MARKETING-SERVICES-001 — Reuse the Existing iPix Photography Service Pages**
6. **IPI-1064 · MARKETING-MEDIA-001 — Reuse and Optimize the Existing iPix Marketing Images, Sliders, and Visual Content**
7. **IPI-1063 · MARKETING-SEO-001 — Keep the New iPix Marketing Site Searchable and Correctly Indexed**

Do not put marketing polish on the critical path for the operator MVP.

---

# 22. Parallelization strategy

Safe parallel lanes:

```text
Lane A — Operator screens
DASH → BRAND → SHOOT → ASSETS → CRM ...

Lane B — Planner
STREAM → PLANNER → TOOL → PLAN → APPROVAL → SAVE

Lane C — Cloudinary/media foundation
Cloudinary foundation → delivery → webhook/mirror → assets integration

Lane D — Marketing/onboarding
MARKETING NAV → LOGIN → ONBOARD → HOME/SERVICES/SEO
```

Avoid parallel tasks that edit the same:

- operator layout
- auth helpers
- CopilotKit route
- Planner registry
- canonical plan schema
- Supabase migration/RPC
- shared navigation

---

# 23. Known red flags and failure points

## Red flag 1 — Copying Lumina first

Failure mode:

```text
copy screen
→ inherit old query/auth/context assumptions
→ retrofit tenancy later
```

Fix:

```text
prove data/security contract first
→ then port presentation
```

## Red flag 2 — RLS mistaken for active-org selection

A user may be a member of multiple orgs.

Fix:

Always explicitly filter domain queries by trusted active org.

## Red flag 3 — Hidden AI behavior in UI components

Lumina components sometimes inject CopilotKit context.

Fix:

Remove/adapt context hooks unless the task explicitly owns AI context.

## Red flag 4 — Fake analytics

Do not convert missing metrics to `0`.

Use:

```text
N/A
Unavailable
Not yet tracked
```

with source provenance.

## Red flag 5 — Old pricing assumptions

Lumina budget numbers are not market truth.

Fix:

Rates must be explicit inputs or clearly labeled assumptions.

## Red flag 6 — Shot-angle hallucination

Never allow the Planner to manufacture angle names.

Fix:

`generateShotListDraft` receives trusted reference-shot input.

## Red flag 7 — Duplicate schemas

Do not define separate plan types in Planner, Approval, Save, and UI.

Fix:

One canonical versioned `ShootPlanSchema`.

## Red flag 8 — Legacy service-role write paths

Service-role usage can bypass RLS.

Fix:

Prefer authenticated, server-trusted contracts and narrow SECURITY DEFINER RPCs only where justified and audited.

## Red flag 9 — Agent tool sprawl

A shared tool registry can accidentally give the Planner booking, CRM, or write capabilities.

Fix:

Explicit per-agent tool allowlist.

## Red flag 10 — Merge = Done

A PR existing or merging does not prove the workflow works.

Fix:

Done requires observable user outcome and task-verifier Full.

---

# 24. Four cross-task decisions that must remain explicit

## 24.1 Trusted shot-reference owner

The four compute tools remain pure.

A separate trusted read layer must provide vetted shot references to `generateShotListDraft`.

Do not hide DB/network access inside the compute tool.

## 24.2 Operations active-org notification semantics

Before moving the Operations inbox, prove notification listing/read behavior is active-org safe.

## 24.3 Shoot-save V2 write contract

Do not reuse legacy save behavior until verified against:

- trusted org
- verified actor
- approved plan revision
- idempotency

## 24.4 Provider-neutral evidence persistence

UI evidence components exist, but persistent AI evidence/citation truth still needs one canonical provider-neutral model.

---

# 25. Verification strategy for every task

Use the cheapest reliable proof first.

```text
Graphify / static inspection
→ targeted pure/unit tests
→ targeted integration
→ typecheck
→ build
→ browser / runtime
→ hosted preview only where required
→ task-verifier Full
```

## Mandatory tenant proof when applicable

```text
User belongs to Org A + Org B
Active org = Org A
Org A data visible
Org B data absent
Direct Org B ID fails closed
Switch trusted org
visibility reverses correctly
```

---

# 26. Faster / better implementation rule

At the beginning of every task and every major phase ask:

> Is there a better, faster, simpler, or more efficient way to complete this without weakening security, correctness, or proof?

Prefer:

```text
existing ipixai implementation
→ installed dependency
→ vendor feature
→ official CLI/SDK
→ official maintained example
→ Lumina pure/presentation reuse
→ smallest adapter
→ custom code last
```

Examples:

- reuse `notFound()` instead of custom 404 infrastructure
- reuse current AUTH-002 instead of new org resolver
- direct trusted-org query instead of inventing an RPC
- reuse existing RLS instead of custom authorization middleware
- reuse Lumina deterministic tool core instead of rewriting the algorithm
- reuse current Mastra Memory instead of porting Lumina memory

---

# 27. Production-ready checklist

## Architecture

- [ ] `ipixai` is the only implementation authority
- [ ] no duplicate operator shell
- [ ] no duplicate auth system
- [ ] no duplicate tenant resolver
- [ ] no duplicate Planner runtime
- [ ] no duplicate ShootPlan schema

## Security

- [ ] verified server identity
- [ ] trusted active org
- [ ] explicit domain ownership filter
- [ ] RLS remains enabled
- [ ] cross-org negative test
- [ ] no service-role secret in browser
- [ ] no `user_metadata` authorization
- [ ] write contracts verify actor and org
- [ ] approval-bound consequential writes

## Planner

- [ ] secure stream proven
- [ ] one canonical Production Planner
- [ ] narrow allowed tool set
- [ ] deterministic tool tests
- [ ] uncertainty explicit
- [ ] no invented shot angles
- [ ] budget assumptions explicit
- [ ] canonical versioned plan
- [ ] approval before save

## Data

- [ ] canonical tables documented
- [ ] `shoot.shoots` used for V2 shoot truth
- [ ] approved Brand DNA distinguished from draft
- [ ] Cloudinary bytes separated from Supabase metadata
- [ ] idempotent writes
- [ ] no unnecessary schema/RPC additions

## UX

- [ ] consistent `/app` shell
- [ ] loading state
- [ ] empty state
- [ ] error state
- [ ] unauthorized/not-found state
- [ ] desktop proof
- [ ] ~390px mobile proof
- [ ] no fake metrics/data

## Delivery

- [ ] clean worktree from current `origin/main`
- [ ] targeted tests green
- [ ] typecheck green
- [ ] build green
- [ ] browser/runtime proof where needed
- [ ] CI green
- [ ] task-verifier Full
- [ ] post-merge observable proof

---

# 28. Recommended roadmap by phase

## Core Foundation

- Authentication
- tenant isolation
- secure Planner streaming
- shared operator shell
- Cloudinary/Supabase media contract
- Vercel deployment foundation

## Core MVP

- Dashboard
- Brand
- Shoot
- Intelligence Rail
- Planner
- four planning tools
- structured ShootPlan
- Approval
- Shoot Save
- Shoot Wizard
- Assets

## Post-MVP expansion

- CRM
- Operations
- Talent/Booking
- Plans workspace
- Analytics
- Brand Intelligence expansion
- Marketing/service content expansion

## Advanced

- campaign automation
- publishing
- commerce workflows
- deeper analytics/learning loop
- advanced agent specialization
- cross-channel automation
- autonomous suggestions with human execution gates

---

# 29. Success metrics

The migration succeeds when operators can complete real work, not when screens merely exist.

## MVP success indicators

### Security

- zero cross-org data leakage in test matrix
- zero browser service-role usage
- all consequential writes human-approved

### Reliability

- authenticated Planner stream works repeatedly
- stop/retry works
- idempotent saves do not duplicate shoots
- foreign IDs fail closed

### Product usability

- operator reaches any core domain from one shell
- Brand and Shoot records open reliably
- Planner produces a complete valid plan
- operator can edit and approve it
- approved plan persists once
- asset workflow connects correctly to resulting shoot

### Development efficiency

- majority of migrated UI uses proven Lumina presentation
- no second auth/tenant/runtime architecture
- few new schemas/RPCs
- each task remains narrow
- no architecture redesign without evidence

---

# 30. Source-of-truth hierarchy

For implementation decisions:

1. current clean `amoai-tech/ipixai@main`
2. installed package types / lockfile
3. live runtime / hosted database read-only evidence
4. current project architecture docs
5. official version-specific vendor documentation
6. official GitHub examples
7. `amoai-tech/luminaai` reference code
8. old task text / old docs / old prototypes

Lumina is deliberately below current iPix and vendor/runtime truth.

---

# 31. Strategic summary

## Best decision

Build the new iPix as a **clean, secure V2 architecture that selectively mines Lumina for proven product behavior rather than migrating Lumina wholesale**.

## Why

This gives iPix the best of both:

### Keep from Lumina

- years of product thinking
- operator workflows
- UI work
- fashion-domain language
- planning rules
- tests
- schemas and examples

### Avoid from Lumina

- architecture debt
- old deployment constraints
- hidden tool/write coupling
- tenancy assumptions
- duplicated AI context
- old runtime versions
- unsafe or stale write contracts

## Immediate execution path

```text
CURRENT
IPI-1066 · DASH-MAIN-001

NEXT
IPI-1068 · BRAND-001
→ IPI-1067 · SHOOT-001
→ IPI-1140 · INTELLIGENCE-RAIL-001
→ IPI-1069 · ASSETS-001

PARALLEL AI
IPI-1045 · STREAM-001 certification
→ IPI-1048 · PLANNER-001
→ IPI-1049 · TOOL-001
→ IPI-1081 · PLAN-001
→ IPI-1084 · APPROVAL-001
→ IPI-1083 · SHOOT-SAVE-001
→ IPI-1085 · SHOOT-WIZARD-001
```

The guiding migration principle is:

> **Reuse the product knowledge. Keep the new architecture.**

