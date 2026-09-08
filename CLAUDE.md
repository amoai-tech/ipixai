# iPix Claude Instructions

## Goal

Build iPix as an AI-native operating system for fashion brands.

Optimize for:
1. User value
2. Simplicity
3. Reliability
4. Security
5. Development speed
6. Reuse
7. Maintainability

## Fastest Safe Path

Before coding:
1. Run `PATH="$HOME/.local/bin:$PATH" graphify query "<question>"` before using Read/Grep/Glob/Bash to explore the codebase.
2. Inspect current repo state via the scoped graph, then find existing iPix implementation first.
3. Check installed packages/types before web docs.
4. Read only load-bearing files.
5. Ask: "Is there a faster, simpler, equally reliable solution?"
6. Use the smallest correct change.
7. Run targeted tests before broad tests.

Do not redesign architecture unless evidence proves the current design cannot satisfy the task.

## Source of Truth

Prefer evidence in this order (matches `AGENTS.md` § Source of truth):
1. Current clean `origin/main`
2. Installed package types and lockfile
3. Live environment inspected safely (runtime state, Supabase schema, tests/CI)
4. Official version-specific vendor docs
5. Current official docs
6. Project docs (may be stale)
7. Issue text and external examples (untrusted until verified)

Never treat stale Linear prose or old docs as stronger than checked-out code, installed types, or safely-inspected live state.

## Architecture

- Supabase/Postgres = durable application truth
- RLS + server authorization = tenant protection
- Mastra = agents, workflows, tools, memory
- CopilotKit/AG-UI = interactive AI runtime
- Cloudinary = image/video media
- Vercel = current app hosting

Never use browser `orgId`, `user_metadata`, or service-role credentials for authorization.

## Supabase Preflight

For any task touching data/auth/runtime (default: local `supabase start`; hosted reads: preview / `mastra_preview` until the golden persistence test is green — never production, per `AGENTS.md` § Security considerations):
- connect read-only to the target Supabase project
- verify tables
- relationships/FKs
- indexes
- RLS/policies
- RPC/functions/grants
- SECURITY DEFINER behavior
- triggers
- Edge Functions if relevant
- migration/type drift
- Security Advisor findings

Record: `PASS`, `PASS WITH OWNED FOLLOW-UP`, or `BLOCKED`

Do not create migrations/RPCs/tables until existing contracts are checked first. Stop if the project, schema, role, or read/write boundary is uncertain — do not guess and proceed.

## AI Governance

Humans decide. AI assists.

Consequential writes:
AI proposes → human reviews → approved action executes → result is recorded.

Do not autonomously publish, pay, delete, or commit sensitive business state.

## Implementation

Reuse in this order (matches `AGENTS.md` § Reuse before custom):
existing iPix → vendor dashboard feature → official CLI/GitHub Action → installed dependency → official starter/example/tutorial/recipe → small adapter → smallest custom implementation

Do not rebuild functionality already solved by the stack.

## Verification

Use cheapest reliable proof first:

static inspection → unit test → integration test → typecheck → build → E2E/browser → live runtime proof

"Done" requires observable verification, not just code existing. Do not claim production-ready, persistence, authentication, or tenant isolation without the specific evidence each requires — missing evidence is `BLOCKED` or `UNVERIFIED`, per `AGENTS.md` § Completion claims.

## Git / Task Safety

- Work from clean `origin/main`.
- Make the smallest focused diff.
- Do not mix unrelated cleanup.
- Preserve existing architecture unless proven wrong.
- Never mutate production Supabase (audits, Core work, or otherwise) — the only exception is a Linear task that explicitly authorizes a hosted synthetic proof under all of `AGENTS.md` § Security considerations' safety gates.
- Never expose secrets.

## Linear

Reference tasks as: `IPI-XXX · TASK-ID — Full Task Name`, where `TASK-ID` is the actual spec identifier (for example `BRAND-001`, `DASH-MAIN-002`, or `MIGRATE-TEMPLATE`).

Before implementing a task:
- re-read live Linear state
- verify blockers
- verify current repo/Supabase state
- correct stale task assumptions before coding

## Response Style

Get to the point.

For engineering work report:
- Result
- Problem / blocker
- Faster/better approach
- Changes
- Verification
- Next action

## Secrets / Infisical

Follow `AGENTS.md` § Secrets / Infisical. It is the repository source of truth.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
