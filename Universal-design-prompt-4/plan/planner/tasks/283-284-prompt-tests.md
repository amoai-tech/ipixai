> **Archive warning — do not execute.** This prompt is a historical snapshot. It names `/home/sk/ipix`, which is not this repository. iPixai work is `amoai-tech/ipixai`. Do not `cd` to the old checkout, fetch, or run audits from these paths.

Use this prompt in OpenCode or Claude Code:

Act as a **senior Supabase engineer, TypeScript architect, and QA forensic auditor**.

Verify the completed work for:

**IPI-476 · Planner schema & reusable engine core**

Merged PRs:

* **PR #283** — Supabase planner schema and reusable data foundation
* **PR #284** — TypeScript `PlannerEngine`

Repository:

```text
/home/sk/ipix
```

Required skill:

```text
/home/sk/ipix/.agents/skills/ipix-supabase/SKILL.md
```

## Goal

Prove that the planner system works in realistic scenarios, not only through unit tests.

Verify:

1. Database schema correctness
2. Migration status
3. RLS and permission hierarchy
4. Cross-organization isolation
5. Seed idempotency
6. Realtime configuration
7. PlannerEngine correctness
8. Database and engine model alignment
9. Real-world scheduling workflows
10. Production readiness

Do not modify production data or migrations during the audit.

## 1. Inspect merged work

```bash
cd /home/sk/ipix

cat .agents/skills/ipix-supabase/SKILL.md

git status --short
git branch --show-current
git log --oneline --decorate -20

gh pr view 283 --json title,body,state,mergeCommit,files,commits,statusCheckRollup
gh pr view 284 --json title,body,state,mergeCommit,files,commits,statusCheckRollup
```

Confirm both PRs are present on the current branch.

Inspect:

```text
supabase/migrations/
supabase/config.toml
scripts/verify-rls.mjs
app/src/lib/planner/types.ts
app/src/lib/planner/engine.ts
app/src/lib/planner/engine.test.ts
```

## 2. Migration and schema verification

Run:

```bash
supabase projects list

SUPABASE_DB_PASSWORD="$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2-)" \
  supabase migration list --linked
```

Verify the planner migration is applied remotely and exists locally.

Confirm these enums exist:

* Planner workflow status enum
* Planner instance status enum
* Planner task status enum

Confirm these 10 tables exist:

```text
planner.workflows
planner.phases
planner.gate_conditions
planner.instances
planner.tasks
planner.dependencies
planner.assignments
planner.events
planner.view_configs
planner.notification_rules
```

For each table verify:

* Primary key
* Organization ownership
* Foreign keys
* Required columns
* Defaults
* Check constraints
* Useful indexes
* Timestamps
* Delete behavior
* RLS enabled
* No accidental public access

Produce:

| Table | Exists | Keys correct | Indexes correct | RLS enabled | Production-safe |
| ----- | -----: | -----------: | --------------: | ----------: | --------------: |

## 3. PostgREST exposure

Inspect:

```bash
grep -n "planner" supabase/config.toml
```

Confirm the `planner` schema is exposed intentionally.

Verify that exposing the schema does not expose data without RLS.

Test REST visibility using authenticated and anonymous clients.

Expected:

* Anonymous users cannot read planner data.
* Authenticated users only see allowed organization data.
* The schema is available to generated clients after type regeneration.

## 4. Permission hierarchy tests

Verify the hierarchy:

```text
owner > manager > contributor > viewer
```

Inspect:

```text
planner.is_assigned
planner.is_at_least
```

Test each role against realistic operations.

| Action                    | Owner |       Manager      |      Contributor     | Viewer |
| ------------------------- | :---: | :----------------: | :------------------: | :----: |
| Read instance             |   ✅   |          ✅         |           ✅          |    ✅   |
| Edit instance             |   ✅   |          ✅         |        Limited       |    ❌   |
| Create task               |   ✅   |          ✅         | Verify expected rule |    ❌   |
| Update assigned task      |   ✅   |          ✅         |           ✅          |    ❌   |
| Delete workflow           |   ✅   |       Verify       |           ❌          |    ❌   |
| Manage assignments        |   ✅   |          ✅         |           ❌          |    ❌   |
| Manage notification rules |   ✅   | ✅ or expected rule |           ❌          |    ❌   |

