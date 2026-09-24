# iPixai skills

Canonical repository skill source tree: `.agents/skills/`. `.claude/skills/` is the Claude discovery/compatibility layer: shared skills should be symlinks to `.agents/skills/<skill>`, not duplicate directories. Cursor may load `.cursor/skills` through the Claude discovery layer.

**One-real-copy rule:** every skill has exactly one real directory. Prefer `.agents/skills/<skill>/` for reusable/cross-agent skills; expose it to Claude with `.claude/skills/<skill> -> ../../.agents/skills/<skill>`. Existing iPix/Claude-only skills may remain under `.claude/skills/` until migrated, but never keep a second copied directory in `.agents/skills/`.

AI runtime SSOT: `docs/copilotkit-mastra/README.md`. Cursor rules: `.cursor/rules/`.

---

## Copied

| Skill | Why |
|-------|-----|
| `mastra` | Agents / Memory / workflows — **2.1.0-ipix.1** overlay on [mastra-ai/skills](https://github.com/mastra-ai/skills) 2.1.0 (`src/mastra`, split `dev:agent`/`dev:ui`, `mastra api`) |
| `copilotkit` | Starter chat, AG-UI, Mastra wiring |
| `ipix-supabase` | Same project `nvdlhrodvevgwdsneplk`; RLS/RPC/CLI refs — **no prod writes** |
| `fashion-production` | Planner / shoot domain language |
| `nextjs-developer` | App Router in `src/app` · **:3000** |
| `shadcn` | UI components |
| `vercel-react-best-practices` | Perf |
| `linear` | IPI issues |
| `tasks` | **Primary iPix task skill** — task setup/execution, agent prompts, pre-commit, testing, PR review, user journeys, CI, migration reuse, and post-merge proof |
| `task-verifier` | **Adversarial independent evidence gate** — Quick narrow checks, Standard task/PR review, automatic Adversarial escalation for high-risk work |
| `brainstorming` | Selected `obra/superpowers` methodology skill — design/intent exploration before creative implementation work |
| `writing-plans` | Selected `obra/superpowers` methodology skill — convert an approved design/spec into executable implementation steps |
| `subagent-driven-development` | Selected `obra/superpowers` methodology skill — execute independent plan tasks with fresh subagents and staged review |
| `dispatching-parallel-agents` | Selected `obra/superpowers` methodology skill — parallelize genuinely independent work |
| `receiving-code-review` | Selected `obra/superpowers` methodology skill — verify review feedback before applying it |
| `requesting-code-review` | Selected `obra/superpowers` methodology skill — request focused review before the iPix PR/Done gates |
| `lean` | Velocity audit |
| `worktrees` | Isolated branches |
| `refactor-plan` | Multi-file refactors |
| `mermaid-diagrams` | Diagrams |
| `ipix-wireframe` | Lo-fi UI |
| `cloudinary` | Canonical iPix Cloudinary skill → embedded official docs/Next/React/transformation/MCP refs + Node refs |
| `graphify` | Official `graphify install` 0.9.48 — query `graphify-out/` |
| `domain-modeling` | Domain language / `CONTEXT.md` / ADR discipline; adapted from Matt Pocock skills |
| `codebase-design` | Deep-module, seam, interface, and test-surface design; adapted from Matt Pocock skills |
| `resolving-merge-conflicts` | Intent-based merge/rebase conflict resolution with iPix high-risk verification |

Official Cloudinary upstream packs are embedded under `.claude/skills/cloudinary/references/official/` and are not separate triggerable skills. Refresh snapshots into a temporary directory, then sync only the needed embedded references so the iPix security overlay remains authoritative.

## Not copied (on purpose)

| Skill | Why |
|-------|-----|
| `cloudflare-ipix` | No Workers/OpenNext in iPixai |
| `cloudflare-workflow` | Same |
| `cloudflare-workers-testing` | Same |
| `gemini` | Starter is OpenAI until a provider ticket |
| `graphify` (old iPix copy) | Replaced by official Graphify-Labs install |
| `pr-agent` | Old `lumina-studio` CI / Bedrock job |
| `design-to-production` | DESIGN V2 / old operator HTML parity |

Also not copied from the wider old catalog: `mercur`, `amazon-bedrock`, `ipix` router, `react-patterns`, `nextjs-16`, `frontend-design`, archive/*.

## Path fixes applied

- Mastra: `src/mastra/`, `projectPath` = git toplevel, no Gemini/CF `getMastra()` contract
- Next: port 3000, `src/app/`
- Supabase: preview-first, do not `cd /home/sk/ipix` from this repo
- CopilotKit: `ipix-production.md` is old-app notes
- Task execution and PR lifecycle: `tasks` is the single canonical skill

## External skill provenance

The three Matt Pocock-derived engineering skills above were copied from `mattpocock/skills` commit `3cca18b368ae95cdbdebbff572ccafa662551015` and then given small iPix-specific safety/source-of-truth overlays.

## Superpowers methodology subset

The six Superpowers methodology skills above were vendored from [`obra/superpowers`](https://github.com/obra/superpowers) commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` under the upstream MIT license (`SUPERPOWERS_LICENSE.txt`). Only dependency references that would otherwise require unvendored Superpowers skills were adapted to existing iPix owners: `worktrees` for workspace isolation and `tasks` for inline execution / branch finishing / PR-post-merge handling. iPix `tasks`, `task-verifier`, `worktrees`, `pr`, `fastest`, Graphify, and domain skills remain authoritative for repository-specific behavior.
