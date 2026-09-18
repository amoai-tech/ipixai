Use this as the **master Cursor audit prompt**. It is designed to audit the live Supabase project safely in batches instead of dumping 191 tables into one giant report. The current live inventory is **191 total tables / 145 iPix application-runtime tables**, so batching is the right approach. 

# iPix Live Supabase + Codebase Production Audit

You are auditing the current iPix production architecture and live Supabase project.

## Goal

Determine whether the current iPix database, backend, AI runtime, frontend wiring, security model, and product data flows are correct and production-ready.

Do not redesign the system unless evidence proves the existing design cannot satisfy the requirement.

For every finding answer:

1. What exists now?
2. Is it correct?
3. What is wrong or risky?
4. Why does it matter?
5. What is the smallest safe fix?
6. Is there a faster/better approach?
7. How do we verify the fix?
8. Does an existing Linear task already own it?

---

# Mandatory working rules

## Faster/better approach

For every task explicitly ask:

> Is there a better, faster, simpler, or more efficient way to complete this safely?

If yes, use it.

Prefer:

Existing iPix implementation
→ installed dependency/source/types
→ official Supabase/Mastra/CopilotKit feature
→ official CLI/MCP
→ official SDK
→ official GitHub example
→ smallest necessary custom implementation.

Do not over-engineer.

## Safety

This is an **audit first**.

Default to:

* read-only Supabase queries
* read-only MCP
* read-only CLI inspection
* read-only GitHub/code inspection

Do NOT:

* run `supabase db reset --linked`
* run production `db push`
* run `migration repair`
* run `mastra migrate`
* modify production data
* create a second Supabase project
* expose service-role credentials
* print database passwords
* mass-revoke grants/functions
* mass-drop indexes
* automatically add migrations

If a production change is required, document it as a proposed fix first.

Humans decide. AI assists.

---

# Systems / source of truth

Verify these assumptions against the current repository and live system.

Expected:

* Repository: `amoai-tech/ipixai`
* Supabase project: `nvdlhrodvevgwdsneplk`
* Supabase/Postgres owns durable application truth
* Mastra owns agents, workflows, memory and AI runtime persistence
* CopilotKit/AG-UI owns interactive AI streaming/UI
* Cloudinary owns media bytes
* `mastra.*` owns AI runtime persistence
* `shoot.shoots` is canonical shoot truth
* `public.shoots` is legacy unless current code proves otherwise
* organizations / org_members define tenant membership
* consequential AI writes require human approval

Never trust these assumptions blindly. Verify them.

---

# Step 1 — Load skills and tools

Use all relevant installed skills/MCP capabilities before broad manual inspection.

Required where available:

* Supabase skill
* Supabase MCP
* Supabase CLI
* GitHub MCP
* Linear MCP
* Mastra skill
* CopilotKit skill
* task-verifier
* graph/dependency discovery tools
* fastest-proof / Ponytail-style verification tools if installed

Use MCP/CLI rather than scraping dashboards where possible.

Record:

```text
Tool
Connected?
Version
Project/repository
Permission level
Read/write capability
Used for
```

Stop if the Supabase project identity does not equal:

`nvdlhrodvevgwdsneplk`

---

# Step 2 — Verify current official documentation

Before making recommendations, verify current guidance using official sources only.

Search:

## Supabase

* current connection/pooler guidance
* RLS best practices
* Data API security
* Auth security
* leaked-password protection
* database linter/advisors
* SECURITY DEFINER guidance
* indexes / query performance
* pgvector
* Edge Functions
* migrations
* CLI
* local development

## PostgreSQL

* foreign keys
* unique constraints
* partial indexes
* `INSERT ... ON CONFLICT`
* RLS
* triggers/functions
* locking / transaction semantics

## Mastra

* PostgresStore
* `schemaName`
* `disableInit`
* memory
* threads/messages
* workflows
* agents
* suspend/resume
* current installed-version behavior

## CopilotKit / AG-UI

* Mastra integration
* authenticated runtime
* streaming
* thread persistence
* Stop/cancellation
* shared state
* human approval patterns

## GitHub examples

