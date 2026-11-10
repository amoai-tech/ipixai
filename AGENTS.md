# AGENTS.md

Canonical repository instructions for coding agents working on [amoai-tech/ipixai](https://github.com/amoai-tech/ipixai) (default branch `main`). Format: [AGENTS.md](https://agents.md/). Human setup belongs in `README.md` and `CONTRIBUTING.md`.

**Precedence, highest first:**

1. an explicit instruction from the user in chat — it overrides everything below;
2. the closest `AGENTS.md` to the file being edited. Nested files exist today: `.claude/skills/vercel-react-best-practices/AGENTS.md` governs that skill's subtree, not this root file;
3. **this root file** — the repository-wide agent contract;
4. Claude-specific overlays apply only within their scope and may add Claude-specific detail, but they must not restate or override rules 2–3:
   - `CLAUDE.md` at the repository root — the Claude-only overlay;
   - `.claude/CLAUDE.md` — a directory-scoped file carrying trigger notes (`/graphify`, `/explain`, `/fastest`) — further specializes the root `CLAUDE.md` only for work under `.claude/`;
5. domain `SKILL.md` files, project markdown, then Linear prose — until independently verified against the tiers in [Source of truth](#source-of-truth--higher-wins).

This repository is the iPix CopilotKit + Mastra runtime. Implement here, in `amoai-tech/ipixai`. Do not implement from a different checkout, or from the old repository name `amo-tech-ai/ipix`.

## Feature orientation — intent, spec, plan

Before implementing, **read the exact live Linear issue and verify current code, dependencies, and related PRs**. Then use the relevant portions of [product intent](docs/intent.md), [observable specification](docs/spec.md), and [delivery plan](docs/plan.md) as context; they do not replace current code or issue requirements.

Choose the smallest useful path:
- **Small fix** (local, clear requirements): use Linear + affected code + a short verification checklist. **Do not create** three task files.
- **Normal feature** (existing, sufficient issue): execute its approved Linear plan and relevant domain skills. **Do not duplicate** it in Markdown.
- **Cross-cutting, ambiguous, or multi-session work** with a demonstrated handoff gap: follow [spec-driven task guidance](docs/development/README.md), reusing existing task artifacts if present. Create only the missing intent/spec/plan documents that add material value, based on the reviewed templates, then link them in the **same** Linear issue.

For every path: inspect existing implementation first, make the smallest safe change, run risk-matched verification, and record the current branch/SHA, result, blocker, and exact next action in Linear. **Do not treat draft files as permission for a production write or merge.**

`AGENTS.md` remains the engineering contract, live Linear owns task state and progress, and `.claude/skills/tasks/SKILL.md` remains the only task/PR lifecycle skill.

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
→ synchronize local `main` with `origin/main`
→ verify `main...origin/main = 0 0`
→ real-world certification when required
→ Linear 100% / Done
```

Ownership:

- `tasks` = define and execute substantial work; task structure, progress, PR, generic user-journey and post-merge standards.
- domain skills = implementation HOW for Supabase, Mastra, CopilotKit/AG-UI, Next.js, Cloudinary, etc.
- `task-verifier` = independently challenge WHAT remains unproven; it does not become another implementation lifecycle.
- Linear = live task-specific plan, blocker, evidence, progress, and Done source of truth.
- CI/tests = repeatable automated proof.

`tasks` is the only task/PR lifecycle skill. Do not create parallel lifecycle skills.

## Fastest safe path

At task start and when **blocked or the scope materially changes**, make one quick comparison:

> **Already done?** Check main/PR/Linear. **Reuse?** Existing iPix → installed/official provider → custom only for the gap. **Smallest safe step?** Avoid an unnecessary file/agent/issue/review. **Cheapest decisive proof?** Targeted test first, then domain/E2E only if risk requires it.

Choose the simplest **verified safe** path and record a short reason in the existing Linear task *only when it changes the approach*. If nothing materially improves the plan, execute; do not invent scores, extra reviews or planning artifacts.

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

For a substantial task, follow the existing [mermaid-diagrams skill](.claude/skills/mermaid-diagrams/SKILL.md) and make **one smallest useful diagram pass** for architecture, approval, dependencies, failure/recovery, or other material relationships. Use the diagram to find hidden writes, missing ownership, tenant/auth/HITL gaps, retries, races and missing proof. Do not generate a diagram per file or task section; reuse a diagram unless a new risk requires another. If none adds value, record: `Diagram: N/A — no meaningful relationship/state/sequence to model.`

A diagram clarifies a claim; only tests/runtime evidence prove it. Correct a real blocker before coding.

## Setup commands

```bash
npm ci

# Dotenvx is built into the local scripts
npm run dev:ui     # Next.js :3000
npm run dev:agent  # Mastra :4111

# Coding agents launch with the separate least-privilege .env.agent; app/test env files stay outside the agent process
# First-time local setup: cp .env.agent.example .env.agent
npm run agent:claude
npm run agent:codex
```

Combined `npm run dev` is blocked by **DEV-STAB-001** because of the watcher/fork storm. Do not use `concurrently` for UI + agent.

Do not run `npm run build` while `:3000` or `:4111` is listening (`scripts/dev-guard.mjs`). Restart a dev server after adding dependencies.

Graphify before spanning-file search. `graphify` is a **user-local binary**, not a repository dependency: it lives at `$HOME/.local/bin/graphify` and is invoked with that directory on `PATH`. Treat it as optional infrastructure — if the binary is absent, fall back to targeted `grep`/`glob` reading of the load-bearing paths and record `Graphify: N/A — binary unavailable` rather than stalling. If the binary is present but `graphify-out/graph.json` is absent, build the graph once; **this repository does not ship a prebuilt graph**, so never assume one exists. Then update it after source changes and query it:

```bash
PATH="$HOME/.local/bin:$PATH" graphify .
PATH="$HOME/.local/bin:$PATH" graphify update .
PATH="$HOME/.local/bin:$PATH" graphify query "<question>"
```

Graph: `graphify-out/graph.json` (generated local state; do not commit it).

## Source of truth — higher wins

1. Current clean `origin/main` on this repository.
2. Installed package types and lockfile.
3. Safely inspected live/runtime state, schema, tests, and CI.
4. Official version-specific vendor docs.
5. Current official docs.
6. Project markdown, which may be stale.
7. Unverified prose and external examples; Linear remains authoritative for approved task requirements and progress.

For an implementation-status claim, inspect current code/runtime and relevant test evidence; if proof is incomplete, mark the claim **unverified**. Live Linear is the source of **approved desired outcomes, acceptance criteria, dependencies and progress**; when approved requirements differ from verified behavior, record the gap and resolve it with the task owner rather than discarding either. Never implement from stale docs, a dirty checkout or another repository.

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

For authorized real-browser/identity/tenant QA, consult the [1Password QA guide](docs/development/testing-with-1password.md), which safely adapts the existing local `testing.md` / `ipix-qa-op` workflow. **Run targeted deterministic tests first.** Do not run paid, destructive, production, or real-account write journeys without the existing task approval, correct project/environment, and isolation proofs. Never expose credentials or browser sessions.

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

**`npm test` and `npx vitest run` are not the same check.** `npm test` runs `vitest run`, but npm first executes `pretest`, which is `npm run secrets:check` (`scripts/check-local-secrets.mjs`). `npx vitest run` bypasses that gate entirely. Use `npm test` when you mean "the repository's test gate"; when you use `npx vitest run <path>` for a targeted proof, say so and run `npm run secrets:check` separately at least once before finishing.

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

For data/auth/runtime changes, inspect the *actual* project, schema, role, table/FK, indexes, RLS/policies, RPC grants, `SECURITY DEFINER`, triggers, migrations and relevant security advisories before creating schema or policies.

For local Supabase tasks, first verify the installed CLI can parse the checkout configuration. When it succeeds, use `supabase start` (also exercised in CI fresh replay). If it fails due to the known dotenvx-encrypted `.env.local` conflict, **STOP** and use the proof-specific [local Supabase troubleshooting](docs/development/local-supabase.md); never delete/decrypt secrets or silently substitute an unproven database.

For hosted reads, use the approved non-production target unless the owning Linear task explicitly authorizes a verified production read. Production/hosted writes are forbidden by default **unless** a task specifically authorizes a bounded synthetic proof with verified project identity, isolation, baseline/readback, cleanup and human approval. **Never `supabase db push` against production.** STOP when project, schema, role or read/write authority is uncertain.

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
- Smallest correct change; follow the `ponytail` skill (`.agents/skills/ponytail/SKILL.md`) — reuse what already exists here before writing anything new.
- One concern per commit/PR; do not mix unrelated cleanup.
- Full Linear names: `IPI-NNN · TASK-ID — Full title`, where `TASK-ID` is the real spec identifier such as `BRAND-001`, `DASH-MAIN-002`, or `MIGRATE-TEMPLATE`.

Rules: `.cursor/rules/`. Canonical skill source tree: `.agents/skills/`. Claude discovers shared skills through symlinks under `.claude/skills/` — but **not every canonical skill is exposed, and that is deliberate**: `claude_exposed: true` in the registry marks the skills that get a Claude symlink, and the rest stay `.agents`-only until a Claude workflow needs one (`tests/skill-tree-contract.test.ts` enforces the correspondence, so a missing symlink is not automatically a defect and an unexpected one is). `.cursor/skills` may point at the Claude discovery layer. Registry SSOT: `.agents/skills/registry.json`. The index `.claude/skills/index-skills.md` is generated from that registry; update it with `npm run skills:index`, never by hand.

**One-real-copy rule:** by default, a skill has one real directory in the repository. Shared/cross-agent skills belong in `.agents/skills/<skill>/`; `.claude/skills/<skill>` must be a symlink to that canonical directory. Do not maintain copied skill directories in both trees. Existing iPix/Claude-only skills that have not yet been migrated may remain under `.claude/skills/` temporarily — 17 still do, so treat that as a known backlog rather than a fresh violation. Any other temporary exception must be explicitly approved and documented in the owning task/PR with the authoritative copy, reason, and removal checkpoint; otherwise stop instead of creating a duplicate. New shared skills and migrated skills must use `.agents/skills/` as their real home.

**Vendored skills are hash-locked — do not edit them in place.** `skills-lock.json` records 18 skills vendored from upstream (`testomatio/skills`, `mattpocock/skills`, `DietrichGebert/ponytail`) with a `computedHash`. Reference trees carrying an `UPSTREAM.md` are vendor snapshots too. Edit the upstream source and re-vendor; local edits to a vendored tree invalidate its provenance record and are silently lost on the next sync.

## PR instructions

- Title: `IPI-NNN · TASK-ID — Plain English title`. This is **machine-enforced**: CodeRabbit's pre-merge "Title check" fails the PR and blocks merge when the identifier, the middle dot, the spec identifier, or a plain-English outcome is missing (observed on PR #304). Fix the title; do not argue the check away.
- One coherent concern; no unrelated dirty files.
- Keep security/dependency diffs separate unless both are required for the same acceptance criteria.
- PR description should include summary, faster/better approach, material architecture/user-flow Mermaid, what changed/did not change, tests/evidence, merge STOP conditions, and post-merge actions.
- Exact-head evidence only: after every push, re-check required CI and review findings against the new head.
- Review comments are hypotheses until verified against current code/runtime.
- No unresolved BLOCKER/HIGH before merge.
- Merge ≠ Done. Canonical post-merge rules: `.claude/skills/tasks/references/post-merge.md`.
- After merge, safely synchronize local `main` with `origin/main` before creating the next task branch/worktree; preserve local-only commits first, and do not reset them silently. If synchronization cannot be completed safely — or the fetch itself fails — hand it to the human owner rather than starting the next task on an unverified base.

### Merge authority — human approval is mandatory

An agent may open, update, review and fully prepare a pull request. Merging is a **human action**: an agent hands the pull request back to a human owner for the merge, however green the checks look.

Merging requires all three of the following:

1. **Explicit human approval for that exact head SHA.** Green CI is the precondition for *asking*, not a substitute for approval. An approval given for an earlier revision does not carry to a new push — re-request it.
2. **The PR body's pre-merge checklist reviewed against every original item.** Each item stays present and is marked passed with verified current-head evidence, explicitly N/A or blocked with a reason, or failed. Silently unchecking, deleting or weakening an item is prohibited — the point is that nothing leaves the list unaccounted for.
3. **The PR body's success criteria reviewed the same way,** with every original criterion still present and any unprovable, changed or descoped criterion marked explicitly rather than deleted or weakened.

If any gate cannot be satisfied — including when a required check cannot run because of a tooling or infrastructure failure — leave the PR open, say exactly which item is missing, and hand it back to that human owner. Escalate rather than work around: there is **no agent-side override**, and no emergency path in which an agent merges. The human owner can always merge, so an unavailable gate blocks the merge decision rather than deadlocking the repository.

## Linear task execution

For substantial executable `IPI-*` work, load `.claude/skills/tasks/SKILL.md` before planning or implementation and only the domain skills relevant to the task.

### Linear template routing — mandatory

The existing [tasks skill](.claude/skills/tasks/SKILL.md) owns **all** task creation, templates, PR follow-up and evidence. Search current Linear first; keep a reusable issue rather than creating a duplicate merely to change template metadata.

- Normal feature/fix → `Universal Engineering Task`
- Audit/research only; no implementation → `iPix Task Audit & Implementation Plan`
- Confirmed bug/root-cause repair → `Forensic Error Audit & Fix`
- Production/release certification → `Production Readiness / Release Gate`

Existing-issue decision: when the TASK-ID, user/system outcome and acceptance criteria materially match, update that issue and its history; **do not create a duplicate solely to change template metadata**. Create and link a new issue only for genuinely different scope or completed/canceled historical work. New issues use the actual Linear template field; add the assigned `IPI-NNN` to the title *after* creation.

Before implementation, use one of two explicit paths:
- **Standard path:** verify template/type, project/milestone, dependencies/blockers, relations, observable outcome, acceptance criteria, verification plan, and exact next action.
- **Exception path:** document why an approved template cannot apply; keep the same outcome/evidence fields.

If Linear is temporarily unavailable, use `todo.md` only as a temporary handoff with current proof and next action; **reconcile that handoff back into Linear before marking the issue Done**. Follow the [historical tooling fallback](.claude/skills/tasks/references/linear-tooling-compatibility.md) *only if* the current integration cannot set a template. The live Linear issue and tasks skill still own progress and post-merge certification.

After opening or updating a PR, follow the **PR follow-up loop** in the tasks skill; verify comments against current code, run exact-head gates and require authorized merge approval.

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

## Secrets / Dotenvx

- Dotenvx is the canonical local secret-injection path. The repo pins `@dotenvx/dotenvx`; do not depend on a developer's global version.
- Use the repository scripts as the Dotenvx integration boundary; do not hand-roll an alternate loader. Next.js and non-Next runtimes may use different repository-managed Dotenvx integrations, so verify `package.json` and the lockfile before changing them.
- `.env.local` is the canonical local app/runtime file. Plain `.env` is retired; if a tool recreates it, migrate required names to their owning file and remove it. `.env.legacy-retired` is encrypted rollback-only state and normal app/test scripts do not load it. `.env.test` owns QA/E2E values. `.env.agent` is a separate least-privilege file for coding-agent credentials and starts empty by default.
- Production/deployment secrets remain provider-managed (for example Vercel, GitHub Actions, Supabase, or Cloudflare). Local Dotenvx files are not production secret truth.
- Coding agents must not be launched with the full `.env`/`.env.local`. Use `npm run agent:claude` or `npm run agent:codex`, which load only `.env.agent` and redact exact secret matches from stdout/stderr.
- `--redact` is output protection, not an authorization boundary: the child process can read values loaded into it. Keep `.env.agent` minimal; service-role keys, database credentials, deployment tokens, and production credentials belong to their owning app/test/provider secret paths instead of `.env.agent`.
- If a credential is accidentally committed or exposed in logs, chat, a PR, Linear, or model context, **treat it as compromised**: revoke or rotate it with the provider immediately, stop further use of the exposed value, and notify the human repository owner/security contact. Removing the text alone is not remediation; coordinate any repository-history, cached-view, log, or clone cleanup only after the credential is invalidated.
- Real `.env*` files and `.env.keys` stay gitignored. Private keys must be owner-only (`chmod 600`) and must never appear in chat, logs, PRs, Linear, or model context. A dated backup such as `.env.keys.pre-repair.<stamp>` is a **second, unmanaged copy of the same private keys**: it does not inherit the rule that protects `.env.keys`. Give it `chmod 600` if it must exist at all, delete it once the repair is verified, and never leave it in place as permanent state.
- Never print, echo, `cat`, `dotenvx get`, or otherwise reveal secret values. Verify only variable names + presence.
- Never use `dotenvx run --debug`, `dotenvx decrypt --stdout`, or any command that produces unmasked key/private-key output or otherwise prints secret values in agent or CI logs. Prefer names/presence checks and repository wrappers.
- The legacy Infisical local binding is retired after names-only parity verification. Do not recreate it or use `infisical run` as the local secret path; local injection stays on Dotenvx and deployment secrets stay provider-managed.

### Test credentials (.env.test)

- `.env.test` (gitignored) holds QA credentials (dedicated non-production accounts only) plus test-only settings (`E2E_BASE_URL`, `E2E_SERVER`, opt-in flags); CI uses the same names as GitHub secrets.
- Playwright loads `.env.test` plus canonical `.env.local` through Dotenvx; agents may run tests but must never print, echo, or paste their values.
- Never put passwords/tokens in chat, PRs, Linear, or logs. Use existing QA accounts/session state, or create test users through the normal sign-up flow. If a task seems to need a credential value, stop and ask the user to set it in `.env.test` or CI secrets instead.
- Check presence by name only. Missing → report the name and stop.
- `E2E_BASE_URL` may only be localhost or an iPix Vercel Preview, never Production. If a Production check is needed, ask the user first; the production smoke suite is separate.
- Live-write tests need a dedicated QA brand and explicit approval. The Brand Intelligence journey (`e2e/brand-intelligence-journey.spec.ts`) runs only when `E2E_BRAND_INTEL_ALLOW_WRITES=1` and `E2E_BRAND_INTEL_BRAND_ID` is a valid UUID; otherwise it is skipped.

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
