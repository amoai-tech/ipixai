# 13 — Mastra rebuild (reuse iPix agents)

**After:** [12-task-roadmap.md](./12-task-roadmap.md)
**Before:** [14-operating-rules.md](./14-operating-rules.md)

The best approach is:

> **Start the new iPix from CopilotKit `examples/integrations/mastra`, then selectively reuse the proven Mastra agents, tools, workflows, memory patterns, and Supabase data from the current iPix.**

Do **not** use `template-agent-harness` or Mastra `ui-dojo` as the main starter. They are better as **feature/reference repos**.

The current iPix audit shows that a lot of the Mastra layer is already valuable: 9 operator agents, ~35 tools, two real HITL workflows, thread/message persistence, org-scoped resource IDs, and 380 Mastra tests. The weak areas are Cloudflare durability, observability, HITL interrupt handling, dispatcher bloat, and some memory/idempotency gaps.

**Storage rules (verified 2026-08-23):** PostgresStore uses `schemaName` + `disableInit: true` (migrations own DDL). Point the new runtime at **preview** `mastra` until the unique-marker golden test and schema-contract diff pass. Do not assume `service_role` can read `mastra.*`. 

---

# 1. Repos/features to use

| Source                                        | Use in new iPix                                              |        Phase |                    Score |
| --------------------------------------------- | ------------------------------------------------------------ | -----------: | -----------------------: |
| **CopilotKit `examples/integrations/mastra`** | **Primary starter**                                          |         Core |               **97/100** |
| **Current iPix Mastra code**                  | Agents, tools, workflows, schemas, tests                     |     Core/MVP |  **94/100 reuse source** |
| **Mastra `template-agent-harness`**           | Task tracking, built-in web tools, durable planning patterns | MVP/Post-MVP |     **88/100 reference** |
| **Mastra `ui-dojo`**                          | UI integration/reference patterns                            |          MVP |     **82/100 reference** |
| **CopilotKit `canvas/mastra-pm`**             | Shared planner state                                         |          MVP |     **92/100 reference** |
| **CopilotKit `canvas/mastra`**                | Canvas/artifacts                                             |         MVP+ |     **87/100 reference** |
| Mastra templates                              | Feature-specific examples                                    |    As needed |               **85/100** |
| Mastra Agent Builder                          | Do not make production foundation                            |  Later/avoid | **55/100 for iPix core** |

Mastra's template catalog now includes Agent Harness, browser agents, DB chat, research assistants, Slack agents and other runnable patterns. Mastra explicitly positions templates as starting/reference projects that can connect to CopilotKit. ([Mastra][1])

---

# 2. What should we reuse from current iPix?

A lot.

## KEEP / PORT

### Agents

Reuse the business logic and prompts for:

* `production-planner`
* `creative-director`
* `brand-intelligence`
* `visual-identity`
* `social-discovery`
* `model-match`
* `crm-assistant`
* `booking`

The current code already has a coherent registry and routing model. 

### Tools

Reuse the ~35 existing `createTool()` implementations where the underlying business operation remains valid.

Especially:

```text
shoot tools
brand intelligence tools
CRM tools
booking tools
asset tools
matching tools
```

But review every write tool for:

* idempotency
* organization authorization
* human approval
* error handling

The current audit specifically identifies uneven CRM/booking idempotency as a remaining weakness. 

### Workflows

Definitely reuse the concepts and business steps of:

1. `shoot-wizard`
2. `brand-intelligence`

Current Shoot Wizard already has three approval gates:

```text
deliverables
→ approve
→ shot list
→ approve
→ budget
→ approve
→ commit
```

Brand Intelligence already uses crawl → enrich → approval → commit. 

Do **not** mechanically copy the existing runtime wrappers around them.

---

# 3. Supabase: reuse, don't recreate

The new iPix should continue using the existing Supabase application data.

For Mastra storage, keep the architectural rules that are already correct:

```text
schema = mastra
disableInit = true
MASTRA_SCHEMA required
repository migrations own DDL
no silent fallback to public
```

The audit confirms:

* 33 Mastra tables exist.
* `public.mastra_*` is already zero.
* 43 real threads exist.
* 101 real messages exist.
* 6,136 workflow snapshots exist.
* application-level `resourceId` is used for org isolation. 

