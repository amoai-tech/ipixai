# iPix Claude Instructions

`AGENTS.md` is the canonical repository-wide agent contract. Follow it first. This file is a concise Claude-specific overlay and must not duplicate or override repository-wide rules unless explicitly stated here.

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
8. Measurable business value

## Claude workflow

For substantial executable work:

```text
live Linear task
→ AGENTS.md
→ .claude/skills/tasks/SKILL.md
→ relevant domain skill(s)
→ Graphify/current-state inspection
→ Mermaid reasoning pass
→ smallest safe implementation
→ cheapest decisive tests
→ task-verifier
→ exact-head PR/CI
→ post-merge exact-main proof
→ Linear Done
```

Do not use deprecated `ipix-task-lifecycle` or `pr-workflow` as the primary workflow.

## Fastest safe path

Before broad code reading:

1. Run `PATH="$HOME/.local/bin:$PATH" graphify query "<question>"` when `graphify-out/graph.json` exists.
2. Inspect only the scoped/load-bearing paths first.
3. Reuse current iPix implementation before creating new code.
4. Check installed package source/types before relying on generic docs.
5. Ask once per major phase: **Is there a faster, simpler, equally reliable solution?**
6. Make the smallest correct change.
7. Run targeted proof before broad suites.

Do not redesign architecture unless evidence proves the current design cannot satisfy the task.

## Mermaid reasoning

For every substantial task, use `.claude/skills/mermaid-diagrams/SKILL.md` as a reasoning gate, not a presentation step.

Claude should:

- diagram verified current state before assuming target architecture;
- diagram target state and material ownership/trust/data boundaries;
- include failure/retry/recovery branches for risky work;
- use each substantive task section/file group to expose the relevant relationship/state/sequence, or record the explicit N/A reason required by `AGENTS.md`;
- use diagrams to look for auth gaps, tenant leaks, hidden writes, HITL bypass, duplicate effects, race conditions, circular dependencies, missing recovery, stale ownership, secret exposure, and missing verification;
- correct the Linear task/plan when a diagram exposes a load-bearing contradiction.

A Mermaid diagram is not evidence by itself. Tests/runtime proof must confirm the real path.

## Source of truth

Use the hierarchy in `AGENTS.md`. In particular, never let stale Linear prose, old project docs, or generic examples override current `origin/main`, installed package types/source, or safely inspected runtime/data truth.

## Architecture reminders

Follow `AGENTS.md` ownership boundaries. Key Claude reminders:

- Supabase/Postgres owns durable application truth where specified.
- RLS plus explicit server/domain authorization protects tenant data.
- Mastra owns agents, tools, workflows, memory/HITL/evals.
- CopilotKit/AG-UI owns the interactive AI experience.
- Cloudinary owns image/video media workflows.
- Browser-supplied IDs are claims until verified server-side.

Never use browser `orgId`, `user_metadata`, or service-role possession as authorization.

## AI governance

**Humans decide. AI assists.**

Consequential actions:

```text
AI proposes
→ human reviews
→ exact approved artifact/action is revalidated
→ authorized idempotent action executes
→ durable result is recorded/read back
```

Do not autonomously publish, pay, delete, or commit sensitive business state.

## Linear

Reference tasks exactly as:

`IPI-XXX · TASK-ID — Full Task Name`

Before implementation:

- re-read live Linear state;
- verify blockers/dependencies;
- inspect current repo/runtime/Supabase truth as applicable;
- correct stale assumptions;
- identify applicable risk classes, Mermaid views, STOP conditions, and proof classes;
- load only the relevant domain skills;
- leave Linear resumable with current status, evidence, blockers, and exact next action.

## Verification

Use the cheapest reliable proof first and follow the risk-specific evidence rules in `AGENTS.md`, `tasks`, the owning domain skill, and `task-verifier`.

Never claim production-ready, persistence, authentication, tenant isolation, HITL safety, or Done without the specific evidence required for that claim. Missing evidence is `BLOCKED` or `UNVERIFIED`.

## Git / task safety

- Work from clean current `origin/main` for substantial multi-step work.
- Make the smallest focused diff.
- Do not mix unrelated cleanup.
- Do not mutate production Supabase unless an explicit Linear task authorizes a guarded synthetic proof under `AGENTS.md` safety rules.
- Never expose secrets.
- After every push, treat older exact-head CI/review evidence as stale until rechecked.
- Merge is not Done; run the required post-merge exact-main proof.

## Graphify

Use:

```bash
graphify query "<question>"
graphify path "<A>" "<B>"
graphify explain "<concept>"
```

Use `graphify-out/wiki/index.md` for broad navigation when present. Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain are insufficient. After modifying code, run `graphify update .` when appropriate to keep the graph current.

## Secrets / Infisical

Follow `AGENTS.md` § Secrets / Infisical as the repository source of truth. Do not duplicate or weaken it here.

## Response style

Get to the point. For engineering work report:

- Result
- Problem / blocker
- Faster/better approach
- Changes
- Verification
- Next action
