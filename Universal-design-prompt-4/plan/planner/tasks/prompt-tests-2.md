> **Archive warning — do not execute.** This prompt is a historical snapshot. It names `/home/sk/ipix`, which is not this repository. iPixai work is `amoai-tech/ipixai`. Do not `cd` to the old checkout, fetch, or run audits from these paths.

Act as a **senior Supabase engineer, TypeScript architect, QA lead, and forensic software auditor**.

Audit the merged work for:

* **IPI-476 · Planner schema & reusable engine core**
* **IPI-488 · BE-SD1b — Booking QA seed data + E2E reliability**

Repository:

```text
/home/sk/ipix
```

Required skills:

```text
/home/sk/ipix/.claude/skills/ipix-supabase/SKILL.md
/home/sk/ipix/.claude/skills/task-verifier/SKILL.md
/home/sk/ipix/.claude/skills/gen-test/SKILL.md
/home/sk/ipixai/.claude/skills/tasks/SKILL.md
```

Use Supabase MCP for live schema, migrations, RLS, functions, grants, and advisor checks.

## Scope

### IPI-476 merged PRs

| PR   | Full task name                                                                  | Concern              |
| ---- | ------------------------------------------------------------------------------- | -------------------- |
| #295 | **IPI-476 · PLAN-GRANT — Planner grants, seed backfill & Realtime auth helper** | Migrations           |
| #296 | **IPI-476 · PLAN-VERIFY — Fail-closed planner RLS & scenario probes**           | Verification scripts |
| #297 | **IPI-476 · PLAN-TYPES — Regenerate planner Supabase types**                    | Generated types      |
| #298 | **IPI-476 · PLAN-DOCS — Planner grants/API/types/RLS fix report**               | Documentation        |
| #301 | **IPI-476 · PLAN-TYPES-002 — Pin type-generation schemas + sync helpers**        | Generated types      |
| #305 | **IPI-477 · PLAN-SEED-002 — Org bootstrap for 5-Week Product Shoot**             | Migration + trigger  |
| #307 | **IPI-476 · PLAN-CI-001 — Gate supabase:verify-planner in CI**                   | CI only              |
| #308 | **IPI-476 · PLAN-DOCS-002 — Refresh planner fix report after #305**              | Docs only            |
| #309 | **IPI-476 · PLAN-VERIFY-002 — Standardize app-build on Node 22**                 | CI Node version      |

Expected result:

```text
app/src/types/supabase.ts
```

must include the `planner` schema, tables, enums, relationships, and RPC helpers needed by the operator app.