### Do not copy all existing rows into a new schema

Instead:

```text
New iPix runtime
        ↓
existing Supabase
        ↓
existing application data
        ↓
existing mastra schema
```

For development, use a clean preview/staging environment before pointing the rebuild at production.

---

# 4. Critical database fix before treating Mastra Studio as healthy

Current installed Mastra expects `mastra_workflow_definitions`, and the audit actually proved the caller:

```text
mastra dev
→ startWorkers()
→ loadDynamicWorkflows()
→ WorkflowDefinitionsPG.list()
→ missing mastra_workflow_definitions
→ PostgreSQL 42P01
```

This is no longer theoretical. 

So one early migration should add the table using the exact installed/current Mastra contract.

However, don't enable dynamic workflows simply because the table exists.

---

# 5. New Mastra feature: Built-in Tools

This is one of the most useful recent additions.

Mastra now includes built-ins for:

* durable task lists
* web search
* web fetch
* asking the user questions
* submitting plans for human approval

They work with agents/workflows and integrate with Studio. ([Mastra][2])

## What should iPix use?

### A. Task tracking — YES, MVP

Very good fit for Production Planner.

Instead of the Planner merely saying:

> I'll prepare your shoot.

The agent can maintain:

```text
✓ Analyze Brand DNA
✓ Determine channel requirements
→ Build deliverables
○ Generate shot list
○ Estimate budget
○ Submit plan for approval
```

### Real iPix example

Operator says:

> Create a Spring campaign with Shopify, Instagram and Amazon assets.

Planner creates a durable task list:

```text
1. Read Brand DNA
2. Identify product requirements
3. Build deliverables
4. Generate shot list
5. Calculate budget
6. Request operator approval
```

**Recommendation: MVP.**

---

### B. `askUserTool` — YES, but carefully

Good for missing information.

Example:

> What is the shoot date?

or:

> Is this campaign primarily conversion or awareness?

Use it for clarification before expensive work.

Do not let it replace normal forms everywhere.

**Recommendation: MVP.**

---

### C. `submitPlanTool` — strong fit

This is conceptually very close to iPix's existing:

> Humans decide. AI assists.

Example:

```text
AI generates campaign plan
        ↓
Submit Plan
        ↓
Operator reviews
        ↓
Approve / Reject
        ↓
Only then persist
```

However, iPix already has workflow HITL. So do not create **two approval systems**.

### Best design

Use:

```text
submitPlanTool
```

for **presentation/plan approval**, while persistent database mutations continue through the canonical iPix approval/write layer.

**Recommendation: MVP experimental → standardize if clean.**

---

### D. `webSearchTool` — selective use

Mastra's built-in web search can use model-native search for supported providers. ([Mastra][2])

Good iPix uses:

* trend research
* competitor discovery
* shoot inspiration
* channel specification research

Not good for:

* deterministic product data
* CRM truth
* talent availability
* pricing stored in iPix

Use internal data first.

**Recommendation: MVP+ for Creative Director / Brand Intelligence.**

---

### E. `webFetchTool` — useful but don't duplicate Firecrawl

Current iPix already uses Firecrawl for visual identity/web intake. 

So:

```text
Firecrawl
→ crawl/structured brand analysis

webFetchTool
→ lightweight one-page reading
```

Don't replace proven Firecrawl workflows without evidence.

---

# 6. Dynamic workflows

Mastra introduced dynamic workflows in August 2026. They require Mastra Core 1.58+ and persist workflow definitions as structured JSON. ([Mastra][3])

Your existing audited core is already 1.59, so conceptually the current stack supports the feature generation. 

But I would **not use dynamic workflows in Core/MVP**.

## Why?

Current iPix has known workflows:

```text
Brand Intelligence
Shoot Wizard
```

These need:

* source control
* tests
* review
* predictable schemas
* deterministic approval paths

Dynamic workflows become valuable later when users can create their own production SOP.

### Future example

A fashion brand says:

> For every e-commerce shoot:
>
> 1. review Brand DNA
> 2. generate 8 hero shots
> 3. create Amazon white-background shots
> 4. send to creative director
> 5. require approval
> 6. schedule retouching

