# iPixai skills

Canonical repository skill tree: `.claude/skills/`. Cursor also loads `.cursor/skills` → symlink to the same tree.

Conversion SSOT: `docs/mastra/10-mastra-convert.md`. Cursor rules: `.cursor/rules/`.

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
| `ipix-task-lifecycle` | **Deprecated compatibility alias** → use `tasks` for new work |
| `pr-workflow` | **Deprecated compatibility alias** → use `tasks` PR/Actions/post-merge references |
| `lean` | Velocity audit |
| `worktrees` | Isolated branches |
| `refactor-plan` | Multi-file refactors |
| `mermaid-diagrams` | Diagrams |
| `ipix-wireframe` | Lo-fi UI |
| `cloudinary` | Canonical iPix Cloudinary skill → embedded official docs/Next/React/transformation/MCP refs + Node refs |
| `graphify` | Official `graphify install` 0.9.48 — query `graphify-out/` |

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
- Task execution: `tasks` is canonical; `ipix-task-lifecycle` and `pr-workflow` are compatibility aliases only