Expected CI result (post-#307 / #309):

* `booking-gate` runs `npm run supabase:verify-planner` after booking-gate verify
* `app-build` and `booking-gate` both use Node **22**
* Docs in `supabase/docs/ipi-476-planner-fix-report.md` match live seed + CI reality

### IPI-488 merged PRs

| PR   | Full task name                                             | Concern                   |
| ---- | ---------------------------------------------------------- | ------------------------- |
| #288 | **IPI-488 · BE-SD1b — Booking QA seed data**               | Test seed only            |
| #299 | **IPI-488 · BE-SD1b — Booking API E2E reliability probes** | Playwright API tests only |
| #300 | **IPI-488 · BE-SD1b — Linear issue specification**         | Documentation only        |

Expected booking seed contents:

* Organization memberships
* Two talent profiles
* Availability windows for July–September 2026
* One sample booking request

Expected E2E scope:

* `POST /api/bookings`
* `GET /api/bookings`
* Unauthenticated or invalid calls return expected `4xx`
* Never regress to `500`
* With `OPERATOR_AUTH_ENABLED=true`, expect `401`
* With auth disabled, expect validation-related `4xx`
* No `201` happy-path requirement in this task

## Objective

Determine whether the merged implementation is:

* Correct
* Complete
* Reproducible
* Secure
* Properly split by concern
* Consistent with the live Supabase project
* Safe for Planner UI and Booking Wizard QA
* Production-ready

Do not make code changes during the first audit pass.

---

# 1. Establish repository truth

Run:

```bash
cd /home/sk/ipix

cat .claude/skills/ipix-supabase/SKILL.md
cat .claude/skills/task-verifier/SKILL.md
cat .claude/skills/gen-test/SKILL.md
cat .claude/skills/tasks/SKILL.md

git status --short
git branch --show-current
git log --oneline --decorate -30
git worktree list
```

Confirm all merged PR commits are present on `main`.

Inspect:

```bash
gh pr view 295 --json title,state,mergedAt,mergeCommit,files,commits,statusCheckRollup
gh pr view 296 --json title,state,mergedAt,mergeCommit,files,commits,statusCheckRollup
gh pr view 297 --json title,state,mergedAt,mergeCommit,files,commits,statusCheckRollup
gh pr view 298 --json title,state,mergedAt,mergeCommit,files,commits,statusCheckRollup

gh pr view 288 --json title,state,mergedAt,mergeCommit,files,commits,statusCheckRollup
gh pr view 299 --json title,state,mergedAt,mergeCommit,files,commits,statusCheckRollup
gh pr view 300 --json title,state,mergedAt,mergeCommit,files,commits,statusCheckRollup
```

Verify the PR split remained clean:

* #295 migrations only
* #296 scripts only
* #297 generated types only
* #298 docs only
* #288 seed only
* #299 Playwright only
* #300 Linear docs only

Flag any mixed concern.

---

# 2. Verify Supabase project and migration state

Canonical project:

```text
fashionos
nvdlhrodvevgwdsneplk
```

Wrong project:

```text
Fashionosv10
ssmzppgsyqspryggcops
```

Run:

```bash
supabase projects list
cat supabase/.temp/project-ref 2>/dev/null || true

SUPABASE_DB_PASSWORD="$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2-)" \
  supabase migration list --linked
```

Verify these planner migrations are applied remotely:

```text
20260709000000_planner_schema_rls
20260710080000_planner_grants_and_seed_backfill
20260710081000_planner_realtime_auth_helper
20260710082000_planner_broadcast_contributor_only
20260710083000_planner_realtime_uuid_guard
```

Check:

* Local and remote migration history align
* No duplicate planner migrations
* No untracked fetched migrations
* No migration was marked applied without matching live schema
* No historical migration was rewritten after remote application

---

# 3. Verify planner schema and grants

Using Supabase MCP and SQL catalog inspection, verify:

## Tables

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

For every table verify:

* Primary key
* `org_id` ownership
* Foreign keys
* Unique constraints
* Indexes
* `updated_at`
* RLS enabled
* Grants
* Delete behavior

## Grants

Verify:

```sql
select has_schema_privilege('authenticated', 'planner', 'usage');
select has_schema_privilege('service_role', 'planner', 'usage');
```

Verify `authenticated` has the intended CRUD privileges and `service_role` has full required access.

Confirm `anon` has no planner access unless explicitly intended.

Check default privileges for future planner tables and sequences.

---

# 4. Verify planner PostgREST exposure

Confirm remote exposed schemas include:

```text
public,graphql_public,planner
```

Test:

```bash
curl -i \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/workflows?select=id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept-Profile: planner"
```

Expected:

* HTTP 200
* No `PGRST106`
* Empty array or valid workflow row

Flag if `supabase/config.toml` and remote API configuration differ.

---

# 5. Verify generated planner types

Inspect:

```text
app/src/types/supabase.ts
```

Confirm it contains:

```ts
Database["planner"]
```

and generated types for all 10 planner tables.

Also verify generated planner enums and RPCs/helpers, including where applicable:

```text
can_subscribe_instance
can_broadcast_instance
is_assigned
is_at_least
```

Compare generated types against live schema.

Check for:

* Missing schema
* Wrong enum values
* Wrong nullability
* Missing composite foreign keys
* Wrong relationship metadata
* Manually edited generated sections
* Non-deterministic output

Reproduce generation:

```bash
cp app/src/types/supabase.ts /tmp/supabase-types-before.ts
npm run supabase:types
diff -u /tmp/supabase-types-before.ts app/src/types/supabase.ts
```

Expected:

```text
zero diff
```

Flag semantic differences as a blocker.

---

# 6. Verify planner RLS scripts fail closed

Inspect:

```text
scripts/verify-rls.mjs
```

Run:

```bash
infisical run --env=dev -- npm run supabase:verify-rls
```

Confirm the planner probe does **not** skip or falsely pass on:

* `PGRST106`
* Missing schema
* Missing grants
* Empty result caused by setup failure
* Failed profile inserts
* Failed setup rows

Verify tests prove:

* Org A cannot read Org B planner data
* Viewer can read but cannot mutate
* Contributor can mutate only allowed records
* Manager permissions work
* Owner permissions work
* User without org membership is denied
* Invalid writes produce explicit errors
* Mutation tests verify affected row counts
* Profile or membership inserts assert errors
* `23505` is allowed only where idempotency is intended

---

# 7. Verify planner Realtime authorization

Confirm:

* Viewer can subscribe
* Contributor can subscribe and broadcast
* Manager can subscribe and broadcast
* Owner can subscribe and broadcast
* Different organization cannot subscribe
* Viewer cannot insert broadcasts
* Server-side broadcast triggers still work

Inspect:

```text
planner.can_subscribe_instance
planner.can_broadcast_instance
planner_channel_subscribe
planner_channel_broadcast
```

Verify:

* `SECURITY DEFINER` functions use a fixed safe `search_path`
* UUID parsing is guarded
* Invalid topics fail safely
* Topic format is `planner:<instance_uuid>`
* No cross-org data leakage
* Viewer restriction does not block server triggers

Run a two-client Realtime E2E test if credentials are available.

---

# 8. Verify planner seed backfill

Check counts:

```sql
select count(*) from public.organizations;

select count(*)
from planner.workflows
where name = '5-Week Product Shoot';
```

Verify every organization has exactly one template:

```sql
select o.id
from public.organizations o
left join planner.workflows w
  on w.org_id = o.id
 and w.name = '5-Week Product Shoot'
where w.id is null;
```

Expected:

```text
0 rows
```

Check duplicates:

```sql
select org_id, name, count(*)
from planner.workflows
where name = '5-Week Product Shoot'
group by org_id, name
having count(*) > 1;
```

Expected:

```text
0 rows
```

Verify:

* 11 phases per default workflow
* Backfill is idempotent
* Existing customized templates are not overwritten
* New organizations receive or can explicitly bootstrap the template

---

# 9. Verify PlannerEngine

Run:

```bash
cd /home/sk/ipix/app

npm test -- --run src/lib/planner/engine.test.ts
npm run typecheck
npm run lint
npm run build
```

Expected:

```text
27 planner tests pass
```

Audit coverage for:

* Scheduling
* Shift propagation
* Parallel tasks
* Cycle detection
* Self-dependencies
* Missing dependencies
* Gate checks
* Role hierarchy
* Weekend handling
* Invalid dates
* Duplicate task IDs
* Input immutability
* Deterministic output

Flag missing high-risk edge cases.

---

# 10. Verify Booking QA seed

Inspect the seed changes from PR #288.

Confirm the seed adds only:

* Required organization memberships
* Two talent profiles
* Availability windows
* One booking request

Check for:

* Idempotency
* Correct foreign keys
* Valid organization IDs
* No duplicate profiles
* No invalid availability overlaps
* Correct date range bounds
* `expires_at` logically before or relevant to the shoot date
* Valid booking status
* Valid requested date range
* No accidental production-looking data
* No service-role secret or real email exposure
* No dependency on execution order that is undocumented

Verify the availability window includes the booking request date.

Ensure seed reruns safely.

---

# 11. Verify Booking E2E reliability probes

Inspect PR #299 Playwright tests.

Run from repository root:

```bash
cd /home/sk/ipix

npm run test:e2e
```

Also run the exact booking spec directly if available:

```bash
npx playwright test <booking-spec-path>
```

Verify behavior under both modes.

## Auth enabled

```bash
OPERATOR_AUTH_ENABLED=true npm run test:e2e
```

Expected unauthorized requests:

```text
401
```

## Auth disabled

```bash
OPERATOR_AUTH_ENABLED=false npm run test:e2e
```

Expected invalid requests:

```text
400–499 validation response
```

For both modes verify:

* Never `500`
* Response body is valid JSON
* Error response is stable
* GET and POST routes are covered
* No false-positive status ranges
* Tests do not rely on missing auth env
* Tests do not use production credentials
* No `201` happy-path is incorrectly required
* Test names clearly state reliability scope

Flag any test that passes because it accepts nearly every `4xx`.

---

# 12. Verify Booking API routes

Inspect:

```text
app/src/app/api/bookings/
```

Verify:

* Auth guard behavior matches `OPERATOR_AUTH_ENABLED`
* Request validation runs after auth where intended
* Invalid IDs return `400` or `404`, not `500`
* Missing body returns validation error
* Supabase errors are mapped safely
* No internal database error details leak
* No service-role client is exposed to browser code
* Logging avoids secrets and PII
* GET/POST semantics are consistent with tests

---

# 13. Verify Linear documentation

Inspect PRs #298 and #300.

Confirm docs:

* Use relative paths, not machine-specific `/home/sk/...`
* Use correct commands
* Use `cd app` only where required
* Use root `npm run test:e2e` for Playwright
* Use valid Vitest flags
* Point planner verification follow-up to #296
* Describe actual scope, not unimplemented happy paths
* Follow the repository Linear issue template
* Use full task names:

```text
IPI-XXX · TASK-ID — Full Task Name
```

---

# 14. Run complete gates

From repository root:

```bash
cd /home/sk/ipix

npm run supabase:verify
infisical run --env=dev -- npm run supabase:verify-rls
npm run supabase:verify-edge
npm run test:e2e
```

From app:

```bash
cd /home/sk/ipix/app

npm run typecheck
npm run lint
npm test -- --run
npm run build
```

Check Supabase MCP advisors:

* Security Advisor
* Performance Advisor

Do not claim a test passed unless it actually ran.

---

# 14b. Verify PLAN-CI / PLAN-VERIFY / PLAN-DOCS (#307 · #309 · #308)

Audit these three merged PRs as a **CI + docs hygiene** slice (no schema/UI changes). Confirm each PR did exactly one concern and that `origin/main` + Actions prove it.

## 14b.0 Merge inventory (must be MERGED)

```bash
gh pr view 307 --json state,mergedAt,mergeCommit,title,files
gh pr view 309 --json state,mergedAt,mergeCommit,title,files
gh pr view 308 --json state,mergedAt,mergeCommit,title,files

# Expect: state=MERGED; files only:
#   #307 → .github/workflows/ci.yml
#   #309 → .github/workflows/ci.yml
#   #308 → supabase/docs/ipi-476-planner-fix-report.md
```

One-concern check:

| PR | Allowed paths | Fail if |
| -- | ------------- | ------- |
| #307 | `.github/workflows/ci.yml` only | Touches docs, migrations, or `app/` |
| #309 | `.github/workflows/ci.yml` only | Adds planner verify step (that is #307) or docs |
| #308 | `supabase/docs/ipi-476-planner-fix-report.md` only | Touches CI or code |

## 14b.1 Workflow source truth on `origin/main`

```bash
cd /home/sk/ipix
git fetch origin main
git show origin/main:.github/workflows/ci.yml | rg -n 'node-version|verify-planner|verify-booking-gate|PLAN-CI|PLAN-VERIFY'
```

**Pass criteria:**

| Check | Expect |
| ----- | ------ |
| `app-build` Node | `node-version: "22"` (not `"20"`) |
| `booking-gate` Node | `node-version: "22"` |
| Booking step | `npm run supabase:verify-booking-gate` still present |
| Planner step | `npm run supabase:verify-planner` present **after** booking-gate step |
| Secrets on planner step | Same trio: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Comment markers | `# IPI-476 · PLAN-CI-001` and `# IPI-476 · PLAN-VERIFY-002` (or equivalent) |

**Fail if:** planner step missing; planner step on a Node 20 job; `app-build` still on 20; planner step invents new secrets; docs mixed into same commit as CI.

## 14b.2 Local reproducibility (same commands CI runs)

```bash
cd /home/sk/ipix
git checkout origin/main   # or worktree on merge SHA

# Script exists and is wired
rg -n 'supabase:verify-planner' package.json
test -f scripts/verify-planner-scenario.mjs

# Node 22 has native WebSocket (why #309 exists)
node -e 'console.log(process.version, typeof WebSocket)'
# Expect: v22.x.x  function

# Planner scenario + Realtime (needs Infisical / env secrets)
infisical run --env=dev -- npm run supabase:verify-planner
```

**Pass criteria:**

* `package.json` has `"supabase:verify-planner": "node --experimental-strip-types scripts/verify-planner-scenario.mjs"`
* Local `verify-planner` exits **0**
* Output shows scenario + Realtime probes green (create/move/subscribe path — not a silent skip)
* On Node 20, `typeof WebSocket === "undefined"` (documents why app-build must stay on 22)

Optional contrast (prove #309 rationale):

```bash
# if nvm/fnm available
node20 -e 'console.log(typeof WebSocket)'   # undefined
node22 -e 'console.log(typeof WebSocket)'   # function
```

## 14b.3 GitHub Actions evidence (post-merge)

```bash
gh run list --branch main --limit 10 \
  --json databaseId,conclusion,displayTitle,headSha,status,createdAt

# Inspect the run that includes #307 (verify-planner gate)
gh run list --branch main --limit 5 --json databaseId,displayTitle,conclusion,headSha
# Then:
gh run view <RUN_ID> --json jobs --jq '.jobs[] | {name,conclusion}'
gh run view <RUN_ID> --log 2>/dev/null | rg -n 'Planner scenario|verify-planner|Node\.js 22|setup-node|booking-gate' | head -40
```

**Pass criteria:**

| Job | Expect |
| --- | ------ |
| `app-build` | **success** on Node 22 (lint/build/typecheck/test) |
| `booking-gate` | **success** when `DATABASE_URL` secrets configured |
| Planner step log | Contains running `supabase:verify-planner` (not skipped / not missing) |
| `supabase-web015` | Unchanged success (these PRs must not break web015) |

**Fail if:** `booking-gate` green but planner step absent from logs; `app-build` still reports Node 20; planner step fails and was ignored; #308-only push cancelled CI without a later green main run covering #307+#309.

## 14b.4 Docs accuracy (#308) — and staleness after #307/#309

```bash
git show origin/main:supabase/docs/ipi-476-planner-fix-report.md | head -120
rg -n 'missing=0|PLAN-CI-001|PLAN-VERIFY-002|Node 20|verify-planner|734/734|#305|#307|#309' \
  supabase/docs/ipi-476-planner-fix-report.md
```

**Pass criteria for #308 alone (as merged):**

* Mentions org bootstrap / [#305](https://github.com/amo-tech-ai/lumina-studio/pull/305)
* Live seed claim: **missing=0** (or equivalent orgs==defaults)
* Does **not** claim “all orgs still need manual seed”
* Docs-only file path

**Post-#307/#309 consistency check (important):**

After CI PRs merge, the same doc must **not** still say:

* “Wire verify-planner into CI” as an open follow-up, **or**
* “Node 20 still used by app-build” as a remaining deduction

If it still lists PLAN-CI-001 / PLAN-VERIFY-002 as open, record a **P3 docs drift** finding (new tiny PLAN-DOCS follow-up) — do not reopen #308.

## 14b.5 Negative / regression tests

Prove the PRs did **not** break sibling concerns:

```bash
# Booking gate still present and ordered before planner
git show origin/main:.github/workflows/ci.yml | rg -n 'verify-booking-gate|verify-planner'

# Engine + types untouched by these three PRs
git log --oneline origin/main -- app/src/lib/planner/ app/src/types/supabase.ts | head -5
# Recent commits for #307/#308/#309 must NOT touch those paths

# Seed still healthy (depends on #305, not these PRs — sanity)
infisical run --env=dev -- npm run supabase:verify-rls
# Optional SQL via MCP: orgs with default workflow; missing count == 0
```

**Pass criteria:**

* `verify-booking-gate` still runs in CI
* No planner engine / types / migration files in #307/#308/#309 diffs
* RLS verifier still green

## 14b.6 Suggested scorecard (fill during audit)

| Check | PR | Pass? | Evidence |
| ----- | -- | :---: | -------- |
| Merged + one concern | #307 |  | `gh pr view` files |
| `verify-planner` step in workflow | #307 |  | `ci.yml` + Actions log |
| Local `npm run supabase:verify-planner` exit 0 | #307 |  | terminal |
| `booking-gate` CI green with planner step | #307 |  | `gh run view` |
| `app-build` Node 22 in workflow | #309 |  | `ci.yml` |
| `typeof WebSocket === "function"` on CI Node | #309 |  | Node 22 |
| `app-build` CI green on main | #309 |  | Actions |
| Fix report mentions #305 + missing=0 | #308 |  | doc text |
| Fix report not claiming open CI/Node work | #308→main |  | doc vs #307/#309 |
| No mixed concerns | all |  | file lists |

## 14b.7 Exact commands cheat-sheet (copy/paste)

```bash
cd /home/sk/ipix && git fetch origin main

# 1) Source
git show origin/main:.github/workflows/ci.yml | rg -n 'node-version|verify-planner|verify-booking'

# 2) Local planner gate
infisical run --env=dev -- npm run supabase:verify-planner

# 3) Actions
gh run list --branch main --limit 8
gh run view <RUN_ID_AFTER_307> --log | rg 'Planner scenario|verify-planner|Node.js'

# 4) Docs
git show origin/main:supabase/docs/ipi-476-planner-fix-report.md | rg -n 'missing=0|PLAN-CI|PLAN-VERIFY|Node 20|#305|#307|#309'

# 5) One-concern
gh pr diff 307 --name-only
gh pr diff 309 --name-only
gh pr diff 308 --name-only
```

---

# 15. Audit checklist

## IPI-476 checklist

* [ ] All planner migrations applied remotely
* [ ] Planner schema exposed through PostgREST
* [ ] Grants correct
* [ ] RLS enabled on all tables
* [ ] RLS verifier fails closed
* [ ] Cross-org isolation proven
* [ ] Viewer mutation denied
* [ ] Contributor broadcast allowed
* [ ] Viewer broadcast denied
* [ ] Generated planner types reproducible
* [ ] All 27 PlannerEngine tests pass
* [ ] Seed backfill reaches every organization
* [ ] No duplicate default workflows
* [ ] Realtime authorization proven
* [ ] Docs commands are correct
* [ ] **#307** — `booking-gate` runs `supabase:verify-planner` (workflow + Actions log)
* [ ] **#307** — local `infisical run --env=dev -- npm run supabase:verify-planner` exits 0
* [ ] **#309** — `app-build` uses Node 22 (workflow + CI)
* [ ] **#309** — Node 22 exposes native `WebSocket` (`typeof WebSocket === "function"`)
* [ ] **#308** — fix report documents #305 org bootstrap + missing=0
* [ ] **#308→main** — fix report does not still list PLAN-CI-001 / PLAN-VERIFY-002 as open after #307/#309
* [ ] #307 / #308 / #309 each one concern (CI / docs / Node — no mix)
* [ ] `verify-booking-gate` still runs before planner step
* [ ] `supabase-web015` / engine / types untouched by these three PRs

## IPI-488 checklist

* [ ] Seed is idempotent
* [ ] Two talent profiles valid
* [ ] Availability covers July–September 2026
* [ ] Booking request dates are inside availability
* [ ] `expires_at` is logically valid
* [ ] No invalid daterange bounds
* [ ] Auth-enabled E2E returns 401
* [ ] Auth-disabled invalid requests return validation 4xx
* [ ] No booking test returns 500
* [ ] GET and POST are tested
* [ ] Test environment is deterministic
* [ ] Linear spec reflects real scope
* [ ] No happy-path 201 claim is made

---

# 16. Required grading

Use:

* 🟢 `90–100` — Correct and production-ready
* 🟡 `70–89` — Mostly correct; improvements needed
* ⚪ `50–69` — Incomplete or insufficiently proven
* 🔴 `0–49` — Blocked or unsafe

Score:

| Category                            | Score /100 | Dot | Evidence |
| ----------------------------------- | ---------: | :-: | -------- |
| Planner migration correctness       |            |     |          |
| Planner grants and PostgREST access |            |     |          |
| Planner RLS isolation               |            |     |          |
| Planner Realtime security           |            |     |          |
| Planner generated types             |            |     |          |
| PlannerEngine correctness           |            |     |          |
| Planner seed idempotency            |            |     |          |
| Booking seed correctness            |            |     |          |
| Booking E2E reliability             |            |     |          |
| API error handling                  |            |     |          |
| CI and reproducibility              |            |     |          |
| PLAN-CI / Node22 / docs (#307–309)  |            |     |          |
| Documentation accuracy              |            |     |          |
| Production readiness                |            |     |          |
| **Overall**                         |            |     |          |

---

# 17. Required findings

Only list confirmed findings:

| Severity | Dot | Finding | Evidence | Failure risk | Exact correction |
| -------- | :-: | ------- | -------- | ------------ | ---------------- |

Severity:

* P0 — Security breach or data corruption
* P1 — Runtime blocker
* P2 — Important production gap
* P3 — Improvement
* Info — Correct, no action

Separate:

* Confirmed errors
* Red flags
* Missing tests
* Optional improvements

---

# 18. Required correction tasks

Use full task names:

```text
IPI-XXX · TASK-ID — Full Task Name
```

For every required correction provide:

| Task | Problem | Exact files | Correction | Tests | Priority | Blocks production |
| ---- | ------- | ----------- | ---------- | ----- | :------: | :---------------: |

Do not create tasks for already-correct behavior.

---

# 19. Required report

Write the final audit to:

```text
/home/sk/ipix/supabase/docs/ipi-476-ipi-488-final-verification.md
```

Include:

1. Executive verdict
2. Merged PR inventory
3. Commands executed
4. Supabase MCP evidence
5. Migration verification
6. Planner schema/grants/PostgREST results
7. Planner RLS results
8. Realtime results
9. Type-generation results
10. PlannerEngine results
11. Booking seed results
12. Booking E2E results
13. API route results
14. Documentation results
15. CI results
16. PLAN-CI-001 / PLAN-VERIFY-002 / PLAN-DOCS-002 results (#307 / #309 / #308) — see §14b
17. Errors and red flags
18. Missing improvements
19. Scores
20. Required corrections
21. Exact next steps

End with:

```text
Final verdict: [🟢 Production-ready | 🟡 Fixes required | 🔴 Blocked] — [score]/100
```

Answer directly:

1. Is IPI-476 fully working?
2. Is the Planner UI safe to start?
3. Is `app/src/types/supabase.ts` correct and reproducible?
4. Is Planner Realtime secure?
5. Is planner cross-org isolation proven?
6. Is IPI-488 seed safe and idempotent?
7. Do Booking E2E probes catch 500 regressions?
8. Are auth-enabled and auth-disabled expectations correct?
9. Did **#307** gate `verify-planner` in CI (workflow + green Actions log)?
10. Did **#309** put `app-build` on Node 22 with native WebSocket?
11. Did **#308** refresh the fix report for #305 — and is it still accurate after #307/#309?
12. Is anything missing before production?
13. What is the safest next task?