The user could save this as:

**"Amazon + Shopify Shoot SOP"**

and reuse it.

That is a great Post-MVP feature.

**Classification: POST-MVP / Phase 3.**

---

# 7. Agent Harness — what to borrow

The Mastra Agent Harness currently demonstrates:

* workspace
* shell tools
* memory
* task tracking
* web access
* recurring schedules
* approval gates. ([Mastra][4])

The GitHub repository is a very recent 2026 template and is explicitly a general-purpose Mastra agent.

For iPix, borrow:

### USE

* task-list architecture
* memory setup ideas
* approval pattern
* web search/fetch pattern
* schedule architecture reference

### DO NOT USE

* local filesystem as the iPix asset store
* shell tools in customer-facing operator agents
* general-purpose unrestricted agent
* broad workspace permissions

iPix assets belong in Cloudinary/Supabase, not an agent's local filesystem.

---

# 8. UI Dojo — reference only

`mastra-ai/ui-dojo` is an active Mastra + UI framework repo, useful for checking current frontend integration patterns.

But because iPix is explicitly choosing:

```text
CopilotKit
+
Mastra
```

CopilotKit's own current Mastra integration remains the first source of truth.

Use UI Dojo when we need to understand:

* streaming UI patterns
* tool-state rendering
* generative artifacts
* alternative frontend implementations

Don't replace CopilotKit with UI Dojo.

---

# 9. Core setup

## Phase 0 — latest-version proof

Before writing application code:

```text
CopilotKit latest supported version
Mastra latest compatible family
@ag-ui/mastra compatible version
@mastra/pg
@mastra/memory
@mastra/observability
Next.js
React
Zod
```

Do **not** copy the current audited 1.59 numbers blindly into the new app. Those are the verified versions from **August 22**, but Mastra is actively shipping new features almost daily—the blog has newer August 17–19 releases/features. ([Mastra][5])

For the rebuild:

> Resolve one current compatible package family first and pin it.

---

# 10. Phase 1 — clean runtime

Start directly from:

**CopilotKit `examples/integrations/mastra`.**

Build:

```text
Next.js
   ↓
CopilotKit v2
   ↓
AG-UI
   ↓
Mastra local agents
```

Initially:

**one agent only:**

`production-planner`

---

# 11. Phase 2 — durable storage

Add:

```text
PostgresStore
schemaName=mastra
disableInit=true
Supabase PostgreSQL
```

Keep the existing private-schema strategy.

### Core test

```text
login
→ send TEST-123
→ receive stream
→ row in mastra_messages
→ hard refresh
→ unique TEST-<uuid> returns
→ restart server
→ unique TEST-<uuid> returns
```

Until this passes, do nothing fancy.

---

# 12. Phase 3 — security

Reuse the existing principle:

```text
resourceId =
org:{orgId}::user:{userId}
```

Current iPix already implements fail-closed org membership checks. 

New runtime must prove:

```text
Org A thread
      ✕
Org B
```

Do not trust:

```text
orgId supplied by LLM
orgId supplied by URL alone
```

Server derives tenant context from authenticated membership.

---

# 13. Phase 4 — Production Planner

Port:

* instructions
* tool selection
* memory schema
* business rules
* tests

Don't port:

* runtime hacks
* old SSE compatibility code
* `emitInterruptOutcome=false`
* legacy storage switching

The rebuild should attempt the clean official interrupt path first.

---

# 14. Core milestone

Core is done when:

```text
AUTH                   ✓
CopilotKit             ✓
Mastra                 ✓
streaming              ✓
Production Planner     ✓
PostgresStore          ✓
persistent threads     ✓
org isolation          ✓
error handling         ✓
targeted tests         ✓
```

Target:

**95/100 before building feature breadth.**

---

# 15. MVP Mastra features

Then expand the AI platform.

## MVP 1 — memory

Use:

### Message history

Already proven useful.

### Planner working memory

Keep it small and structured.

Example:

```text
brand
campaign goal
channels
budget
shoot type
approved deliverables
selected talent
remaining decisions
```

Do not enable observational memory yet.

