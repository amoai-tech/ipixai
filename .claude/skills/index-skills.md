# iPixai skills — canonical inventory and audit

Canonical repository skill tree: `.claude/skills/`. Cursor also loads `.cursor/skills` → symlink to the same tree.

AI runtime SSOT: `docs/copilotkit-mastra/README.md`. Cursor rules: `.cursor/rules/`.

**Last audited:** 2026-09-20 against remote `main`.

## Faster/better approach

Use the smallest skill set that owns the task. Do not load overlapping skills “just in case.” Prefer:

`canonical domain skill → review-only specialist when reviewing a PR → shared workflow skill → targeted verification`

For skill maintenance, follow Anthropic's current skill guidance:

- https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator/skills/skill-creator
- https://github.com/anthropics/claude-plugins-official/blob/main/plugins/skill-creator/skills/skill-creator/SKILL.md
- https://github.com/mastra-ai/skills

Apply those references as follows: keep `name` + `description` in YAML frontmatter, make descriptions state both **what the skill does and when it should trigger**, keep `SKILL.md` focused (under ~500 lines is the preferred target), move deeper material into `references/`, and use realistic trigger/evaluation cases before claiming a skill is optimized.

## Audit score meaning

These are **static audit scores**, not benchmark scores. They measure current repo fit, trigger clarity, source-of-truth discipline, duplication risk, maintainability, and verification guidance.

| Score | Grade | Meaning |
|---:|:---:|---|
| 90–100 | A | Strong; production-ready structure |
| 80–89 | B | Good; targeted improvement only |
| 70–79 | C | Useful but should be simplified or tightened |
| <70 | D | Deprecated, redundant, or should be consolidated |

## Complete current inventory — 44 skills

