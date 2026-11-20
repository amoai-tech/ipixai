---
name: copilotkit-self-update
description: Use when the user wants to update, refresh, diff, or reinstall the CopilotKit agent skills/knowledge. Not for upgrading application dependencies.
version: 3.2.0-ipix.2
user_invocable: true
argument_hint: ""
---

# Update CopilotKit Skills — iPix safe sync

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

The 34+ JSON queries are intent fixtures, **not** evidence an agent activated the skill. The normal Vitest check validates fixture shape and known reference paths without a model call. For a real routing check, run:

~~~bash
RUN_COPILOTKIT_SKILL_LIVE_EVAL=1 npx vitest run tests/skill-trigger-evals.test.ts --maxWorkers=1 --no-file-parallelism
~~~

This opt-in test launches short, fresh `claude -p` sessions with the project plugin, disables external MCP connections and only permits read/search plus Skill tools. It uses a small model with a bounded per-case budget. **Costs a model call; do not run it in default CI or against a live iPix runtime.** It records whether the actual `ipix:copilotkit` Skill tool was invoked and whether the expected local reference was opened. The references are observational: a skill may be correctly selected but not need a separate file, so do not equate an unopened reference with incorrect skill activation.

The live test first checks whether `claude` is installed and `claude auth status` succeeds. Missing CLI or authentication skips the live cases with a clear message. Authentication may use a Claude login or another configured provider; no particular environment variable is required.

Claude Code qualifies plugin skills as `plugin:skill`. The iPix plugin manifest names `ipix` and its skill/trigger fixtures name `copilotkit`, so the Skill tool uses `ipix:copilotkit`. The deterministic test checks this relationship.

A report emits `PASS` (explicit Skill selection matches expected routing), `MISS` (selection mismatch), or `INCONCLUSIVE` (restricted process/turns did not finish). Direct reference reads are recorded separately and never counted as Skill invocation. Model choice and low-cost turn limits vary: **the live evaluation is diagnostic only, never a required CI/release gate**. Review the results manually before changing the skill description.

A result showing `no skill call` is a real measured miss for that prompt, not proof the skill is unavailable. Investigate the top-level description and any competing skill routing, then rerun a small varied set with the exact model and CLI version recorded. Negative (near-miss) prompts must avoid the skill. Keep the test opt-in and leave the application/server/database untouched.