Current audit correctly notes that observational memory and semantic recall are currently unused/deferred. 

---

# 16. MVP 2 — task tracking

Use the new Mastra built-in task provider.

Example:

```text
Summer Lookbook
✓ Analyze brand
✓ Collect products
✓ Draft deliverables
→ Build shot list
○ Approve budget
○ Confirm crew
```

This gives the operator visible progress during long Planner operations.

**High-value new feature.**

---

# 17. MVP 3 — structured output

Current setup scores only 70/100 because tools use Zod but most agents don't return structured outputs. 

Improve the new Planner.

Example:

```text
ShootPlan {
  objective
  deliverables[]
  channels[]
  shots[]
  crew[]
  budget
  risks[]
}
```

Then CopilotKit can render actual UI instead of parsing prose.

**Priority: high.**

---

# 18. MVP 4 — HITL

One unified approval contract.

Use:

```text
AI drafts
   ↓
CopilotKit card
   ↓
operator modifies
   ↓
Approve
   ↓
Mastra workflow resumes
   ↓
Supabase commit
```

Use official interrupts if they pass.

Do not carry the current:

```text
emitInterruptOutcome=false
```

unless the current version still has a reproducible blocker.

---

# 19. MVP 5 — Brand Intelligence

Port the existing workflow:

```text
URL
↓
crawl
↓
brand profile
↓
enrichment
↓
Brand DNA draft
↓
approval
↓
commit
```

Keep Firecrawl initially.

Then experiment with built-in:

* `webFetchTool`
* `webSearchTool`

only for supporting research.

---

# 20. MVP 6 — Creative Director

Use:

```text
Brand DNA
+
campaign goal
+
products
+
past assets
```

to generate:

```text
creative concepts
shot direction
palette
styling
channel variations
```

Use structured output + CopilotKit GenUI.

---

# 21. MVP 7 — Booking / Matching

Reuse the current agents but improve memory.

The existing audit explicitly identifies Booking and Model Match as missing memory. 

For example:

> Use the same model we shortlisted yesterday.

The Booking agent should know the thread context.

---

# 22. MVP 8 — Observability

This should move earlier in the new build.

Current production has only **6 spans**, because exporter usage is effectively minimal. 

New iPix should enable:

```text
staging
→ observability ON
→ sensitive-data filtering
→ trace every Planner run
```

Then production sampling as appropriate.

Real-world benefit:

> Planner stopped after generating the shot list.

Instead of guessing, see:

```text
Brand lookup    240ms
Product lookup  390ms
shot generation 3.1s
budget tool     ERROR
```

---

# 23. MVP 9 — evals

Mastra's recent quality tooling is one of the most valuable things to adopt early.

Use:

* datasets
* experiments
* tool-call accuracy
* rubric scorers
* gates/verdicts

The current iPix has **380 Mastra tests**, but no Mastra eval layer. 

Start with one test:

> Production Planner must not generate final shot list before deliverables approval.

Then expand.

---

# 24. MVP architecture

```text
                    iPix UI
                      │
                CopilotKit v2
                      │
                    AG-UI
                      │
                  Mastra
        ┌─────────────┼─────────────┐
        │             │             │
     Agents        Workflows      Memory
        │             │             │
        └─────────────┼─────────────┘
                      │
                PostgresStore
                      │
                  Supabase
```

And application/domain tools connect to:

```text
Supabase
Cloudinary
Mercur
AI Gateway
Firecrawl
```

---

# 25. Post-MVP — best advanced Mastra features

## A. Dynamic workflows — YES later

Use for brand-defined SOPs.

Example:

> Every product-launch campaign should follow our 12-step internal workflow.

**Phase 3.**

---

## B. Shared multi-user threads

Very interesting for shoot production.

Instead of:

```text
org + individual user thread
```

allow:

```text
shoot:123
```

where:

* producer
* photographer
* creative director

share one agent context.

This requires careful permissions.

**Phase 2/3.**

---

## C. Background tasks

Good for long Brand Intelligence jobs.

Example:

```text
Operator requests full competitor analysis
→ Planner continues responding
→ background task crawls 10 competitors
→ UI shows progress
→ result appears when ready
```

**MVP+ / Phase 2.**

