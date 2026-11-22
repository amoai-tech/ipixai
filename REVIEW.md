# REVIEW.md

Short briefing for AI and human reviewers. It does **not** replace the source of truth.

## Source of truth

If this file disagrees with another doc, follow the other doc:

| Topic | Authority |
|---|---|
| Agent behavior, verify-before-Done, security | [`AGENTS.md`](AGENTS.md) |
| Human PR / local-dev steps | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Combined `npm run dev` / scripts | [`README.md`](README.md) (**DEV-STAB-001**) |

Keep this file a calibration sheet: severity and what to check. Do not copy full rules here.

## What matters in this repository

- Tenant isolation when auth or tenant data is in scope: queries, CopilotKit threads, and Mastra memory keys stay org-scoped. Org B must never read Org A. For authenticated tenant-scoped Planner data, do not excuse shared `resourceId: "default"`; inspect the actual server-side scope before assigning severity.
- Treat auth, JWT/RPC writes, deletion, and anything that talks to production Supabase as high-risk.
- Smallest explicit fix. PR/commit rules and “do not copy old iPix Mastra wholesale” live in `CONTRIBUTING.md` / `AGENTS.md`.
- Canonical full Linear task references use `IPI-NNN · TASK-ID — Full Task Name`, where `TASK-ID` is the actual identifier, such as `BRAND-001 — Brand profile migration` or `MIGRATE-TEMPLATE — Template migration`; do not require the literal word `SPEC`.

## Severity calibration

Use **only the hosted Code Review labels**; describe security impact in the finding, not as a fourth severity.

- **Important (must fix before merge):** a newly introduced or worsened, reproducible behavior break, cross-tenant data exposure, privilege escalation, secret disclosure, unapproved destructive production write, data loss, missing authorization/validation that enables a real unsafe action, or a retry/idempotency failure with real impact. Cite the changed file/line and the reachable failure.
- **Nit (non-blocking):** cosmetic/style and maintainability suggestions, minor defaults or untested edge cases without demonstrated functional impact. Cap at five Nits, and omit issues CI already enforces.
- **Pre-existing:** a verified bug that is already present on the PR base and not introduced or worsened by this PR. Cite base-versus-head evidence; do not misclassify a new bug as Pre-existing.
- Every **Important** finding must identify the changed file/line, reachable impact, and smallest safe fix. Verify against the current head, not an old PR comment.
- Do not infer a leaked tenant, broken release or missing authorization from naming alone. If evidence is missing, request a targeted proof rather than asserting failure.
- Hosted Claude Code Review reads root `REVIEW.md` with project `CLAUDE.md` on the supported branch setup; local `/code-review` reads `CLAUDE.md` but not `REVIEW.md`. See [official guidance](https://code.claude.com/docs/en/code-review-customize).
- Combined `npm run dev` is disabled until **DEV-STAB-001** is fixed (watcher/fork storm). Do not treat the current block as a regression. Do not treat a PR that *re-enables* combined `dev` as “ignore” — that needs its own review.

## Verification expectations

Follow `AGENTS.md` and `.agents/skills/tasks/references/pre-merge-tests.md` for the current risk-matched verification matrix. Do not maintain a second fixed command list here.

- New business rules need tests that assert the observable result (deny Org B, fail closed when unsigned).
- Database changes need migration coverage and rollback-aware review. Never `supabase db push` to production in a review “fix.”
- UI / chat changes should preserve keyboard and screen reader behavior, and keep history after refresh when that is the contract.
- Merge is not Done; post-merge observable proof is required when claiming Done.
