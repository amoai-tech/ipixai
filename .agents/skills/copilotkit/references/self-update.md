# Update CopilotKit Skills — iPix safe sync

**Reference only:** This file belongs to the one discoverable `ipix:copilotkit`
skill; it is not another installed skill, slash command or dependency installer.

## Contents

- [Preserve the consolidated skill](#ipix-rule-never-overwrite-the-consolidated-hub)
- [Pinned upstream inventory](#pinned-official-upstream-skill-inventory-2026-11-20)
- [Minimal update procedure](#simplified-update-procedure)
- [Content and dependency conflicts](#dependencycontent-conflict-rule)
- [Selective synchronization](#sync-procedure)
- [Optional read-only skill-selection checks](#verify-live-skill-selection-only-when-needed-opt-in)

Official generic installer for new/disposable projects only:

```bash
npx skills add CopilotKit/CopilotKit/skills -y
```

For iPix, do not run a skill installer until a human approves how to preserve the existing overlays; selective diff and test is safer.

## iPix rule: never overwrite the consolidated hub

iPix intentionally keeps one project-aware hub at `.agents/skills/copilotkit/`. Upstream ships separate skills. Refresh by **diff + selective sync**, preserving iPix architecture/security overrides.

```text
fresh upstream inventory
→ map every upstream skill into the hub
→ diff every mapped file/reference
→ sync framework facts and new references
→ preserve iPix overrides
→ verify installed source/types and maintained examples
→ run skill routing checks
```
## Pinned official upstream skill inventory (2026-11-20)

**Reference — ADAPT:** [official CopilotKit skills at the pinned commit](https://github.com/CopilotKit/CopilotKit/tree/6f8e51b4682e1e5ff733895d11d099ff5afd015b/skills). Re-enumerate this upstream directory every time you refresh; do not assume a static list stays current.

| Official upstream folder | What iPix should reuse |
| --- | --- |
| `copilotkit` v3.2.0 | **ADAPT:** thin live-doc/source lookup into the canonical iPix skill |
| `copilotkit-cli` | **REFERENCE ONLY:** optional authenticated OSS verifier, not an automatic command or another runtime |
| `copilotkit-channels` / `channels-setup` / `setup-slack-channel` | **MODEL:** optional delivery workflow, under local `references/channels.md` |
| `inspector-docs` / `inspector-workbench` | **REFERENCE ONLY:** local inspection, not a production dependency |
| `intelligence-docs` / `intelligence-vocabulary` | **REFERENCE ONLY:** hosted Intelligence is not the iPix Planner runtime |

At this pinned commit the official inventory has nine skill directories. `inspector-workbench` operates CopilotKit's own Inspector UI, and `intelligence-docs` edits its own documentation website. Neither belongs as a new iPix runtime/developer skill. Managed Intelligence Channels and self-hosted `@copilotkit/channels-*` adapters remain distinct. Do not enable managed Intelligence or add another host/provider just to reuse an upstream skill.

The older upstream directories `copilotkit-setup`, `copilotkit-develop`, `copilotkit-integrations`, `copilotkit-upgrade`, `runtime` and `react-core` are **not** in the current official inventory. Their old iPix reference copies remain as historical guidance, subordinate to installed package types and current docs.

Do **not** run the official generic `npx skills add CopilotKit/CopilotKit/skills -y` command in this repository without explicit approval: it can overwrite the consolidated hub or create duplicate discoverable skills. Test an upstream installation in a disposable checkout only, then selectively adapt useful rules.

## Simplified update procedure

1. Pin the current upstream SHA and enumerate its full skills tree.
2. Compare `copilotkit` and `copilotkit-cli` with current iPix source and installed CopilotKit/AG-UI packages.
3. Keep one iPix entry point; preserve server-derived tenancy, HITL, durable Planner and production runtime owners.
4. Adapt only compatible docs/lookup guidance. Do not copy hosted Intelligence setup, unpinned CLI execution, another provider or sandbox-only auth.
5. Update trigger and contract fixtures; verify link integrity, package version truth and current PR dependencies.
6. Start a fresh coding-agent session after merging so updated skill discovery is loaded.

This **skills-only** task does not complete [IPI-1389](https://linear.app/amo100/issue/IPI-1389), which changes application packages.

## Dependency/content conflict rule

When upstream skill text and the maintained app stack disagree, use:

```text
installed package source/types
→ current official maintained example
→ current CopilotKit docs/MCP
→ upstream bundled skill text
```

For iPix specifically, never restore stale Mastra `beta` labels or `--legacy-peer-deps` guidance without proving a real current peer conflict.

## Sync procedure

1. Record upstream HEAD/date and the full `skills/` directory inventory.
2. Record iPix installed CopilotKit/AG-UI/Mastra versions.
3. Diff every upstream skill and its `references/` against the mapped local destination.
4. Copy mechanical upstream additions/changes where they do not conflict with iPix overrides.
5. Reapply/retain iPix rules: tenancy, HITL, source-of-truth order, current repo paths, and architecture boundaries.
6. Re-check `examples/integrations/mastra` and current Mastra docs for integration/version drift.
7. Update routing/evals when new skill families or trigger phrases appear.
8. Search the whole hub for stale `beta`, `legacy-peer-deps`, deprecated API names, old paths, and forced transport flags.
9. Run JSON/Markdown sanity checks and inspect `git diff` before finishing.
10. Start a new agent session after the skill refresh so discovery reloads the updated files.

## Verify live skill selection only when needed (opt-in)

The 42 JSON queries are intent fixtures, **not** evidence an agent activated the skill. Eight substantive, near-miss scenarios (four positive and four negative) are opt-in live probes, divided into training and held-out cases. The normal Vitest check validates fixture shape and known reference paths without a model call. For a real routing check, run:

~~~bash
RUN_COPILOTKIT_SKILL_LIVE_EVAL=1 npx vitest run tests/skill-trigger-evals.test.ts --maxWorkers=1 --no-file-parallelism
~~~

This opt-in test launches short, fresh `claude -p` sessions with the project plugin, disables external MCP connections and only permits read/search plus Skill tools. It uses a small model with a bounded per-case budget. **Costs a model call; do not run it in default CI or against a live iPix runtime.** It records whether the actual `ipix:copilotkit` Skill tool was invoked and whether the expected local reference was opened. The references are observational: a skill may be correctly selected but not need a separate file, so do not equate an unopened reference with incorrect skill activation.

The live test first checks whether `claude` is installed and `claude auth status` succeeds. Missing CLI or authentication skips the live cases with a clear message. Authentication may use a Claude login or another configured provider; no particular environment variable is required.

Claude Code qualifies plugin skills as `plugin:skill`. The iPix plugin manifest names `ipix` and its skill/trigger fixtures name `copilotkit`, so the Skill tool uses `ipix:copilotkit`. The deterministic test checks this relationship.

A report emits `PASS` (explicit Skill selection matches expected routing), `MISS` (selection mismatch), or `INCONCLUSIVE` (restricted process/turns did not finish, the `ipix` plugin was not loaded, or `ipix:copilotkit` / the `Skill` tool was not advertised in `system/init`). Successful `Read` results, filename searches and Skill invocation are measured independently. Model choice and bounded turns vary: **the live evaluation is a diagnostic, never a required CI/release gate**.

### Paired old-versus-new comparison — MODEL

**Source:** https://github.com/anthropics/claude-plugins-official/blob/main/plugins/skill-creator/skills/skill-creator/SKILL.md → “Running and evaluating test cases” and “Improving the skill description”. **Use:** compare the current version against a clean baseline with unchanged prompts, permissions and model; observe both positive and near-miss cases. **Do not copy:** its temporary `.claude/commands` files into iPix or let a model modify the checked-out app during evaluation.

From the candidate checkout, use an **existing clean, detached main worktree**; do not point the baseline at the same directory:

~~~bash
# Example: create this worktree once, then reuse it until main changes.
git fetch origin main
git worktree add --detach /tmp/ipix-skill-main origin/main

RUN_COPILOTKIT_SKILL_LIVE_EVAL=1 \
COPILOTKIT_SKILL_EVAL_BASELINE_ROOT=/tmp/ipix-skill-main \
COPILOTKIT_SKILL_EVAL_MODEL=haiku \
COPILOTKIT_SKILL_EVAL_REPEATS=2 \
npx --no-install vitest run tests/skill-trigger-evals.test.ts --maxWorkers=1 --no-file-parallelism
~~~

This runs the **same eight prompts** against both checkouts twice (32 paid, read-only calls total); each variant uses the same `--tools Skill,Read,Grep,Glob` list, blocked external MCP servers and bounded budget. Optional `COPILOTKIT_SKILL_EVAL_MAX_TURNS` and `COPILOTKIT_SKILL_EVAL_BUDGET_USD` apply equally to both. The summary separates train/held-out outcomes, incomplete runs, true and false skill calls, successful reference reads, duration and model cost. **A test runner passing does not imply that skill selection passed.** Check the actual Skill calls, not only the PASS/MISS rubric. Review advice quality, correct auth/security boundaries and costs manually; the structured diagnostic does not grade answer safety.

**Checkpoint:** Only adopt a changed description after repeatable held-out improvement without new false triggers or security regressions. If both versions still skip the skill, keep the previously established description and report a routing limitation rather than invent a success rate. For high-impact CopilotKit work in Claude Code, manually invoke `/ipix:copilotkit` when automatic selection is unreliable; the skill must still follow iPix authorization and approval rules.