Do not assume the intended result. Read the migration and compare it with IPI-476 acceptance criteria.

Test:

* User with no assignment
* Viewer
* Contributor
* Manager
* Owner
* Service role
* User from another organization

## 5. Four-tier RLS forensic tests

Run:

```bash
npm run supabase:verify-rls
```

Inspect the planner section in:

```text
scripts/verify-rls.mjs
```

Verify that it does not produce a false pass when the migration is missing.

Create read-only or transaction-rolled-back SQL tests covering:

### Organization isolation

* Org A cannot read Org B workflows.
* Org A cannot read Org B instances.
* Org A cannot update Org B tasks.
* Org A cannot assign Org B users.
* Org A cannot create dependencies using Org B tasks.

### Role enforcement

* Viewer cannot mutate.
* Contributor cannot perform manager-only actions.
* Manager cannot perform owner-only actions if that distinction is intended.
* Owner can manage the complete instance.

### Assignment scope

* A contributor assigned to Instance A cannot access Instance B unless their organization role permits it.
* Removing an assignment removes assignment-derived access.
* Duplicate assignments are rejected or handled idempotently.

Provide exact evidence for every test.

## 6. Integrity-trigger tests

Verify these triggers:

### Bootstrap owner

On instance creation:

* Creator receives an owner assignment.
* Only one owner bootstrap assignment is created.
* Retrying does not create duplicates.
* Explicit owner assignments do not create conflicting duplicates.
* Cross-organization user IDs are rejected.

### Prevent cross-instance task moves

Test:

* Task cannot be moved from Instance A to Instance B.
* Updating ordinary task fields still works.
* A migration or service-role path cannot accidentally bypass required integrity unless intentionally designed.

### Dependency validation

Test:

* A task can depend on another task in the same instance.
* Cross-instance dependency edges are rejected.
* Self-dependencies are rejected.
* Duplicate edges are rejected or handled safely.
* Circular dependencies are either rejected in the database or clearly delegated to `PlannerEngine`.

State clearly which layer owns cycle prevention.

## 7. Seed idempotency

Verify the per-organization seed for:

```text
5-Week Product Shoot
```

Test in a transaction or safe test organization:

1. Run seed once.
2. Record workflow, phases, tasks, gates and rules.
3. Run seed again.
4. Confirm no duplicates.
5. Run seed for a second organization.
6. Confirm each organization gets an isolated template.
7. Modify an existing seeded template and determine whether reseeding:

   * Preserves user changes
   * Updates canonical values
   * Creates duplicates
   * Fails safely

Verify unique constraints support the claimed idempotency.

Report:

| Test | Expected | Actual | Result |
| ---- | -------- | ------ | ------ |

## 8. Realtime verification

Inspect:

```text
planner.broadcast_instance_change
planner_channel_subscribe
```

Confirm triggers exist on:

```text
planner.instances
planner.tasks
planner.events
planner.assignments
```

Verify:

* Correct topic/channel naming
* Organization or instance isolation
* Unauthorized users cannot subscribe
* Payload does not leak sensitive information
* Inserts, updates and deletes produce expected events
* Trigger failures do not block ordinary writes unexpectedly
* Realtime publication/configuration is complete

Check whether Supabase Realtime Broadcast authorization requires additional setup beyond the SQL policy.

Run a practical test with two authenticated sessions:

* Session A: authorized member of the planner instance
* Session B: user from another organization

Expected:

* Session A receives changes.
* Session B cannot subscribe or receives no events.

## 9. PlannerEngine unit tests

Run:

```bash
cd /home/sk/ipix/app

npm test -- --run src/lib/planner/engine.test.ts
npm run typecheck
npm run lint
npm run build
```

Confirm all 27 tests run and pass.

