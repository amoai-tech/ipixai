# AGENTS.md

Canonical repository instructions for coding agents working on [amoai-tech/ipixai](https://github.com/amoai-tech/ipixai) (default branch `main`). Format: [AGENTS.md](https://agents.md/). Human setup belongs in `README.md` and `CONTRIBUTING.md`. This root file is the repository-wide agent contract; user instructions override it. If nested `AGENTS.md` files are added later, the closest file wins for its subtree.

This is the iPix CopilotKit + Mastra runtime (`/home/sk/ipixai`). Do not implement from `/home/sk/ipix` or the old repository name `amo-tech-ai/ipix`.

## Canonical engineering workflow

For every substantial executable `IPI-*` task:

```text
live Linear task
→ .claude/skills/tasks/SKILL.md
→ relevant domain skill(s)
→ verify current origin/main + runtime
→ Mermaid reasoning pass
→ smallest safe implementation
→ cheapest decisive tests
→ task-verifier independently challenges evidence
→ exact-head PR review + CI
→ merge
→ exact-main post-merge proof
→ real-world certification when required
→ Linear 100% / Done
```

Ownership:

- `tasks` = define and execute substantial work; task structure, progress, PR, generic user-journey and post-merge standards.
- domain skills = implementation HOW for Supabase, Mastra, CopilotKit/AG-UI, Next.js, Cloudinary, etc.
- `task-verifier` = independently challenge WHAT remains unproven; it does not become another implementation lifecycle.
- Linear = live task-specific plan, blocker, evidence, progress, and Done source of truth.
- CI/tests = repeatable automated proof.

Deprecated `ipix-task-lifecycle` and `pr-workflow` are compatibility aliases only. Do not use them as the primary workflow for new work.

## Fastest safe path

At task start and each major phase ask once:

> Is there a better, faster, more efficient way to complete this without weakening evidence?

Use that path.

Preferred order:

```text
Graphify / dependency discovery
→ read only load-bearing files
→ existing iPix implementation
→ installed dependency / official feature / CLI / SDK / starter
→ smallest necessary custom change
→ targeted test
→ broader proof only if the risk requires it
```

Do not redesign architecture unless evidence proves the current design cannot satisfy the requirement.

## Mermaid reasoning — required for substantial tasks

Mermaid is an engineering reasoning and defect-prevention tool, not decorative documentation. Follow `.claude/skills/mermaid-diagrams/SKILL.md`.

Every substantial task must perform a diagram pass covering the applicable current state, target state, architecture/ownership, dependencies/blockers, negative/recovery paths, and verification path.

For every substantive task section or file/workflow group, add the smallest useful diagram or explicitly record:

```text
Diagram: N/A — no meaningful relationship/state/sequence to model.
```

Use diagrams to actively look for:

- missing owner or duplicate source of truth;
- browser/client authorization or tenant-trust gaps;
- hidden writes or side effects;
- AI/HITL approval bypass or approval detached from exact artifact/revision/hash;
- duplicate retry/resume/callback effects;
- race conditions or circular dependencies;
- external failures without recovery/rollback;
- stale/deprecated routes, skills, providers, or architecture;
- secret exposure to client/model/memory/snapshot/trace;
- final states with no observable test/readback proving them.

If a load-bearing red flag appears, correct the task/architecture before coding. A diagram defines expected structure; tests/runtime evidence prove actual behavior.

## Setup commands

```bash
npm ci

# Secrets via Infisical — canonical when available
infisical run --env=dev -- npm run dev:ui     # Next.js :3000
infisical run --env=dev -- npm run dev:agent  # Mastra :4111

# Local fallback only when Infisical is unavailable
npm run dev:ui
npm run dev:agent
```

Combined `npm run dev` is blocked by **DEV-STAB-001** because of the watcher/fork storm. Do not use `concurrently` for UI + agent.

Do not run `npm run build` while `:3000` or `:4111` is listening (`scripts/dev-guard.mjs`). Restart a dev server after adding dependencies.

Graphify before spanning-file search:

```bash
PATH="$HOME/.local/bin:$PATH" graphify query "<question>"
```

Graph: `graphify-out/graph.json`.

## Source of truth — higher wins

1. Current clean `origin/main` on this repository.
2. Installed package types and lockfile.
3. Safely inspected live/runtime state, schema, tests, and CI.
4. Official version-specific vendor docs.
5. Current official docs.
6. Project markdown, which may be stale.
7. Linear prose and external examples until independently verified.

Never implement from stale docs, a dirty checkout, another repository, or task prose contradicted by current code/runtime.

## Architecture boundaries

- Supabase/Postgres = durable application truth where specified.
- RLS + explicit server/domain authorization = tenant protection.
- Mastra = agents, tools, workflows, memory orchestration, HITL, evals.
- CopilotKit/AG-UI = interactive AI UX/transport.
- Cloudinary = image/video media workflows.
- Commerce providers = commerce truth where specified.
- GitHub Actions = automated exact-head/exact-main proof.
- Linear = task/evidence/Done source of truth.

Never treat browser `orgId`, `user_metadata`, or service-role possession as authorization.

## Testing instructions

Re-read `package.json` and the changed path before choosing commands; never invent missing scripts.

Use the cheapest reliable proof first:

```text
static inspection
→ targeted unit/contract test
→ targeted integration / SQL / RLS / RPC proof
→ npm test when the root suite is relevant
→ npm run typecheck
→ npm run build when required
→ Playwright/browser journey when required
→ live/runtime proof when required
```

Important proof classes are independent. One cannot substitute for another: authorization, persistence, restart, idempotency/concurrency, model routing, HITL exact-artifact proof, downstream abort, real user journey, and post-merge runtime proof each require their own evidence when in scope.

Before finishing a substantial change:

1. Run the targeted proof for the changed behavior.
2. Run `npm test` when the root suite is relevant.
3. Run `npm run typecheck`.
4. Run `npm run build` when the changed risk or CI requires production-build proof and dev ports are free.
5. Run browser/runtime journey when UI/chat acceptance criteria require it.
6. Run Org A vs Org B proof when tenant isolation is in scope.
7. Run `task-verifier` Standard; Adversarial is automatic for auth/RLS/tenant, consequential AI/HITL, migrations/data integrity, destructive writes, payments/publishing, production/release/config, secrets/webhooks/security-sensitive dependencies, and equivalent Mastra persistence/resume/cancellation/auth risks.

Any BLOCKER or failed required evidence means **BLOCKED / UNVERIFIED**. Never use a numeric score to override a blocker.

## Supabase safety

For tasks touching data/auth/runtime, inspect the existing contract before creating anything:

- project/schema/role identity;
- tables and relationships/FKs;
- indexes;
- RLS/policies;
- RPC/functions/grants;
- `SECURITY DEFINER` behavior;
- triggers;
- Edge Functions when relevant;
- migration/type drift;
- relevant security findings.

Default writes: local `supabase start`. Hosted reads use the approved non-production target unless the task explicitly says otherwise.

Production/hosted writes are forbidden by default. An explicit Linear task may authorize a hosted synthetic proof only with verified project identity, synthetic IDs/namespaces, non-interference baseline/after proof, required guards such as `disableInit: true`, cleanup, and explicit authorization.

Never `supabase db push` against production. Stop if project, schema, role, or read/write boundary is uncertain.

## AI governance

**Humans decide. AI assists.**

Consequential actions follow:

```text
AI proposes
→ human reviews
→ exact approved artifact/action is revalidated server-side
→ authorized idempotent action executes
→ durable result is recorded/read back
```

Do not autonomously publish, pay, delete, or commit sensitive business state.

## Code style

- TypeScript (`.ts` / `.tsx`), `strict: true`.
- App in `src/`; Mastra in `src/mastra/`.
- Smallest correct change; reuse existing helpers such as `ponytail`.
- One concern per commit/PR; do not mix unrelated cleanup.
- Full Linear names: `IPI-NNN · TASK-ID — Full title`, where `TASK-ID` is the real spec identifier such as `BRAND-001`, `DASH-MAIN-002`, or `MIGRATE-TEMPLATE`.

Rules: `.cursor/rules/`. Skills: `.claude/skills/` (`.cursor/skills` symlink). Index: `.claude/skills/index-skills.md`.

## PR instructions

- Title: `IPI-NNN · TASK-ID — Plain English title`.
- One coherent concern; no unrelated dirty files.
- Keep security/dependency diffs separate unless both are required for the same acceptance criteria.
- PR description should include summary, faster/better approach, material architecture/user-flow Mermaid, what changed/did not change, tests/evidence, merge STOP conditions, and post-merge actions.
- Exact-head evidence only: after every push, re-check required CI and review findings against the new head.
- Review comments are hypotheses until verified against current code/runtime.
- No unresolved BLOCKER/HIGH before merge.
- Merge ≠ Done. Canonical post-merge rules: `.claude/skills/tasks/references/post-merge.md`.

## Linear task execution

For substantial executable `IPI-*` work, load `.claude/skills/tasks/SKILL.md` before planning or implementation and only the domain skills relevant to the task.

Before coding:

1. Re-read the live Linear issue, dependencies, blockers, and acceptance criteria.
2. Graphify before broad reading.
3. Inspect a clean current `origin/main` worktree for multi-step work.
4. Verify load-bearing external claims from official sources and installed source/types.
5. Inspect Supabase read-only when DB truth matters.
6. Correct stale task assumptions before implementation.
7. Define applicable risk classes, Mermaid views, STOP conditions, and proof classes.
8. Run `task-verifier` at the risk-matched depth.

Keep Linear updated with verified progress, evidence, blockers, and the exact next action so another agent can resume from the issue alone.

## Reuse before custom

Reduce custom code in this order:

1. This repo (`graphify` + existing code/helpers).
2. Official/vendor dashboard feature.
3. Official CLI or GitHub Action.
4. Installed dependency/module.
5. Official SDK/starter/example/tutorial/recipe from a maintained official repository.
6. Small adapter.
7. Smallest necessary custom implementation.

Critical API names, versions, auth behavior, RLS assumptions, env keys, and URLs must be verified against current official evidence and installed source/types before implementation.

## Secrets / Infisical

- Infisical is the canonical secret-injection path when available.
- Project binding: `.infisical.json`; it must contain configuration only, never secret values.
- Use `infisical run --env=dev -- <command>` for secret-dependent commands.
- Do not read `.env` when Infisical is available.
- Never print secrets, DB URLs, tokens, passwords, service-role keys, or API keys.
- Verify only variable names + presence.
- If a required secret is missing, report the variable name and stop.
- Never copy another repository's Infisical binding or guess a project ID.

## Completion claims

Do not claim production-ready, persistence, authentication, tenant isolation, consequential approval safety, or Linear Done because code exists, a test passes, or a PR merged.

Done requires the observable user/business outcome, risk-matched evidence, exact-head PR proof, and required post-merge exact-main/runtime verification. Missing evidence is **BLOCKED** or **UNVERIFIED**.

## Explain

Use plain English first. Get to the point. For engineering work report:

- Result
- Problem / blocker
- Faster/better approach
- Changes
- Verification
- Next action