| Skill | Score | Grade | Decision | Main improvement |
|---|---:|:---:|---|---|
| `brainstorming` | 92% | A | Keep | Keep upstream methodology focused; avoid invoking for trivial non-creative fixes. |
| `ci-review` | 93% | A | Keep | Review-only specialist; preserve exact-head and secret-boundary focus. |
| `cloudinary` | 96% | A | Keep canonical | Strong progressive references and iPix security overlay. |
| `cloudinary-review` | 91% | A | Keep | Review-only specialist; do not merge into `cloudinary` while PR-Agent routing depends on it. |
| `code-review` | 88% | B | Keep symlink | Document symlink provenance in this index; avoid a second copied review skill. |
| `codebase-design` | 91% | A | Keep | Add evals for seam/interface decisions before major edits. |
| `copilotkit` | 94% | A | Keep canonical | Keep current v2/AG-UI examples and installed-version checks authoritative. |
| `copilotkit-review` | 95% | A | Keep | Good review-only contract; continue verifying installed source/types first. |
| `diagnosing-bugs` | 89% | B | Keep symlink | Keep one source under `.agents`; add regression examples when debugging rules change. |
| `dispatching-parallel-agents` | 89% | B | Keep | Clarify “independent work only” with iPix examples to prevent unsafe parallel writes. |
| `domain-modeling` | 91% | A | Keep | Strong owner for vocabulary, boundaries, `CONTEXT.md`, and ADR work. |
| `explain` | 90% | A | Keep | Useful narrow communication skill; no merge needed. |
| `fashion-production` | 92% | A | Keep | Preserve domain language; add current V2 examples as product flows change. |
| `fastest` | 93% | A | Keep canonical | Make this the single owner for “better/faster approach” discovery. |
| `graphify` | 78% | C | Improve | `SKILL.md` is ~715 lines; move command/reference detail into `references/` and keep routing/query workflow in the root skill. |
| `ipix-supabase` | 95% | A | Keep canonical | Strong data/security owner; continue treating production as read-only during audits unless explicitly authorized. |
| `ipix-task-lifecycle` | 55% | D | Retire | Deprecated compatibility alias; migrate remaining callers to `tasks`, then delete. |
| `ipix-wireframe` | 88% | B | Keep | Separate reusable design rules from screen-specific references if it grows further. |
| `lean` | 68% | D | Consolidate | Significant overlap with `fastest` + `tasks`; move unique velocity-audit rules into `fastest` or a `tasks` reference. |
| `linear` | 92% | A | Keep | Keep task/source-of-truth behavior narrow and current. |
| `mastra` | 97% | A | Keep canonical | One Mastra owner for implementation + PR review; synced to official 2.2.0 trace-query guidance while preserving iPix auth/HITL/persistence rules. |
| `mermaid-diagrams` | 84% | B | Keep | Good utility; move large syntax/catalog detail to references if further expanded. |
| `nextjs-developer` | 91% | A | Keep canonical | Continue verifying the installed Next.js version for changing APIs. |
| `nextjs-review` | 90% | A | Keep | Review-only specialist; intentional separation from implementation skill. |
| `playwright-cli` | 88% | B | Keep | Add iPix-specific authenticated/tenant test entry points without copying Playwright docs wholesale. |
| `pr` | 93% | A | Keep | Clear explicit-mutation boundary; keep human merge approval authoritative. |
| `pr-agent-code-review` | 95% | A | Keep canonical review | Correct universal review baseline; specialist skills should add only domain-specific invariants. |
| `pr-workflow` | 55% | D | Retire | Deprecated compatibility alias; move all remaining use to `tasks` + `pr`. |
| `receiving-code-review` | 91% | A | Keep | Good methodology; verify feedback before implementing it. |
| `refactor-plan` | 90% | A | Keep | Strong narrow owner for multi-file sequencing and rollback planning. |
| `requesting-code-review` | 91% | A | Keep | Good pre-merge review methodology; avoid duplicating PR-Agent domain rules. |
| `research` | 87% | B | Keep symlink | One source under `.agents`; add trigger evals for research vs direct documentation lookup. |
| `resolving-merge-conflicts` | 89% | B | Keep | Good intent-based narrow skill; add high-risk data/migration conflict examples. |
| `shadcn` | 92% | A | Keep canonical | Prefer registry/component reuse before custom UI. |
| `skill-creator` | 96% | A | Keep canonical | Official Anthropic workflow, fully vendored with eval scripts, schemas, grader/analyzer prompts, viewer, and license. |
| `subagent-driven-development` | 80% | B | Keep, trim later | Root skill is ~568 lines; preserve upstream behavior but consider references if iPix customizes it further. |
| `supabase-review` | 94% | A | Keep | Review-only specialist; intentional separation from `ipix-supabase`. |
| `task-verifier` | 97% | A | Keep canonical gate | Strong independent evidence owner; must stay separate from task execution. |
| `tasks` | 97% | A | Keep canonical workflow | Primary execution owner; absorb retired lifecycle/PR workflow content only when unique. |
| `tdd` | 89% | B | Keep symlink | Keep one source under `.agents`; protect red→green→refactor behavior with contract tests. |
| `to-spec` | 86% | B | Keep symlink | Keep one source under `.agents`; clarify boundary vs `writing-plans` in trigger description/evals. |
| `vercel-react-best-practices` | 92% | A | Keep | Strong focused performance reference; avoid using it as a generic Next.js owner. |
| `worktrees` | 85% | B | Keep | Useful isolation owner; trim procedural detail if it grows beyond current scope. |
| `writing-plans` | 91% | A | Keep | Clear plan-before-code owner; distinguish approved-spec execution from `brainstorming`/`to-spec`. |

## Symlinked skills — reuse, do not copy

These entries intentionally reuse `.agents/skills/*` instead of maintaining duplicate content:

- `code-review` → `.agents/skills/code-review`
- `diagnosing-bugs` → `.agents/skills/diagnosing-bugs`
- `research` → `.agents/skills/research`
- `tdd` → `.agents/skills/tdd`
- `to-spec` → `.agents/skills/to-spec`

This is the preferred reuse pattern when Claude/Codex need the same skill content.

## Duplicate / consolidation decisions

### Keep separate — intentional review specialists

Do **not** merge these into their implementation skills while PR-Agent routing exists:

- `ci-review`
- `cloudinary-review`
- `copilotkit-review`
- `nextjs-review`
- `supabase-review`
- `pr-agent-code-review`