---

# 26. Scheduled workflows

Use later, after cleaning the existing dispatcher issue.

Real iPix examples:

```text
24h before shoot
→ verify call sheet

6h before shoot
→ weather check

2h before shoot
→ send crew reminder

day after shoot
→ remind operator to approve selects
```

But your current database has roughly 6,000 internal dispatcher rows and an unhealthy/unused cron path. 

So:

> Fix scheduling infrastructure first. Add product schedules second.

---

# 27. Channels / WhatsApp

Very strong future use case.

Examples:

### Crew

> Call time tomorrow: 7:00 AM at Studio 4.

### Talent

> Please confirm fitting at 2 PM.

### Brand client

> Your Brand DNA draft is ready. Review here.

But this is a new security/runtime surface, not an MVP checkbox.

**Post-MVP.**

---

# 28. Fine-grained authorization

This is one recent Mastra feature I would investigate for the rebuild.

Mastra announced fine-grained authorization on August 19 for permissions around routes, agents, workflows, tools, memory and MCP servers. ([Mastra][5])

That could eventually complement the iPix app authorization.

Example:

```text
Producer:
✓ planner
✓ creative director
✓ shoot write tools

Photographer:
✓ shoot assistant
✓ asset tools
✕ CRM
✕ financial tools
```

However:

> Supabase/org membership remains the system of record for tenant identity.

Do not move tenancy into Mastra authorization without a deliberate design.

---

# 29. Tool hooks

Very useful Post-MVP feature.

Use them to centrally enforce:

```text
before tool call
→ authorization
→ validation
→ observability

after tool call
→ audit
→ metrics
```

Example:

Before `moveDealStage`:

```text
check:
authenticated?
correct org?
role allows CRM change?
approval exists?
```

This could eliminate repeated checks across dozens of tools.

**High-interest Phase 2 candidate.**

---

# 30. Response caching

Good selectively.

### Use

Public marketing:

> What does iPix do?

Brand knowledge:

> What is our approved positioning?

### Don't use

> What's today's shoot status?

> Is Sofia available?

Those can go stale.

**Phase 2.**

---

# 31. Agent feedback

Mastra has also recently added agent feedback/analytics. ([Mastra][5])

Great for iPix:

```text
Was this shoot plan useful?
👍 👎

Was Brand DNA accurate?
1–5
```

Over time this produces training/evaluation data.

**Phase 2/3.**

---

# 32. Features I would NOT prioritize

Avoid early:

* supervisor agent
* A2A
* ACP in customer runtime
* AgentBrowser
* local workspace filesystem
* GraphRAG
* Qdrant
* semantic recall
* observational memory
* Agent Builder as production architecture
* dynamic agents stored outside Git

Your existing advanced audit reaches essentially the same conclusion: these are interesting but mostly solve problems iPix doesn't currently have. 

---

# 33. Recommended phases

## CORE — foundation

1. Latest compatible package family
2. CopilotKit Mastra starter
3. Production Planner
4. Supabase Auth
5. organization context
6. PostgresStore
7. persistent threads
8. streaming
9. clean HITL proof
10. golden TEST-123
11. error handling
12. basic observability

---

## MVP — useful product

1. existing agents
2. existing tools
3. Shoot Wizard
4. Brand Intelligence
5. working memory
6. structured output
7. built-in task tracking
8. ask-user
9. GenUI
10. HITL approval
11. Creative Director
12. Booking memory
13. CRM agent
14. Evals
15. tool-level authorization/idempotency
16. full tracing in staging

---

## POST-MVP

1. dynamic workflows
2. background tasks
3. multi-user shoot threads
4. tool hooks
5. response caching
6. agent feedback
7. schedules
8. WhatsApp Channels
9. fine-grained Mastra authorization
10. memory extractors
11. advanced eval datasets
12. production sampled scorers

---

## LATER / EXPERIMENTAL

1. observational memory
2. semantic recall
3. supervisor Campaign Manager
4. MCP Apps
5. browser agents
6. sandbox/workspace
7. Agent Builder
8. ACP/A2A

---

# 34. Suggested new iPix build order