Prefer official maintained repositories/examples.

Do not blindly copy latest examples if the installed package version differs.

Installed package source/types win for exact runtime behavior.

Produce:

```text
Source
Current recommendation
How iPix follows it
Any mismatch
```

Maximum useful sources: 5–10 per major subsystem.

---

# Step 3 — Inspect repository before database assumptions

Start with dependency/path discovery.

Read only load-bearing files first.

Inspect:

```text
package.json
package-lock.json / lockfile
src/mastra/**
src/app/api/copilotkit/**
src/lib/auth/**
src/lib/supabase/**
src/**/supabase*
supabase/config.toml
supabase/migrations/**
supabase/functions/**
.env.example
middleware / proxy
auth callbacks
server actions
API routes
```

Search the repository for:

```text
createClient
createServerClient
service_role
SUPABASE_SERVICE_ROLE
NEXT_PUBLIC_
auth.uid()
auth.jwt()
organization
org_members
resourceId
memoryResourceId
threadId
PostgresStore
schemaName
disableInit
shoot.shoots
public.shoots
rpc(
functions.invoke
channel(
postgres_changes
```

Build a dependency map:

```text
Frontend
  ↓
Next.js route/server action
  ↓
Auth/tenant resolver
  ↓
Supabase / Mastra / RPC
  ↓
Canonical table
```

Flag code paths that bypass the intended ownership boundary.

---

# Step 4 — Establish live database inventory

Connect to the approved live Supabase project using MCP/CLI.

Run read-only catalog queries.

Report exact current numbers for:

* schemas
* base tables
* views
* materialized views
* functions
* SECURITY DEFINER functions
* triggers
* foreign keys
* indexes
* unique constraints
* RLS-enabled tables
* tables without RLS
* RLS policies
* exposed schemas
* extensions
* cron jobs
* realtime publications
* storage buckets
* Edge Functions
* auth users count only if safe/necessary; do not expose identities

Current previous audit found approximately:

```text
191 total base tables

public   84
mastra   34
auth     23
planner  11
realtime 10
shoot     8
talent    8
storage   8
cron      2
supabase_migrations 2
vault     1
```

Do not assume these numbers remain correct.

Recount live.

Output:

| Schema | Tables | Views | Functions | Purpose | Audit priority |
| ------ | -----: | ----: | --------: | ------- | -------------- |

---

# Step 5 — Separate platform-managed vs iPix-owned

Do not waste time deeply auditing Supabase internal schemas like application code.

Classify:

## Platform managed

* auth
* storage
* realtime
* vault
* supabase_migrations
* cron where applicable

Audit only:

* configuration
* exposure
* security integration
* unexpected modifications

## iPix-owned

Audit deeply:

* public
* planner
* shoot
* talent
* mastra

Expected application/runtime total is roughly 145 tables, but recount.

---

# Step 6 — Audit tables in batches

Do NOT audit 145 tables in one pass.

Use batches of roughly 10–20 related tables.

For every table produce:

| Table | Purpose | Owner domain | PK | FKs | Unique | Important indexes | RLS | Policies | Triggers | Used by code? | Status |
| ----- | ------- | ------------ | -- | --- | ------ | ----------------- | --- | -------- | -------- | ------------- | ------ |

Status:

* 🟢 Correct
* 🟡 Improvement needed
* 🔴 Security/correctness blocker
* ⚪ Legacy/unused/unknown

For every batch answer:

```text
What looks correct
Errors
Security risks
Missing relationships
Missing indexes
Duplicate indexes
Potentially unused tables
Legacy overlap
Code ↔ DB wiring problems
Recommended fixes
Faster/better approach
Production impact
```

---

# Batch A — Identity and tenant security

Audit first because everything depends on it.

Tables/features:

```text
auth.users integration
profiles
organizations
org_members
organizer_teams
organizer_team_members
any membership/role helper tables
```

Verify:

* user → profile relationship
* organization ownership
* membership cardinality
* role storage
* tenant isolation
* no authorization based on user-editable metadata
* app_metadata use if JWT authorization exists
* every tenant table has organization ownership
* foreign keys prevent orphaned tenant rows
* RLS uses verified membership
* UPDATE policies have `USING` + `WITH CHECK`
* SELECT policies exist where UPDATE requires them
* no cross-org IDOR
* service-role never exposed to browser
* frontend cannot select arbitrary org ID and gain access