`scripts/select-pr-agent-skills.mjs` selects these by changed file path and `tests/pr-agent-routing.test.ts` / `tests/pr-agent-skills-contract.test.ts` enforce the contract. The specialist skills stay small and review-only. **Mastra is the deliberate exception:** PR-Agent now loads the canonical `mastra` skill in PR-review mode instead of maintaining a duplicate `mastra-review` alias.

### Consolidate / retire

1. **`ipix-task-lifecycle` → `tasks`** — already documented as deprecated. Search all callers, update them, then delete the alias.
2. **`pr-workflow` → `tasks` + `pr`** — already deprecated. Keep `pr` for explicit PR operations and `tasks` for lifecycle/process guidance.
3. **`lean` → `fastest` / `tasks` references** — retain only unique velocity-audit logic; avoid three skills answering “what is the fastest safe path?”

## Highest-value improvements

### P1 — fix correctness / routing clarity

- Keep a **single canonical `mastra` skill** for implementation, debugging, upgrades, and PR review; PR-Agent routing now selects `mastra` directly.
- Remove deprecated `ipix-task-lifecycle` and `pr-workflow` only after `git grep` proves no active caller still depends on them.
- Use the vendored official Anthropic `skill-creator` workflow for realistic trigger cases, with-skill/baseline comparisons, benchmark variance, and description optimization instead of scoring by intuition alone.

### P2 — reduce context cost

- Split `graphify` root instructions so the root stays <500 lines and deep CLI/reference material loads on demand.
- If `subagent-driven-development` receives iPix-specific additions, move added detail to references rather than growing the upstream root further.
- Keep review specialists short; they should contain only material PR invariants and decisive verification paths.

### P3 — add measurable skill quality

For each canonical skill, add 3–5 realistic task cases and near-miss trigger cases. For high-value skills (`tasks`, `task-verifier`, `mastra`, `copilotkit`, `ipix-supabase`, `cloudinary`) add repeatable assertions and compare results before/after changes.

Reference implementation: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/skill-creator/skills/skill-creator/SKILL.md

## Production-ready skill checklist

- [ ] Unique `name` and clear trigger-oriented `description`
- [ ] One obvious owner for the task; overlaps are explicit
- [ ] `SKILL.md` is focused; deep material uses progressive `references/`
- [ ] Current repo paths, versions, scripts, and architecture are correct
- [ ] Installed source/types beat stale copied API knowledge
- [ ] Consequential writes preserve iPix human-approval and tenant boundaries
- [ ] Review skills are read-only/advisory and report only material findings
- [ ] Cheapest decisive test is stated
- [ ] Trigger/eval examples cover realistic positive and near-miss cases
- [ ] Symlink/provenance is documented when content is shared
- [ ] Deprecated aliases have a removal plan
- [ ] Contract tests protect routing and non-negotiable behavior

## Verification for this index

1. Compare this table against `git ls-tree main:.claude/skills`; every current top-level skill must appear exactly once.
2. Verify symlink targets rather than treating symlinks as missing skills.
3. Run PR-Agent routing contract tests before removing/renaming any review specialist or changing canonical `mastra` routing.
4. Run repository documentation checks after changing paths or references.
5. Re-score only after code/skill changes or after running actual skill evals.

## External provenance

- Anthropic Agent Skills examples/spec implementation: https://github.com/anthropics/skills
- Anthropic official Skill Creator: https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator/skills/skill-creator
- Superpowers methodology: https://github.com/obra/superpowers
- Mastra skill source: https://github.com/mastra-ai/skills

Scores should be treated as provisional until the highest-value skills have repeatable eval results.
## Upstream versions synced

- Anthropic `skill-creator`: vendored from `anthropics/claude-plugins-official` commit `c447c3207a425bc4e2a0d068435f64b0477ae981` (2026-09-20 audit), including license, eval scripts, schemas, grader/analyzer prompts, assets, and viewer; two upstream trailing-whitespace defects are normalized to satisfy `git diff --check`.
- Mastra `mastra`: synced through official `mastra-ai/skills` 2.2.0 commit `f79b794df9201b671b6602c6fc8ac0ad95478750`; iPix-specific auth, HITL, persistence, and dev-command overlays remain authoritative.
