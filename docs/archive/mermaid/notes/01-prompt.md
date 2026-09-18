Improve prompt PROJECT SYSTEM MAPPING + MERMAID ANALYSIS

Goal:
Evaluate this project from business goals → users → workflows → data → AI/runtime architecture → deployment, then create the smallest useful set of Mermaid diagrams needed to improve understanding, implementation accuracy, testing, and delivery.

Keep everything concise, practical, and based on real project evidence.

## Step 1 — Understand the project

Identify:

- business purpose
- goals / KPIs
- main users / stakeholders
- user problems
- core workflows
- major features
- key data entities
- AI/agent responsibilities
- integrations
- security boundaries
- deployment/runtime stack

Do not invent details. Mark unknowns clearly.

## Step 2 — Start with one high-level flow

Create one simple overall Mermaid flowchart showing:

Business goal
→ user entry
→ product areas
→ workflows
→ AI / automation
→ data
→ business outcome

It should be understandable in under 30 seconds.

## Step 3 — Choose the right Mermaid diagram types

Use only diagrams that improve understanding or reduce implementation risk.

| Mermaid type | Best use | Development benefit |
|---|---|---|
| Flowchart | Product flow, workflow, dependencies | Prevents missed steps and wrong implementation order |
| User Journey | Real user experience by role | Keeps development aligned with actual user outcomes |
| Sequence Diagram | API, auth, agents, service calls | Exposes integration errors and incorrect call order |
| Architecture Diagram | Whole technical system | Clarifies component ownership and prevents duplicate systems |
| ER Diagram | Database tables and relationships | Reduces schema, foreign-key, and data-model mistakes |
| State Diagram | Status/lifecycle transitions | Prevents invalid states and missing transitions |
| Requirement Diagram | Requirement → implementation → proof | Reduces incomplete work and false “Done” states |
| Gantt | Schedule and dependencies | Improves planning and sequencing |
| GitGraph | Branches, PRs, merges | Reduces Git/release confusion |
| Kanban | Work status | Improves delivery visibility |
| Mindmap | Early discovery / feature structure | Helps organize unclear requirements |
| Timeline | Events/releases/history | Useful for rollout or migration planning |

Do not generate every type.

## Step 4 — Real-world user journeys

Identify the 3–5 most important roles.

For each, create a short real-world flow:

User
→ entry
→ main task
→ AI assistance
→ decision/approval
→ data update
→ business outcome

Give one realistic example per role.

## Step 5 — Business workflows

Map the highest-value workflows.

Examples:

- onboarding
- CRM / sales
- planning
- approval
- production
- fulfillment
- support
- reporting

Show:

trigger
→ actions
→ decisions
→ automation
→ result

## Step 6 — Technical architecture

Create a high-level architecture diagram.

When relevant:

Frontend / App
→ CopilotKit
→ AG-UI
→ Mastra
→ agents / workflows / tools
→ Supabase
→ PostgreSQL
→ pgvector

Deployment:

Client
→ Cloudflare Workers
→ APIs/services
→ data layer

Show only technology actually used.

## Step 7 — AI / agent sequence

If CopilotKit + Mastra are used, create a sequence diagram:

User
→ UI
→ CopilotKit
→ Mastra agent
→ tools
→ Supabase / pgvector
→ response
→ UI

Show when relevant:

- authentication
- authorization
- context/memory
- tool calls
- retrieval
- HITL approval
- errors/retries/fallbacks

## Step 8 — Data model

Create an ER diagram for key entities.

Examples:

users
organizations
memberships
customers
projects
tasks
messages
assets
orders
events
embeddings

For pgvector show:

source entity
→ content/chunks
→ embeddings
→ vector search
→ retrieved agent context

Keep only important relationships.

## Step 9 — State and lifecycle

For important business objects, create state diagrams.

Example:

Draft
→ Review
→ Approved
→ Active
→ Completed
→ Archived

Add rejected, cancelled, failed, retry, or rollback states where real.

## Step 10 — Development dependencies

Create a development dependency flow:

Foundation
→ Auth/Security
→ Data
→ Core Workflows
→ AI
→ UI
→ Integrations
→ Launch

Clearly identify:

- hard blockers
- parallel work
- dependencies
- tasks that should not be combined

## Step 11 — Verification

For critical features create a proof flow:

Requirement
→ implementation
→ targeted test
→ integration test
→ browser/live proof
→ PASS

Use especially for:

- authentication
- tenant isolation
- payments
- AI tool execution
- database writes
- production deployment

## Technology-specific checks

### CopilotKit
Show:
- UI integration point
- runtime boundary
- frontend tools/shared state
- generative UI
- HITL if used

### Mastra
Show:
- agents
- workflows
- tools
- memory
- storage
- retries
- approvals

### Supabase
Show:
- Auth
- PostgreSQL
- RLS
- Realtime
- Storage
- RPC/functions only if actually used

### pgvector
Show:
- source data
- chunking
- embeddings
- storage
- retrieval
- agent context

### Cloudflare Workers
Show:
- request path
- worker/API responsibility
- secrets/environment boundary
- external services
- errors/fallbacks

## Why Mermaid improves development accuracy

Keep this explanation short:

- Makes assumptions visible before coding.
- Exposes missing dependencies.
- Shows incorrect data/service connections.
- Clarifies authentication and security boundaries.
- Prevents scope mixing and duplicate architecture.
- Gives developers and AI agents the same system model.
- Makes requirements easier to test.
- Makes reviews faster.
- Makes failures easier to trace.

Simple principle:

**Less ambiguity → fewer assumptions → fewer implementation errors → better testing → higher probability the system works correctly.**

## Diagram priority

Start broad and go deeper only when useful.

### Level 1 — Understand the business
1. Overall system flowchart

### Level 2 — Understand users
2. User journeys
3. Core business workflows

### Level 3 — Understand implementation
4. Architecture diagram
5. AI/runtime sequence
6. ER/data diagram

### Level 4 — Reduce risk
7. State diagrams
8. Requirement/proof diagrams
9. Security/error flows

Optional only when needed:
Gantt, GitGraph, Kanban, Mindmap, Timeline.

## Faster Better Implementation Path

Before adding another diagram ask:

“Will this diagram expose a decision, dependency, risk, or workflow that is not already clear?”

If no, do not create it.

Use:

High-level map
→ user journeys
→ workflows
→ architecture
→ data/AI
→ risky details
→ verification

Do not start with low-level code diagrams.

## Final output

Return:

### 1. Project summary
- Purpose
- Business goals
- Users
- Core workflows
- Stack

### 2. Recommended diagram plan

| Priority | Diagram type | Purpose | Development benefit |

### 3. Overall Mermaid flowchart

Start here first.

### 4. Real-world user journeys

One per major role.

### 5. Core workflow diagrams

Only high-value workflows.

### 6. Technical architecture

Frontend → AI → data → deployment.

### 7. AI sequence

CopilotKit → Mastra → tools → Supabase/pgvector.

### 8. Data model

Important entities and relationships.

### 9. Risk / verification diagrams

Only where needed.

### 10. Accuracy improvements

Summarize:
- what errors these diagrams help prevent
- what assumptions they exposed
- what implementation decisions became clearer

### 11. Gaps / risks

List:
- unknown requirements
- architectural risks
- security gaps
- missing workflows
- unclear ownership

### 12. Recommended next step

Choose the single highest-value area to drill into next.

Always prefer the smallest set of diagrams that gives the team enough clarity to build correctly.