Do not report only the total repository test count. Report the planner test names and covered behaviors.

Review whether tests cover:

* Initial schedule generation
* Task duration calculations
* Task shifting
* Dependency propagation
* Multiple downstream dependencies
* Parallel tasks
* Cycle detection
* Missing dependency references
* Gate checks
* Role resolution
* Owner/manager/contributor/viewer ordering
* Empty workflow
* Zero-duration tasks
* Negative durations
* Invalid dates
* Repeated task IDs
* Deterministic output
* Input immutability

Identify missing edge cases.

## 10. Database and TypeScript alignment

Compare:

```text
app/src/lib/planner/types.ts
```

against the actual migration enums and columns.

Verify:

* Enum values match exactly
* Optional and nullable fields match
* Date values use a consistent representation
* IDs are consistently typed
* Database snake_case does not silently conflict with TypeScript camelCase
* Permission names match the SQL hierarchy
* Gate-condition operators match persisted values
* Task dependency representation matches the database model

Run or inspect Supabase type generation:

```bash
npm run supabase:types --linked
git diff -- app/src/types/supabase.ts
```

Do not commit changes during this audit.

Flag any mismatch between:

* Handwritten planner types
* Generated Supabase types
* Migration definitions
* PlannerEngine assumptions

## 11. Real-world scenario tests

Create integration-style tests or a safe script for these scenarios.

### Scenario A — 5-week product shoot

Create a planner instance from the seeded template:

```text
Week 1: Creative planning
Week 2: Pre-production
Week 3: Product shoot
Week 4: Post-production
Week 5: Delivery and approval
```

Verify:

* Phases are ordered correctly.
* Tasks inherit correct phase associations.
* Dependencies produce a valid schedule.
* Moving the shoot date shifts downstream tasks.
* Parallel tasks stay parallel.
* Final delivery cannot complete before required gates pass.

### Scenario B — Delayed model booking

Simulate:

* Model booking delayed by three days.
* Dependent fitting and shoot tasks must move.
* Independent tasks must remain unchanged.
* No task moves before its parent dependency.
* Updated dates remain inside or intentionally extend phase boundaries.

### Scenario C — Approval gate failure

Simulate:

* Creative brief gate is not approved.
* Shoot task cannot be considered ready.
* After approval, readiness recalculates correctly.
* Gate checks explain which condition is blocking progress.

### Scenario D — Role permissions

Simulate:

* Owner creates the planner instance.
* Manager edits schedules.
* Contributor updates an assigned task.
* Viewer reads the timeline.
* Unauthorized user from another organization attempts access.

Verify database RLS and `PlannerEngine` permission resolution give compatible answers.

### Scenario E — Dependency cycle

Create:

```text
Task A → Task B → Task C → Task A
```

Expected:

* Engine detects the cycle.
* Error clearly identifies the affected tasks.
* No partial schedule is returned as valid.
* Database behavior is documented if the invalid edges can still be persisted.

### Scenario F — Concurrent updates

Simulate two users shifting the same task.

Determine whether the planner schema has:

* Version columns
* Updated-at conflict checks
* Optimistic locking
* Last-write-wins behavior
* No concurrency protection

Flag this explicitly. A reusable planner will eventually need a defined conflict strategy.

## 12. Missing production concerns

Evaluate whether IPI-476 is missing:

* Optimistic locking/version columns
* Soft deletion or archival
* Workflow versioning
* Template cloning rules
* Audit actor fields
* Realtime payload versioning
* Time zone handling
* Working-day calendars
* Weekend/holiday scheduling
* Duration units
* Partial-day tasks
* Bulk task updates
* Database-level cycle prevention
* Maximum dependency depth
* Notification delivery implementation
* Schema-generated TypeScript types
* Integration tests against live Supabase
* Realtime end-to-end tests
* Performance tests for large workflows
* Indexes for timeline queries
* Explain plans for RLS-heavy queries
* Seed versioning and upgrade strategy

Separate:

* Merge blockers
* Required before planner UI
* Required before production
* Safe future enhancements

## 13. Performance checks

Create representative data:

* 1 workflow
* 10 phases
* 500 tasks
* 1,000 dependencies
* 100 assignments
* 2,000 events

Measure:

* Instance fetch
* Timeline task query
* Dependency fetch
* Assignment permission check
* RLS-filtered task list
* PlannerEngine schedule calculation
* Cycle detection

Use `EXPLAIN (ANALYZE, BUFFERS)` for SQL where safe.

Flag:

* Sequential scans
* Missing composite indexes
* Repeated RLS helper calls
* N+1 application patterns
* Engine complexity that degrades badly with workflow size

## Required scoring

Use:

* 🟢 `90–100` — Production-ready
* 🟡 `70–89` — Mostly correct; improvements needed
* ⚪ `50–69` — Incomplete or insufficiently proven
* 🔴 `0–49` — Unsafe or blocked

Score:

| Category                       | Score /100 | Dot | Evidence |
| ------------------------------ | ---------: | :-: | -------- |
| Schema design                  |            |     |          |
| Migration correctness          |            |     |          |
| RLS and organization isolation |            |     |          |
| Permission hierarchy           |            |     |          |
| Integrity triggers             |            |     |          |
| Seed idempotency               |            |     |          |
| Realtime security              |            |     |          |
| PlannerEngine correctness      |            |     |          |
| Unit-test quality              |            |     |          |
| Real-world workflow behavior   |            |     |          |
| Database/type alignment        |            |     |          |
| Performance                    |            |     |          |
| Production readiness           |            |     |          |
| **Overall**                    |            |     |          |

## Required findings

| Severity | Dot | Finding | Evidence | Failure risk | Exact correction |
| -------- | :-: | ------- | -------- | ------------ | ---------------- |

Severity:

* P0 — Security breach or data corruption
* P1 — Runtime or merge blocker
* P2 — Important production gap
* P3 — Improvement
* Info — Correct; no action

## Required corrections

Use the full task format:

```text
IPI-XXX · TASK-ID — Full Task Name
```

For each correction provide:

| Task | Problem | Files | Exact correction | Tests | Priority | Blocks production |
| ---- | ------- | ----- | ---------------- | ----- | :------: | :---------------: |

Possible task areas:

```text
IPI-XXX · PLAN-DATA-001 — Add Planner Optimistic Locking
IPI-XXX · PLAN-RLS-001 — Add Planner Cross-Organization RLS Tests
IPI-XXX · PLAN-RT-001 — Add Planner Realtime Integration Tests
IPI-XXX · PLAN-ENG-001 — Add PlannerEngine Edge-Case Coverage
IPI-XXX · PLAN-PERF-001 — Add Planner Query Performance Indexes
IPI-XXX · PLAN-SEED-001 — Add Planner Template Seed Versioning
```

Do not create tasks for behavior already proven correct.

## Required final report

Write the audit to:

```text
/home/sk/ipix/supabase/docs/ipi-476-planner-verification.md
```

The report must include:

1. Executive verdict
2. PR #283 verification
3. PR #284 verification
4. Commands executed
5. Schema results
6. RLS results
7. Trigger results
8. Seed results
9. Realtime results
10. Unit-test results
11. Real-world scenario results
12. Performance results
13. Missing production concerns
14. Scores
15. Corrections by task
16. Exact next steps

End with:

```text
Final verdict: [🟢 Working and production-ready | 🟡 Working but improvements required | 🔴 Not ready] — [score]/100
```

Also answer directly:

1. Do PR #283 and PR #284 work together?
2. Do all 27 PlannerEngine tests pass?
3. Does the real database behavior match the engine assumptions?
4. Can two organizations safely use planners without seeing each other?
5. Does the 5-Week Product Shoot seed remain idempotent?
6. Does Realtime work securely?
7. Will realistic delays and dependency shifts calculate correctly?
8. Is IPI-476 ready for the Planner UI work?
9. Is it production-ready?
10. What is the safest next task?