Test conceptual journeys:

```text
Org A user → Org A row = allowed
Org A user → Org B row = denied
anonymous → private row = denied
removed member → private row = denied
```

Score /100.

---

# Batch B — Brand Intelligence / Brand Brain

Identify every related table automatically, including likely:

```text
brands
brand_intake_drafts
brand_scores
brand_competitors
brand_social_channels
brand_crawls
brand_crawl_results
brand_agent_results
brand_graph_nodes
brand_graph_edges
agent_context_snapshots
agent_decision_log
```

Audit real workflow:

```text
Brand URL
→ crawl/research
→ extracted evidence
→ AI draft
→ human review
→ approved Brand DNA
→ saved canonical profile
→ cited retrieval
```

Verify:

* drafts cannot self-promote to approved state
* org ownership
* citations/evidence relationships
* pgvector indexing
* vector similarity never substitutes for authorization
* graph edge FKs/indexes
* duplicate truth sources
* stale draft handling
* audit trail
* idempotency

Create an ERD for this domain.

---

# Batch C — Mastra AI runtime

Audit all `mastra.*` tables as one runtime subsystem but inspect in smaller technical groups:

1. Threads/messages/resources
2. Workflow state/snapshots
3. Memory
4. Agents/tools
5. Schedules/background tasks
6. Evals/datasets/scorers

Verify repository wiring to exact installed Mastra version.

Check:

```text
PostgresStore
schemaName = mastra
disableInit = true
runtime role
connection pool
TLS
transaction pooler compatibility
thread persistence
message persistence
workflow persistence
restart recovery
```

Do not alter Mastra schema because an advisor complains unless installed `@mastra/pg` requires it.

Special check:

`mastra_workflow_snapshot`

Verify actual PK/unique requirements against installed package source.

Do not automatically add a primary key.

Create:

* Mastra runtime ERD
* request/data flow diagram

Example:

```text
CopilotKit
→ Mastra agent
→ PostgresStore
→ mastra_threads
→ mastra_messages
```

---

# Batch D — Planner

Audit all `planner.*`.

Likely areas:

```text
workflows
phases
tasks
dependencies
assignments
gate approvals
gate conditions
instance/member tables
```

Verify:

* FK integrity
* task dependency graph
* cycles prevention if required
* assignment authorization
* approval authorization
* idempotency
* optimistic locking/versioning
* RLS
* realtime policies
* SECURITY DEFINER helpers
* RPC caller authorization

Audit every Planner `SECURITY DEFINER` function individually.

Classify each:

```text
Intentional authenticated API
Internal helper
Should be SECURITY INVOKER
Should revoke authenticated EXECUTE
Needs explicit auth/org check
Unknown
```

Do not mass-revoke.

Create Planner ERD + workflow data flow.

---

# Batch E — Campaigns

Discover campaign-related tables automatically.

Audit journey:

```text
Approved opportunity
→ campaign strategy
→ campaign
→ deliverables
→ shoot planning
→ publishing
```

Check:

* campaign owns strategy/business intent
* shoot owns production execution
* no duplicate campaign/shoot truth
* org/brand relationships
* deliverable ownership
* approval states
* timeline relationships
* KPI fields
* publishing links

Create campaign ERD.

---

# Batch F — Shoot OS

Audit all `shoot.*` deeply.

Compare against legacy:

```text
public.shoots
public.shoot_items
public.shoot_assets
public.shoot_payments
```

Determine from repository references whether each legacy table is:

* still active
* compatibility only
* migration source
* unused
* safe to retire later

Canonical expectation:

`shoot.shoots`

Verify no dual-write.

Audit journey:

```text
AI shoot plan
→ human review/edit
→ approve
→ one idempotent save
→ shoot.shoots
→ shot list
→ crew
→ deliverables
→ assets
```

Hard requirement:

```text
Reject = zero durable shoot writes.
```

Check:

* idempotency
* org ownership
* campaign link
* brand link
* shot relationships
* asset links
* talent links
* status constraints
* indexes
* RLS

Create Shoot ERD + data flow diagram.

---

# Batch G — Talent / Booking

Audit all `talent.*` plus related public RPCs.

Journey:

```text
Search talent
→ shortlist
→ availability
→ booking request
→ approval
→ booking
→ status history
→ saved shoot relationship
```

Check:

* organization authorization
* talent owner/agency relationships
* overlap/date constraints
* double booking
* booking transition rules
* optimistic locking/version
* SECURITY DEFINER authorization
* RLS
* shoot FK
* history immutability

Create ERD.

---

# Batch H — Assets / Cloudinary

Discover:

```text
assets
asset_variants
asset_links
asset_events
cloudinary_assets
shoot.shoot_assets
legacy public.shoot_assets
```

Verify architecture:

```text
Cloudinary = media bytes/transformation truth
Supabase = ownership/metadata/workflow truth
```

Audit:

* public_id uniqueness
* Cloudinary asset linkage
* org/brand/shoot ownership
* approval state
* duplicate asset models
* event history
* versioning
* deletion consistency
* webhook idempotency
* indexes
* RLS

Check `asset_events` duplicate indexes reported by advisors.

Do not remove until workload/dependency verified.

---

# Batch I — Commerce

Discover all:

```text
commerce_*
shopify_*
amazon_*
product*
order*
payment*
```

Verify current architecture documents.

Determine which system owns:

* catalog truth
* inventory truth
* order truth
* payment truth
* product-to-asset links

Flag if Supabase is accidentally becoming duplicate mutable commerce truth.

ERD only for iPix-owned links.

---

# Batch J — Publishing / Social

Audit:

```text
instagram_*
facebook_*
publishing tables
social account tables
campaign publishing links
```

Check:

* encrypted/secure tokens
* org ownership
* account ownership
* refresh/token expiry handling
* no secrets exposed in browser
* idempotent publishing
* publishing approval gate
* status/audit logs

AI must not autonomously publish consequential content unless explicitly approved.

---

# Batch K — CRM / Leads / Chatbot / Notifications

Audit:

```text
crm_companies
crm_contacts
crm_deals
crm_activities
lead_intake_drafts
chatbot_conversations
chatbot_messages
chatbot_events
notifications
notification_reads
```

Investigate live advisor warnings for chatbot tables with RLS but no policies.

Determine whether:

* intentionally inaccessible
* missing policies
* legacy
* backend-only
* incorrectly exposed

Do not assume “RLS with no policy” is wrong; classify intended access.

---

# Batch L — Events / legacy FashionOS

Discover event-related tables.

Do not put cleanup on Core MVP critical path.

Classify each table:

```text
Current iPix dependency
Post-MVP
Legacy but retained
Safe future retirement candidate
Unknown
```

Identify foreign keys from current MVP systems into legacy EventOS tables.

Report cleanup separately.

---

# Step 7 — Relationship audit

Across all iPix-owned tables verify:

## Primary keys

* every application entity has appropriate PK
* UUID consistency where expected
* no accidental nullable identifiers

## Foreign keys

Identify:

* missing FKs
* unindexed FKs
* invalid delete actions
* dangerous cascades
* orphan risks
* cross-schema FK correctness

Do not add every missing FK index automatically.

Prioritize actual query paths.

## Cardinality

Verify:

```text
organization 1:N brands
brand 1:N campaigns
campaign 1:N shoots
shoot 1:N shots
shoot N:M talent where intended
shoot 1:N assets/links
thread belongs to one authorized resource
```

Report any contradictions.

---

# Step 8 — Index audit

For iPix-owned tables find:

* PK indexes
* unique indexes
* foreign-key indexes
* partial indexes
* expression indexes
* vector indexes
* duplicate indexes
* unused indexes
* sequential-scan hot tables where available

Classify:

```text
Required now
Useful after workload evidence
Duplicate
Potentially unused
Mastra/vendor-owned — do not touch
```

Do not bulk-add every advisor-suggested FK index.

Rank fixes by:

1. correctness
2. security
3. user-visible performance
4. measured query frequency

---

# Step 9 — RLS audit

This is a major security audit.

For every iPix-owned table record:

```text
RLS enabled?
SELECT policy
INSERT policy
UPDATE policy
DELETE policy
tenant predicate
auth.uid usage
auth.jwt usage
helper function
policy performance warning
```

Flag:

* RLS disabled on exposed tenant tables
* `TO authenticated` without ownership predicate
* user_metadata authorization
* missing WITH CHECK
* RLS recursion
* SECURITY DEFINER bypass
* broad authenticated grants
* anonymous access
* cross-org lookup possible

Where stable functions are evaluated repeatedly, consider:

```sql
(select auth.uid())
(select auth.jwt())
```

but only after proving policy semantics stay correct.

Create RLS score by domain.

---

# Step 10 — Functions, RPCs and triggers

Inventory all custom functions and triggers.

For each high-risk function:

| Function | Schema | Security mode | Callable by | Writes? | Auth check | Org check | search_path safe? | Recommendation |
| -------- | ------ | ------------- | ----------- | ------- | ---------- | --------- | ----------------- | -------------- |

Prioritize all `SECURITY DEFINER`.

For triggers inspect:

* purpose
* table
* timing
* mutation
* recursion risk
* failure behavior
* whether business logic belongs in explicit transaction/RPC instead

Flag hidden consequential writes.

Human approval should be explicit and observable.

---

# Step 11 — Edge Functions

List every deployed and repository Edge Function.

For each:

```text
Name
Route/purpose
JWT verification
Secrets used
Tables/RPCs accessed
Service role?
Org authorization
Input validation
Idempotency
Timeout/retry
Webhook signature validation
Current frontend/backend caller
Status
```

Look for orphaned functions that no code calls.

Check Firecrawl/webhook processing especially.

---

# Step 12 — Agents and AI workflows

Inventory current:

* Mastra agents
* tools
* workflows
* memory
* retrieval
* approval steps
* data write tools

Produce:

| Agent | Purpose | Inputs | Reads | Writes | Tools | Human approval | Persistent state | UI caller |
| ----- | ------- | ------ | ----- | ------ | ----- | -------------- | ---------------- | --------- |

Verify:

* tenant resource ID correctly propagated
* no arbitrary org ID passed by browser
* tool authorization server-side
* cited evidence for Brand Knowledge
* consequential writes human-approved
* rejects create zero durable product writes
* workflow resumption survives restart where required

---

# Step 13 — Frontend/backend wiring audit

Trace actual user journeys end-to-end.

At minimum:

## Journey 1 — Authentication

```text
Login
→ Supabase Auth
→ session/cookie
→ server validation
→ organization membership
→ protected page
```

## Journey 2 — Planner

```text
Authenticated operator
→ CopilotKit
→ Next.js API
→ tenant resolver
→ Mastra
→ PostgresStore
→ mastra.*
→ replay
```

## Journey 3 — Brand

```text
Brand URL
→ research
→ draft Brand DNA
→ operator edits/reviews
→ approve
→ canonical Brand profile
→ cited retrieval
```

## Journey 4 — Campaign

```text
Opportunity
→ strategy
→ human approval
→ campaign
→ deliverables
```

## Journey 5 — Shoot

```text
Campaign
→ shoot plan
→ human approval
→ shoot.shoots
→ shot list
→ talent
→ assets
```

## Journey 6 — Asset

```text
Upload
→ Cloudinary
→ Supabase metadata
→ analysis
→ approval
→ campaign/product linking
```

For each journey identify:

```text
Frontend component
API/server action
Auth boundary
Agent/workflow
RPC/query
Tables
External service
Approval gate
Failure modes
Verification test
```

Flag dead UI, mocked backend, disconnected tables, or backend capabilities with no frontend.

---

# Step 14 — ER diagrams

Generate Mermaid ER diagrams.

Do not create one unreadable 145-table diagram.

Create separate diagrams:

1. Identity / Organizations
2. Brand Brain
3. Campaign
4. Shoot
5. Talent / Booking
6. Assets / Cloudinary
7. Planner
8. Mastra runtime
9. Commerce links
10. Publishing if sufficiently implemented

