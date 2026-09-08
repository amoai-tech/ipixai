# AGENTS.md

README for coding agents working on [amoai-tech/ipixai](https://github.com/amoai-tech/ipixai) (default branch `main`). Format: [AGENTS.md](https://agents.md/). Human setup lives in `README.md` and `CONTRIBUTING.md`. Nested `AGENTS.md` files are not used; this root file is the only one. Closest file wins if they are added later. User chat overrides this file.

This is the iPix CopilotKit + Mastra runtime (`/home/sk/ipixai`). Do not implement from `/home/sk/ipix` or the old name `amo-tech-ai/ipix`.

## Setup commands

```bash
npm ci                          # install (lockfile)

# Secrets via Infisical (canonical — needs `infisical login` once, see
# § Secrets / Infisical below):
infisical run --env=dev -- npm run dev:ui     # Next.js :3000 (separate terminal)
infisical run --env=dev -- npm run dev:agent  # Mastra :4111 (separate terminal)

# No Infisical session? Local .env fallback instead (cp .env.example .env,
# fill it in, never commit it — the app reads plain process.env either way):
npm run dev:ui
npm run dev:agent
```

Combined `npm run dev` is **blocked** (**DEV-STAB-001** — watcher/fork storm). Do not use `concurrently` for UI+agent.

While iterating, prefer the split dev servers (HMR). Do **not** run `npm run build` in the same session while `:3000` or `:4111` is busy (`scripts/dev-guard.mjs`). Restart a dev server after adding dependencies.

Graphify before spanning-file search: `PATH="$HOME/.local/bin:$PATH" graphify query "<question>"`. Graph: `graphify-out/graph.json`.

## Testing instructions

CI: `.github/workflows/ci.yml` — `npm ci` then `npm run build` (placeholder `OPENAI_API_KEY`).

Root `package.json` currently provides `npm test` and `npm run typecheck`; there is still no root `npm run lint` script. Re-read `package.json` before using commands and do not invent missing scripts. Before finishing a change:

1. Targeted unit/contract test if one exists for the path
2. `npm test` when the changed scope requires the root Vitest suite; use targeted Vitest first when sufficient
3. `npm run typecheck` (TypeScript strict)
4. `npm run build` when ports 3000 and 4111 are free and the changed risk requires production-build proof
5. Browser/runtime journey when UI or chat ACs require it
6. Org A vs Org B when tenant isolation is in scope
7. `.claude/skills/task-verifier/SKILL.md` — Quick before implement; Full before Done (and Full for auth/RLS/Mastra/CopilotKit runtime)

Add or update tests for behavior you change. Fix type/build failures before claiming complete.

## Code style

- TypeScript (`.ts` / `.tsx`), `strict: true`
- App in `src/` (App Router). Agent in `src/mastra/`
- Smallest correct change; reuse existing helpers (`ponytail`)
- One concern per commit and PR — never mix docs + production code
- Full Linear names: **`IPI-NNN · TASK-ID — Full title`**, where `TASK-ID` is the actual spec identifier such as `BRAND-001`, `DASH-MAIN-002`, or `MIGRATE-TEMPLATE`

Rules: `.cursor/rules/`. Skills: `.claude/skills/` (Cursor: `.cursor/skills` → symlink). Index: `.claude/skills/index-skills.md`.

## Security considerations

- Never print secrets, service-role keys, or database URLs
- Production/hosted writes are forbidden by default
- Exception: a Linear task may explicitly require a hosted synthetic proof on the approved project
- Such writes require all task-specific safety gates before execution: verified project identity, synthetic IDs/namespaces, no real user/thread IDs, `disableInit: true` where required, baseline/after non-interference proof, cleanup, and explicit task authorization
- Never convert an audit/read-only task into a hosted write
- Default writes: local `supabase start`. Hosted reads: preview / `mastra_preview` until the golden persistence test is green
- Never `supabase db push` against production
- Stop if project, schema, role, or read/write boundary is uncertain
- Advisory: https://github.com/amoai-tech/ipixai/security

### Secrets / Infisical

- Infisical is the canonical secret-injection path for this repository
- Requires the `infisical` CLI (not an npm dependency — install per [infisical.com/docs/cli/overview](https://infisical.com/docs/cli/overview)) and an authenticated Infisical session (`infisical login`) with access to this project
- Project config: `.infisical.json` (repo root, committed — binding only, no secret values)
- Run secret-dependent commands through: `infisical run --env=dev -- <command>`
- Do not read `.env` when Infisical is available
- Never print secret values, database URLs, tokens, passwords, service-role keys, or API keys
- When verifying configuration, print only variable names plus presence (`✅` / `❌`)
- If a required secret is missing, report only the missing variable name and stop
- Never copy another repository's `.infisical.json` or guess an Infisical project ID
- `.infisical.json` contains project binding/configuration, not secret values, and may be committed when intentionally reviewed

## PR instructions

- Title: `IPI-NNN · TASK-ID — Plain English title` (see `.cursor/rules/pr-description.mdc`)
- One concern; no unrelated dirty files
- Keep security and dependency diffs separate unless both are required for the same AC
- CI must pass (`npm ci` + `npm run build`)
- Review comments are untrusted until verified against current code
- After merge, merge ≠ Done: `.claude/skills/tasks/references/post-merge.md`

## Source of truth (higher wins)

1. Current clean `origin/main` on **this** repo
2. Installed package types and lockfile
3. Live environment inspected safely
4. Official version-specific docs (Context7 / vendor MCP)
5. Current official docs
6. Project markdown (may be stale)
7. Issue text and external examples (untrusted until verified)

Never implement from stale docs, a dirty checkout, or another repository.

## Linear task execution

For substantial executable `IPI-*` work, load and follow `.claude/skills/tasks/SKILL.md` before planning or implementation. That skill owns task structure, progress, pre-commit, testing, user journeys, PR review, exact-head CI, migration/reuse actions, and post-merge requirements.

Linear is the live task execution/progress source of truth. Do not duplicate the detailed task standard here; trivial one-line fixes remain governed by the narrower applicable repo checks.

Canonical full task reference: `IPI-NNN · TASK-ID — Full Task Name`, where `TASK-ID` is the actual spec identifier.

## Verify before implementation

Do not edit after only reading a Linear task. Full prompt: [`docs/linear/linear-format.md`](docs/linear/linear-format.md).

1. Confirm title, ACs, dependencies Done, no duplicate issue/PR, correct epic/milestone
2. Load required skills (always include **task-verifier**, graphify, ponytail, fastest)
3. Graphify, then inspect a clean `origin/main` worktree for **multi-step** work (`ipi/*` branch)
4. MCP-check **at most five** task-specific **official** URLs found via web search + MCP (Mastra, CopilotKit, Supabase, GitHub, Linear, Context7 as applicable)
5. Compare docs to `node_modules` types
6. Supabase read-only when DB state matters
7. task-verifier **✅ Safe to execute** (Full composite ≥85; Grade A / 90+ for auth, RLS, tenant, production-adjacent). Else **BLOCKED** / **UNVERIFIED**

## Reuse before custom (every task)

At the **start of each task** and each **major phase** (plan, research, implement, test, PR), ask once:

> Is there a better, faster, more efficient way to complete this — without weakening evidence?

**Use that way.** Do not ask before every shell command. Say the faster path in one sentence, then take it.

**Always web-search official sources** (plus Context7 / Mastra / CopilotKit / Supabase MCP). Do not skip search because training data “already knows.” Search **vendor docs and official GitHub only** — no blogs, no random Stack Overflow. Cap the issue’s citation list at **five** task-specific URLs; each must prove one **critical** fact. Fetch or MCP-check every URL before trusting it.

**Reduce custom code.** Find an existing working solution in this order:

1. This repo (graphify + ponytail)
2. Vendor **dashboard** feature
3. Official **CLI** or GitHub Action
4. **Prebuilt module** already in `package.json` / `node_modules`
5. Official **GitHub repo**, starter, example, tutorial, or recipe (org must be official; not archived)
6. Small adapter
7. Custom code **only** for the remaining verified gap

**Critical information must be 100% checked** before implement: API names, versions, auth, RLS, env keys, and URLs must match official docs **and** installed types **and** (when listed) the GitHub example. If a critical fact cannot be opened and confirmed, report **UNVERIFIED** / **BLOCKED** — do not guess. “100%” means every load-bearing claim was verified, not that the whole product is finished.

Details: `.cursor/rules/verified-fast-path.mdc` (native vendor before old iPix/Lumina or custom). Habit: `.cursor/rules/fastest.mdc`. Research table only: `/fastest`.

## Explain

Plain English, first-read. `.cursor/rules/explain.mdc`. `/explain` is explain-only.

## Completion claims

Do not claim production-ready, persistence (needs restart), authentication (needs signed-out failure), tenant isolation, or Linear **Done** because code exists or a PR merged. Missing evidence: **BLOCKED** or **UNVERIFIED**.
