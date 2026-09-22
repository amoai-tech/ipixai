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

## 1.1 Readability standard for product-area docs

Product-area docs must be understandable by both an engineer and a product/operator reviewer. Use **plain English first, technical detail second**.

Required writing pattern:

1. Start with a **30-second summary**: what works now, what stays, what improves.
2. Explain important technical terms the first time they appear.
3. Describe user journeys as **what the user does → what iPix does → what success looks like**.
4. For every external repo, state: **Repo → what it teaches → what iPix adapts → where it lands → real iPix example → what we do not copy**.
5. Describe gaps as **Problem → user/business impact → fix**.
6. Describe implementation phases by **outcome**: what becomes true for the user/system after the phase.
7. Add a short **What the user experiences** section around major architecture changes.
8. End domain docs with **Next 3 actions**.
9. Prefer concrete examples from real iPix flows over abstract architecture language.
10. Keep exact files, URLs, versions, tests, and security evidence so the document remains executable.

Default product-area structure:

`30-second summary → Current State → Plain-English Terms → Real User Journeys → What We KEEP → Repo Reuse Map → Exact Adaptation Details → Problem/Impact/Fix → Simple Architecture → Outcome-based Implementation Phases → Tests/Success → Related Linear issues/docs → Next 3 Actions → References`

## 1.2 Core / MVP guardrails

Core and MVP phases must solve the smallest real user journey first. Do not add optional platform sophistication before a concrete product need is proven.

Rules:

1. **KEEP before ADAPT.** If current iPix already solves the need safely, keep it.
2. **One source of truth.** Do not add parallel stores, duplicate APIs, or duplicate state models in MVP.
3. **One happy-path journey first.** Prove the main user flow before edge-case automation.
4. **Defer expensive fallbacks.** Browser automation, advanced RAG, multi-agent orchestration, and elaborate generated UI are later-phase features unless the core journey cannot work without them.
5. **Prefer contracts over frameworks.** Define the small data/interface contract first; add infrastructure only when the contract needs it.
6. **No speculative abstractions.** Do not build generic engines for one current use case.
7. **Use existing auth/RLS/workflows.** Do not replace working security/runtime foundations during domain MVP work.
8. **Ship measurable value per phase.** Each phase should make one user journey clearly better and be independently testable.
9. **Add complexity only from evidence.** A failing test, real production constraint, or repeated product need should justify the next layer.
10. **Document deferred ideas explicitly.** Good ideas that are not MVP belong in Later / Deferred, not in the core implementation path.

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
| Local path | Portable repo-relative path or `<LOCAL_REPOS_ROOT>/...` if an optional external clone is present |
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

- 30-second summary, purpose, and route
- Current-state summary with evidence
- Plain-English terms
- 3–6 primary user journeys
- Existing capabilities to KEEP
- Domain reuse matrix
- Exact adaptation details
- Gaps / failure points / blockers as Problem → Impact → Fix
- Recommended architecture and Mermaid when useful
- Ordered outcome-based implementation phases
- Success criteria and tests
- Related Linear issues/docs
- Next 3 actions
- Full reference URLs

## 6.1 AI-enabled feature contract

When an AI-enabled product/domain doc is created or materially updated, it must reference the canonical [IPIX-AI-FEATURE-PATTERN.md](./IPIX-AI-FEATURE-PATTERN.md) instead of redefining cross-cutting AI architecture. Use the correct relative path from that document (for example, `../00-platform/IPIX-AI-FEATURE-PATTERN.md` from `10-brands/`). Each feature must declare:

- experience owner / interactive surface;
- intelligence owner (Agent responsibility);
- durable truth owner;
- trusted tenant/role boundary;
- internal knowledge sources + provenance;
- Agent / Tool / Workflow choice and why;
- bounded external research requirement, if any;
- controlled GenUI proposal/review surface;
- exact approval point/artifact when consequential;
- trusted server/RPC/transaction write boundary;
- audit/provenance and measurable outcome;
- failure paths: stale, unauthorized, duplicate, timeout, retry, cancellation/recovery;
- observability;
- unit/integration/RLS/browser/live verification appropriate to the risk.

**Rule:** AI proposes → human reviews/edits → trusted server/database revalidates → authorized idempotent action executes → durable result is read back. Browser state, thread IDs, model output, and client tenant hints are not authorization.

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