Also create one high-level domain ERD:

```text
Organization
  ↓
Brand
  ↓
Campaign
  ↓
Shoot
  ↓
Assets
```

with Talent and Mastra/Planner relationships.

---

# Step 15 — Data-flow diagrams

Generate Mermaid flowcharts/sequence diagrams for:

1. Auth + tenant resolution
2. Planner request and persistent conversation
3. Brand URL → approved Brand DNA
4. Campaign opportunity → strategy
5. Strategy → shoot plan → approval → persisted shoot
6. Shoot asset → Cloudinary → metadata → approval
7. Brand Knowledge retrieval with citations
8. Cross-org denied thread access
9. Concurrent first thread claim

Keep diagrams focused.

---

# Step 16 — Supabase Advisors

Run current:

* security advisors
* performance advisors

Do not paste a raw huge dump.

Group findings:

```text
Critical security
Important security
Performance
Informational
False positive / intentional design
Vendor-managed
Needs investigation
```

Specifically verify:

* RLS enabled but no policies
* leaked-password protection
* SECURITY DEFINER exposure
* extensions in public
* unindexed FKs
* duplicate indexes
* RLS initplan warnings
* Mastra table warnings

Map each relevant issue to existing Linear tasks.

Do not create a new task if an existing one owns it.

---

# Step 17 — Migration audit

Compare:

```text
live schema
supabase_migrations
repository migrations
current main
```

Determine:

* migration history aligned?
* live-only DDL?
* repo-only migrations?
* duplicate migrations?
* stale historical dumps?
* forward migration path safe?

Never fake alignment with migration repair.

Existing ownership likely belongs to:

`IPI-1040 · MIGRATION-001 — Prove New iPix Database Changes Can Be Added Without Replaying Old Migrations`

Verify before stating.

---

# Step 18 — Legacy/duplicate data audit

Find duplicate generations of models.

Examples:

```text
public.shoots vs shoot.shoots
public.shoot_assets vs shoot.shoot_assets
legacy EventOS
duplicate planner/business concepts
old Mastra public tables if any
duplicate asset models
duplicate commerce state
```

For each classify:

| Legacy object | Canonical object | Code still uses? | Data exists? | FK dependents | Recommendation |
| ------------- | ---------------- | ---------------- | ------------ | ------------- | -------------- |

Do not delete.

Create future migration/retirement recommendations only.

---

# Step 19 — Production-readiness scoring

Score /100:

```text
Architecture
Schema design
Relationships
Tenant isolation
RLS
Database privileges
Auth
Mastra persistence
Planner
Brand governance
Shoot governance
Talent/booking integrity
Assets/media
Indexes/performance
Triggers/RPC safety
Edge Functions
Frontend/backend wiring
Migration safety
Observability
Testing
Production verification
Documentation accuracy
```

Then:

```text
Overall production readiness: XX/100
Verification confidence: XX/100
```

Do not invent precision.

Explain deductions over 3 points.

---

# Step 20 — Report errors and fixes

Create one prioritized findings table:

|  # | Severity | Area | Finding | Evidence | Failure mode | Fix | Faster/better approach | Owner task | Verify |
| -: | -------- | ---- | ------- | -------- | ------------ | --- | ---------------------- | ---------- | ------ |

Severity:

* P0 = production/security catastrophe
* P1 = production blocker
* P2 = important MVP issue
* P3 = improvement
* P4 = cleanup/later

Separate facts from assumptions.

---

# Step 21 — Production-ready checklist

Produce a final checklist covering:

## Database

* [ ] canonical tables documented
* [ ] required PK/FK constraints valid
* [ ] critical indexes present
* [ ] no unintended dual writes
* [ ] migration path forward-only

## Security

* [ ] tenant tables RLS-safe
* [ ] no browser service-role
* [ ] SECURITY DEFINER RPCs classified
* [ ] cross-org tests pass
* [ ] leaked-password protection enabled
* [ ] default privileges safe

## Mastra