```text
CopilotKit integrations/mastra
        ↓
latest Mastra package family
        ↓
Supabase Auth + org membership
        ↓
PostgresStore
        ↓
Production Planner
        ↓
unique TEST-<uuid> persistence proof (preview storage)
        ↓
official HITL
        ↓
structured ShootPlan
        ↓
task tracking
        ↓
existing iPix shell/pages
        ↓
Brand Intelligence
        ↓
Shoot Wizard
        ↓
Creative Director
        ↓
Assets
        ↓
Booking / Matching
        ↓
CRM
        ↓
Observability + evals
        ↓
Cloudflare preview
        ↓
same unique TEST-<uuid> on Worker
        ↓
advanced features
```

---

# 35. First Linear task set

Do not invent live IPI numbers before creating/searching the issues. Use **PROPOSED** until mapped.

| Order | Proposed full task name                                                                                   |
| ----: | --------------------------------------------------------------------------------------------------------- |
|     1 | **PROPOSED · MASTRA-V2-001 — Pin the Latest Compatible Mastra Runtime Family for New iPix**               |
|     2 | **PROPOSED · MASTRA-V2-002 — Connect the Clean CopilotKit Starter to One Local Production Planner Agent** |
|     3 | **PROPOSED · MASTRA-V2-003 — Persist iPix AI Threads in Supabase PostgresStore**                          |
|     4 | **PROPOSED · MASTRA-V2-004 — Protect Every AI Thread With Authenticated Organization Ownership**          |
|     5 | **PROPOSED · MASTRA-V2-005 — Prove Chat Survives Refresh and Server Restart**                             |
|     6 | **PROPOSED · MASTRA-V2-006 — Replace Legacy HITL Compatibility Code With the Current Interrupt Flow**     |
|     7 | **PROPOSED · MASTRA-V2-007 — Return Typed Production Plans Instead of Free-Form Planner Text**            |
|     8 | **PROPOSED · MASTRA-V2-008 — Add Durable Planner Task Tracking and Progress UI**                          |
|     9 | **PROPOSED · MASTRA-V2-009 — Port the Shoot Wizard Workflow With Three Human Approval Gates**             |
|    10 | **PROPOSED · MASTRA-V2-010 — Port Brand Intelligence With Draft Review and Approval**                     |
|    11 | **PROPOSED · MASTRA-V2-011 — Add Traceable Mastra Observability to Every Staging Agent Run**              |
|    12 | **PROPOSED · MASTRA-V2-012 — Add the First Production Planner Regression Eval to CI**                     |

Existing current-runtime tasks such as **IPI-1008 · MASTRA-UPG-003 — Validate and Migrate Mastra PostgreSQL Storage** should remain associated with the existing system rather than being duplicated into the clean rebuild backlog. 

# Bottom line

The Mastra side of the new iPix should be **simpler than the current one**, not more ambitious.

Use the current iPix as the source of proven business logic:

> agents + tools + workflows + Supabase + tests.

Use the current Mastra ecosystem for improved infrastructure:

> built-in task tracking, current HITL, structured output, observability, evals, tool hooks and eventually dynamic workflows.

And keep these out of the first release:

> supervisors, A2A/ACP, browser agents, dynamic user-authored workflows, observational memory, additional vector databases, and autonomous tool-heavy general agents.

That gives you a clean path from **one trustworthy Production Planner → the complete iPix AI operating system**, without rebuilding the strong parts or carrying forward the existing runtime complexity.

[1]: https://mastra.ai/templates?utm_source=chatgpt.com "AI Agent Builder Templates and Starter Kits | Mastra"
[2]: https://mastra.ai/blog/introducing-built-in-tools?utm_source=chatgpt.com "Introducing Built-in Tools for Mastra Agents | Mastra Blog"
[3]: https://mastra.ai/blog/introducing-dynamic-workflows?utm_source=chatgpt.com "Introducing Dynamic Workflows for Mastra | Mastra Blog"
[4]: https://mastra.ai/templates/agent-harness?utm_source=chatgpt.com "Agent Harness | Mastra Templates"
[5]: https://mastra.ai/blog?utm_source=chatgpt.com "Mastra Blog: AI Agents, Workflows, and TypeScript Engineering | Mastra"
