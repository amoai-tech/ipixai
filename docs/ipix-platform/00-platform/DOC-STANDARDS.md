# iPix Documentation Standards

**Purpose:** define the minimum structure and evidence required for iPix architecture, feature, reuse, implementation, migration, and test documents.

**Rule:** keep documents small. Split only when a document becomes hard to review or maintain.

## 1. Shared principles

1. **Current state before future state.** Verify existing iPix code, database, routes, tests, and production behavior before proposing replacements.
2. **Evidence before claims.** Link every important external recommendation to an official document, source file, GitHub example, issue, version, or commit.
3. **Prefer reuse over rewrite.** Apply `KEEP / COPY / ADAPT / MODEL / REFERENCE / SKIP` explicitly.
4. **Separate facts from recommendations.** Label observed current behavior, external reference behavior, and proposed iPix changes separately.
5. **Use real user journeys.** Architecture must be explained through concrete workflows, not generic feature lists.
6. **Record versions.** Every version-sensitive claim must state the iPix package version and reference version/commit used for comparison.
7. **Design for failure.** Include retries, aborts, owner loss, idempotency, auth boundaries, stale state, rollback, and observability where relevant.
8. **Make acceptance measurable.** Every plan ends with commands, tests, or production evidence that prove success.
9. **Docs-as-code.** Repo Markdown is the implementation source of truth; Linear is the planning/review mirror.
10. **No duplicated authority.** Link to shared platform rules rather than copying them into every feature document.

## 2. Required source hierarchy

Use references in this order:

`existing iPix → installed package source/types → official docs → official GitHub examples/templates → proven external OSS product → custom implementation`

## 3. Architecture / platform doc

Use for shared runtime, auth, storage, deployment, cross-cutting rules, and major architectural decisions.

**Required sections:**

- Goal and scope
- Current architecture and verified baseline
- Constraints and non-goals
- Context diagram / system boundaries
- Runtime view for important user journeys
- Deployment view
- Cross-cutting concerns: auth, tenancy, storage, retries, observability, security
- Key decisions and alternatives rejected
- Failure modes and recovery
- Version / dependency contract
- Production gates and measurable SLOs
- References with full URLs

**Reference model:** arc42 recommends documenting goals, constraints, context/scope, solution strategy, building blocks, runtime, deployment, and cross-cutting concepts.

- https://arc42.org/overview/
- https://docs.arc42.org/
- https://c4model.com/

## 4. Current-state audit

Use before planning changes to a product area.

**Required sections:**

- Routes and screens
- Components and state
- API routes / RPCs / server actions
- Supabase tables, RLS, functions, triggers, storage
- Mastra agents, tools, workflows, memory/storage
- CopilotKit runtime/hooks/components
- Cloudinary / Stripe / other integrations when applicable
- Existing tests and production evidence
- Known gaps, blockers, and uncertainty

## 5. Reuse matrix

Use to decide what iPix should keep, copy, adapt, model, reference, or skip.

**Required columns:**

| Field | Requirement |
| --- | --- |
| Capability | Concrete feature or user-journey step |
| Current iPix | Existing file/module/table/flow |
| Reference | Repo/example/template name |
| Full URL | Exact GitHub/docs URL |
| Local path | Local clone/source path if present |
| Version/commit | Exact ref used for verification |
| Action | `KEEP / COPY / ADAPT / MODEL / REFERENCE / SKIP` |
| Reuse | Exact code/pattern/idea to take |
| Do not copy | Explicit anti-pattern/scope boundary |
| Verification | `VERIFIED / PARTIAL / UNVERIFIED / HISTORICAL` |
| Product areas | Brands/Talent/Shoots/etc. |

**Rules:**

- `COPY` requires source inspection and version compatibility proof.
- `ADAPT` must name what changes: auth, tenancy, storage, schema, UX, runtime, or domain.
- `MODEL` means architectural/domain inspiration only; no source-code portability assumption.
- `UNVERIFIED` references cannot be implementation authority.
- Prefer one shared global matrix plus small domain-specific subsets.

## 6. Feature / domain doc

Use one main doc per product area initially.

**Required sections:**

- Purpose and route
- Current-state summary with evidence
- 3–6 primary user journeys
- Existing capabilities to KEEP
- Domain reuse matrix
- Gaps / failure points / blockers
- Recommended architecture and Mermaid when useful
- Ordered implementation sequence
- Success criteria and tests
- Related Linear issues/docs
- Full reference URLs

## 7. Implementation plan

Use only after the current state and target design are understood.

**Required header:** goal, architecture, tech stack, source spec, global constraints, review focus.

**For every task include:**

- Exact files to create/modify/test
- Interfaces consumed and produced
- One independently testable deliverable
- Failing test or proof first when code behavior changes
- Minimal implementation step
- Exact verification command and expected result
- Commit boundary
- Dependencies and blockers
- Rollback/feature flag when risk warrants it

Keep tasks small enough that a reviewer can approve or reject each independently.

**Primary internal reference:** Superpowers `writing-plans` workflow used by this repository.

**External review standard:** GitHub recommends standardized contribution context, linked issues, test notes, and checklists for consistent review.

- https://docs.github.com/en/pull-requests/reference/managing-and-standardizing-pull-requests

## 8. Migration / cutover plan

Use when replacing runtime, storage, schemas, workflows, auth boundaries, or other production behavior while preserving users/data.

**Required sections:**

- Source and target architecture
- Scope, assumptions, dependencies, ownership
- Compatibility requirements
- Migration waves/phases
- Pre-migration baseline and backups
- Data/schema/state migration
- Dual-read/write or compatibility strategy when required
- Cutover steps with stop/go gates
- Rollback trigger, procedure, and data consequences
- Active/in-flight work handling
- Security and tenant-isolation validation
- Observability and operational readiness
- Post-cutover smoke tests
- Cleanup/decommission criteria

Migration planning should explicitly track scope, strategy, timeline, dependencies, risks, ownership, cutover, rollback, and operational readiness.

- https://docs.aws.amazon.com/prescriptive-guidance/latest/migration-program-implementation/guidelines.html
- https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-large-scale-migrations/scope-strategy-time.html
- https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-migration-cutover/introduction.html

## 9. Test / acceptance document

Use when a feature or migration needs a durable certification checklist beyond the implementation plan.

**Required sections:**

- User journeys under test
- Preconditions / seeded data / tenant identities
- Frontend behavior
- Backend/API behavior
- Database/RLS behavior
- Agent/workflow behavior
- Failure-path and retry behavior
- Cross-tenant negative tests
- Refresh/reconnect/replay where relevant
- Idempotency / duplicate-delivery checks
- Abort / cancellation checks
- Performance/SLO gates
- Preview/production smoke tests
- Exact commands and evidence capture location

**Rule:** acceptance criteria must be observable. Avoid statements such as "works correctly" without a measurable proof.

## 10. Roadmap / phased delivery doc

Use for sequencing, not for duplicating implementation details.

**Required sections:**

- Outcome
- Dependency graph
- Phase/gate sequence
- Entry criteria for each phase
- Exit criteria for each phase
- Blockers
- Evidence required to proceed
- Links to implementation plans

Roadmaps should say **what becomes true and what proof unlocks the next phase**. Detailed code steps belong in implementation plans.