* [ ] hosted Postgres
* [ ] TLS verified
* [ ] least-privilege runtime role
* [ ] no runtime DDL
* [ ] restart persistence
* [ ] workflow state valid
* [ ] authorized thread isolation

## AI governance

* [ ] AI drafts only when approval is required
* [ ] reject = zero durable consequential writes
* [ ] approved writes idempotent
* [ ] audit trail exists

## Product journeys

* [ ] login
* [ ] Planner
* [ ] Brand DNA
* [ ] Brand Knowledge
* [ ] campaign
* [ ] shoot
* [ ] talent
* [ ] assets
* [ ] publishing where MVP requires it

## Engineering

* [ ] targeted tests
* [ ] typecheck
* [ ] build
* [ ] exact-SHA preview
* [ ] authenticated browser verification
* [ ] CI green

---

# Step 22 — Answer these final questions

Answer decisively:

### Is anything important missing?

List only real missing architecture/tasks/capabilities.

Do not invent work for completeness.

### Is anything built but unnecessary?

Identify over-engineering or premature Advanced features.

### What should be retired later?

List legacy/duplicate systems, but keep them off Core path.

### Will the current architecture succeed?

Give:

```text
Yes / No / Yes with conditions
Confidence: XX/100

Why:
1.
2.
3.

Main blockers:
1.
2.
3.
```

### What is the fastest path to production?

Return:

```text
NOW
1.
2.
3.

NEXT
1.
2.

LATER
1.
2.
```

---

# Required deliverables

Create these report files under an audit folder, without modifying application code:

```text
docs/audit/supabase/
  00-executive-summary.md
  01-live-inventory.md
  02-schema-relationships.md
  03-rls-security.md
  04-functions-triggers-rpcs.md
  05-indexes-performance.md
  06-mastra-runtime.md
  07-brand.md
  08-planner.md
  09-campaign.md
  10-shoot.md
  11-talent.md
  12-assets-cloudinary.md
  13-commerce-publishing.md
  14-edge-functions.md
  15-frontend-backend-wiring.md
  16-legacy-duplicates.md
  17-migrations.md
  18-user-journeys.md
  19-erd.md
  20-data-flows.md
  21-production-readiness.md
  22-errors-fixes.md
```

Do not generate empty filler reports.

If a domain has no meaningful implementation, state:

`Not implemented / no evidence found`

instead of inventing content.

---

# Execution cadence

Do this in stages so context remains manageable.

## Pass 1 — Foundation

Audit:

* repo/dependencies
* live inventory
* schemas
* identity
* RLS
* Mastra
* advisors

Stop and produce a checkpoint.

## Pass 2 — Core product

Audit:

* Brand
* Planner
* Campaign
* Shoot
* Talent
* Assets

Stop and produce a checkpoint.

## Pass 3 — Supporting systems

Audit:

* CRM
* chatbot
* notifications
* commerce
* publishing
* events/legacy
* Edge Functions

## Pass 4 — Cross-system verification

Audit:

* relationships
* frontend/backend wiring
* user journeys
* migration alignment
* legacy overlaps

## Pass 5 — Final certification report

Produce:

* errors/fixes
* scores
* diagrams
* production checklist
* missing items
* fastest production path
* final success verdict

Do not make application or database changes during these audit passes.

---

# Final report format

Start with:

# iPix Supabase Production Audit

**Verdict:**
**Production readiness:** XX/100
**Verification confidence:** XX/100
**Live tables:** XXX
**iPix-owned/runtime tables:** XXX
**P0:** X
**P1:** X
**P2:** X

## Top blockers

| Priority | Problem | Fix | Existing owner |
| -------- | ------- | --- | -------------- |

## What is already correct

Keep concise.

## Critical errors

Keep evidence-based.

## Faster/better approach

State the shortest safe path.

## Production-ready checklist

Use checkboxes.

## Will it succeed?

Give a decisive answer.

## Summary

* Best decision
* Biggest risk
* Missing capability
* Next action

One improvement I strongly recommend: have Cursor **stop after each pass and save evidence to files**, rather than trying to reason about all 145 application/runtime tables in one context window. That will make the audit more accurate and much easier to review.
