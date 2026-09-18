Dynamic workflows are a strong fit for iPix, but **not as the replacement for your core hard-coded workflows**.

Mastra’s dynamic workflows let you **add, update, delete, and run workflows on a live server without changing or redeploying code**. They are stored as structured JSON, reference already-registered agents/tools by ID, and can be managed over HTTP or the client SDK. Mastra says this requires `@mastra/core >= 1.58.0`. ([Mastra](https://mastra.ai/blog/introducing-dynamic-workflows?utm_source=chatgpt.com "Introducing Dynamic Workflows for Mastra | Mastra Blog"))

## Best iPix dynamic workflow use cases

|#|iPix use case|Real-world example|Why dynamic helps|Phase|Score|
|--:|---|---|---|---|--:|
|1|**Brand-specific shoot SOPs**|“For every Amazon shoot: 8 hero shots → white-background set → QA → client approval”|Each brand can save its own process without a redeploy|Post-MVP|**98/100**|
|2|**Campaign workflow builder**|Marketing manager creates `Research → Concept → Shoot → Review → Publish`|Non-engineers can configure process|Post-MVP|**97/100**|
|3|**Client approval chains**|Luxury client requires producer → creative director → brand manager approval|Approval chain differs by customer|Post-MVP|**96/100**|
|4|**Channel-specific production**|Shopify workflow differs from Amazon/TikTok/Instagram|Reusable channel pipelines|MVP+|**95/100**|
|5|**Event / seasonal production templates**|Black Friday: products → campaign brief → 3 shoots → retouch → ads|Temporary workflow without code deployment|Post-MVP|**94/100**|
|6|**Talent booking SOPs**|Shortlist → availability → rate approval → booking → call sheet|Different agencies/brands can vary steps|Post-MVP|**92/100**|
|7|**Content repurposing pipeline**|Hero photo → crop variants → social assets → marketplace assets|Workflow generated from deliverable requirements|MVP+|**91/100**|
|8|**Agent-generated workflows**|Planner hears “Launch 20 products in 3 weeks” and proposes a workflow|Agent can convert natural-language goals into reusable orchestration|Advanced|**90/100**|
|9|**Operations playbooks**|“If shoot is delayed, notify crew → move booking → reissue call sheet”|Operations team can maintain contingency processes|Advanced|**89/100**|
|10|**Reusable client templates**|Save “Nike Studio Shoot v3” and run it for future campaigns|Versionable repeatable orchestration|Post-MVP|**94/100**|

Mastra’s own workshop specifically describes dynamic workflows as useful for **agent-created orchestration generated from unstructured input that can be inspected, saved, retrieved, and repeatedly run**. ([Mastra](https://mastra.ai/workshops/dynamic-workflows-workshop-2026-08-13?utm_source=chatgpt.com "Build Dynamic Workflows (August 13, 2026) | Mastra Workshops"))

## Best first use for iPix

The strongest use case is:

> **User-defined production templates.**

Example:

```text
Brand: ACME

"Every ecommerce shoot should:
1. read Brand DNA
2. identify product SKUs
3. create Shopify shots
4. create Amazon shots
5. estimate budget
6. request producer approval
7. create shoot
8. notify crew"
```

iPix could turn that into:

```text
ACME Ecommerce Production v1
```

stored as a dynamic workflow.

Next month, ACME changes the process:

```text
Add:
→ TikTok video deliverables
→ client approval before booking
```

The workflow definition changes without redeploying iPix.

That is where dynamic workflows become genuinely valuable.

---

# How they work

Conceptually:

```text
User / Agent / Admin UI
          ↓
Dynamic workflow JSON
          ↓
Mastra storage
          ↓
mastra_workflow_definitions
          ↓
Mastra running server
          ↓
registered agents + tools
          ↓
workflow execution
```

Dynamic workflow graph steps can reference registered:

- agents
    
- tools
    
- mappings
    
- control-flow operations
    

and pass inputs using mapping expressions such as workflow initial data or previous step outputs. ([Mastra](https://mastra.ai/blog/introducing-dynamic-workflows?utm_source=chatgpt.com "Introducing Dynamic Workflows for Mastra | Mastra Blog"))

That is important for security:

> The dynamic workflow can orchestrate approved primitives; it should **not invent unrestricted arbitrary code/tools**.

---

# Feature review

|Feature|iPix value|Score|
|---|---|--:|
|Create workflows without deployment|Very high|**98**|
|Persist definitions in DB|Essential|**97**|
|Update existing workflow|Excellent for client SOP changes|**98**|
|Delete/retire workflows|Useful governance|**90**|
|HTTP API management|Useful for iPix Admin UI|**96**|
|Client SDK workflow API|Good for frontend/admin integrations|**94**|
|Agent/tool graph composition|Excellent|**97**|
|Mapping prior step outputs|Essential|**95**|
|Agent-generated workflow definitions|Powerful but needs controls|**90**|
|Human inspection before activation|Essential for iPix|**99**|

## Where I would not use them

Do **not** dynamically define these initially:

### Shoot Wizard

Keep it code-defined:

```text
deliverables
→ approval
→ shot list
→ approval
→ budget
→ approval
→ commit
```

This is core business logic.

### Brand Intelligence

Keep:

```text
crawl
→ analyze
→ enrich
→ Brand DNA draft
→ approval
→ commit
```

also code-defined initially.

Why?

These need:

- strong tests
    
- predictable schemas
    
- security review
    
- migration history
    
- deterministic HITL
    
- production reliability
    

Mastra workflows already persist step snapshots so workflows can resume after failures; dynamic definitions are an additional authoring capability, not a reason to make everything dynamic. ([Mastra](https://mastra.ai/blog/mastra-workflows-enhanced?utm_source=chatgpt.com "Mastra Workflows, Enhanced | Mastra Blog"))

---

# Recommended architecture

Use two workflow classes:

```text
CODE-DEFINED WORKFLOWS
=
core product guarantees

Shoot Wizard
Brand Intelligence
Booking state transitions
critical writes
```

and:

```text
DYNAMIC WORKFLOWS
=
customer / operator configurable orchestration

Brand SOPs
campaign templates
content pipelines
approval variations
operational playbooks
```

That distinction is the key design decision.

---

# Human approval should be mandatory

For iPix, I would never allow:

```text
AI creates dynamic workflow
→ immediately activates it
→ gets write tools
```

Instead:

```text
User request
↓
AI proposes workflow
↓
Visual workflow preview
↓
Validation
↓
Security/tool-policy check
↓
Human approves
↓
Save definition
↓
Activate
```

This fits the existing iPix principle:

> AI proposes; humans approve important writes.

---

# Dynamic workflow builder UI

This could become a very strong iPix feature.

Example:

```text
┌─────────────────────────────────────┐
│ ACME Ecommerce Production           │
├─────────────────────────────────────┤
│ 1  Analyze Brand DNA                │
│          ↓                          │
│ 2  Build deliverables               │
│          ↓                          │
│ 3  Generate shot list               │
│          ↓                          │
│ 4  Producer approval                │
│          ↓                          │
│ 5  Create shoot                     │
│          ↓                          │
│ 6  Notify crew                      │
│                                     │
│ [Test] [Save Draft] [Publish]       │
└─────────────────────────────────────┘
```

Behind the UI:

```text
CopilotKit
↓
workflow builder
↓
dynamic workflow definition
↓
Mastra.addDynamicWorkflow()
↓
Postgres/Supabase
```

Mastra exposes both single and bulk registration methods—`addDynamicWorkflow()` and `addDynamicWorkflows()`—which is useful when loading or registering saved definitions. ([Mastra](https://mastra.ai/blog/introducing-dynamic-workflows?utm_source=chatgpt.com "Introducing Dynamic Workflows for Mastra | Mastra Blog"))

---

# Important security model

I would introduce three workflow states:

```text
DRAFT
↓
VALIDATED
↓
PUBLISHED
```

And three classes of tools:

```text
READ
search/read brand/products

PROPOSE
create draft/plan

WRITE
booking/update/delete/send
```

Dynamic workflows should be allowed to use READ/PROPOSE automatically.

WRITE should require:

```text
HITL approval
+
server authorization
+
idempotency
```

---

# Versioning is important

Do not overwrite:

```text
ACME workflow
```

silently.

Use:

```text
ACME Ecommerce v1
ACME Ecommerce v2
ACME Ecommerce v3
```

Store:

- creator
    
- organization
    
- status
    
- created_at
    
- published_at
    
- previous version
    
- description
    
- allowed tools
    

Even if Mastra persists the workflow definition, iPix should maintain its own **business-level metadata/ownership** around the definition.

---

# Dynamic workflows + schedules

This combination is particularly useful.

Mastra now lets agents/workflows be scheduled with recurring cron-like schedules. ([Mastra](https://mastra.ai/blog/introducing-schedules-for-agents-and-workflows?utm_source=chatgpt.com "Introducing Schedules for Mastra Agents and Workflows"))

Example:

```text
Every Monday 09:00
↓
Run "Weekly Ecommerce Content Check"
↓
inspect upcoming products
↓
identify missing assets
↓
create proposed shoots
↓
notify producer
```

Or:

```text
48 hours before each shoot
↓
run preflight workflow
↓
verify crew
verify products
verify location
verify call sheet
```

That's a very strong Post-MVP combination.

---

# Dynamic workflows + Temporal

For long-running, critical production workflows, Mastra also supports Temporal-backed workflows, giving durable execution, retries and survival across worker restarts. ([Mastra](https://mastra.ai/blog/introducing-temporal-workflows?utm_source=chatgpt.com "Introducing Temporal Support for Mastra Workflows"))

Use Temporal later for things like:

```text
campaign launch
lasting 3 weeks
multiple external APIs
human approvals
delays
retries
notifications
```

Do **not** introduce Temporal for simple 5-step workflows.

---

# iPix recommended phases

|Phase|Use dynamic workflows?|Score|
|---|---|--:|
|**Core**|No|**20/100 need**|
|**MVP**|Limited templates / proof-of-concept|**65/100**|
|**Post-MVP**|Brand SOPs, campaigns, approvals|**98/100**|
|**Advanced**|Agent-generated workflows, schedules, Temporal|**96/100**|

## Core

Use static workflows:

- Shoot Wizard
    
- Brand Intelligence
    

## MVP+

Prototype:

> Save this production process as a template.

## Post-MVP

Add:

- workflow builder
    
- save/version
    
- publish/unpublish
    
- brand-owned templates
    
- channel pipelines
    
- approval customization
    

## Advanced

Add:

- agent-generated workflows
    
- reusable organization SOP library
    
- schedules
    
- shared workflows
    
- Temporal for critical long-running executions
    

---

# Overall ratings

|Area|Grade|
|---|--:|
|iPix fit|**96/100**|
|Flexibility|**99/100**|
|Developer efficiency|**97/100**|
|Operator usability|**95/100**|
|Enterprise customization|**98/100**|
|Safety without governance|**65/100**|
|Safety with approval/versioning|**94/100**|
|Core MVP necessity|**55/100**|
|Post-MVP value|**98/100**|
|Overall recommendation|**95/100 — A**|

## Reference links

[Dynamic Workflows announcement](https://mastra.ai/blog/introducing-dynamic-workflows?utm_source=chatgpt.com)  
[Dynamic Workflows docs](https://mastra.ai/docs/workflows/dynamic-workflows?utm_source=chatgpt.com)  
[Dynamic workflow definition reference](https://mastra.ai/reference/workflows/dynamic-workflow-definition?utm_source=chatgpt.com)  
[addDynamicWorkflow reference](https://mastra.ai/reference/core/addDynamicWorkflow?utm_source=chatgpt.com)  
[addDynamicWorkflows reference](https://mastra.ai/reference/core/addDynamicWorkflows?utm_source=chatgpt.com)  
[Client SDK workflows API](https://mastra.ai/reference/client-js/workflows?utm_source=chatgpt.com)  
[Server routes reference](https://mastra.ai/reference/server/routes?utm_source=chatgpt.com)

The best iPix use is **not “make every workflow dynamic.”** It is **let brands and operators create reusable production SOPs on top of a small, trusted set of agents/tools, with validation, versioning and human approval before activation.**