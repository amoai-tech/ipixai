---
title: "Linear development reference"
description: "iPix reference for Linear issues, templates, CLI/MCP usage, GitHub linking, agent handoff, todo.md, changelog.md, and docs workflow."
---

# Linear development reference

## Summary

Use Linear as the live execution source of truth for iPix.

```text
Linear = live issue, status, blockers, dependencies, evidence, Done
GitHub PR = implementation evidence
todo.md = short local handoff
changelog.md = notable verified shipped changes
docs/** = durable product/engineering knowledge
GitBook = published docs/search/MCP
Claude / ChatGPT / Codex = assistants operating from current Linear + current code
```

Do not duplicate the same task truth across Linear, `todo.md`, docs, and chat history.

## iPix Linear workflow

```text
Backlog → Todo → In Progress → In Review → Done
```

Use `Canceled` and `Duplicate` when appropriate. Keep the current one-week cycle unless rollover/planning overhead proves a change is needed.
## Approved issue templates

Use one of the four workspace templates for every substantial `IPI-*` issue:

| Work type | Template |
| --- | --- |
| Normal feature/fix | `Universal Engineering Task` |
| Audit/research only | `iPix Task Audit & Implementation Plan` |
| Confirmed bug/root-cause repair | `Forensic Error Audit & Fix` |
| Production/release certification | `Production Readiness / Release Gate` |

Every substantive issue should make this chain explicit:

```text
Purpose
→ Outcome
→ Implementation
→ Acceptance criteria
→ Verification
→ References
```

Before creating a new issue, search Linear and reuse/update the existing owner when possible. New issues should apply the real Linear template, not recreate it from memory.

## Agent start rule

Claude, ChatGPT, Codex, Kilo, and other coding agents should start from current execution truth:

```text
repo instructions
→ todo.md for short handoff
→ live Linear issue
→ current branch/PR
→ current origin/main + runtime/code
→ linked canonical docs
→ implementation + verification
```

Past chat context never overrides current Linear, code, tests, or runtime evidence.
## CLI vs connector

Use the tool that best fits the environment:

- **Linear connector/MCP:** preferred inside ChatGPT or another connected environment where live Linear actions are already available.
- **`linear-cli`:** preferred for terminal workflows, Claude Code, Codex, scripts, CI, and machine-readable automation.

Both operate on the same Linear workspace and issue IDs. Do not maintain a second task database.

Upstream `nesszer/linear-cli` agent guidance prefers the CLI for agent work because it supports compact JSON, field filtering, stable exit codes, stdin/JSON input, and direct Git/PR workflows:

- https://github.com/nesszer/linear-cli/blob/master/AGENTS.md
- https://github.com/nesszer/linear-cli/blob/master/CLAUDE.md

For iPix, that guidance is adapted rather than copied literally: use the native Linear connector when it is already available and the CLI when terminal/script execution is faster or more reproducible.

## Core CLI commands

```bash
linear-cli whoami
linear-cli i list --mine
linear-cli i get IPI-1294 --output json
linear-cli s issues "query"
linear-cli c current -t IPI
linear-cli tpl remote-list --type issue
linear-cli context --output json
linear-cli i start IPI-1294 --checkout
linear-cli g pr IPI-1294
```

For agents, prefer compact structured output:

```bash
linear-cli i list --output json --fields identifier,title,state.name --compact
```
## Agent-friendly CLI behavior

Useful flags:

| Flag | Purpose |
| --- | --- |
| `--output json` | Machine-readable output |
| `--compact` | Reduce token/output size |
| `--fields a,b,c` | Return only needed fields |
| `--quiet` | Suppress decorative output |
| `--id-only` | Return only created/updated ID |
| `--dry-run` | Preview writes safely |
| `--no-cache` | Bypass cached state when freshness matters |

Exit codes:

```text
0 = success
1 = general error
2 = not found
3 = authentication error
4 = rate limited
```

For automation, check the exit code and parse JSON instead of scraping table output.

## GitHub linking

Keep the Linear identifier in branch names, commits, and PR titles/descriptions where supported.

```text
IPI-1234 issue
→ branch/commit/PR references IPI-1234
→ Linear associates implementation evidence
→ review/merge state remains traceable
```

Do not mark an issue Done only because the PR merged. Required post-merge/runtime proof still applies.
## todo.md, changelog.md, and docs

Use each system for one job:

```text
Linear issue
→ todo.md stores only short current handoff
→ code/tests/PR
→ durable behavior change updates docs/**
→ notable verified shipped change updates changelog.md
→ merge
→ GitBook publishes docs
```

`todo.md` should contain only the active issue, current state/blocker, branch/PR, last verification, and exact next action. It is not the backlog.

`changelog.md` should contain notable verified outcomes, not every commit or unfinished work.

Update canonical `docs/**` in the same PR when architecture, contracts, user journeys, runbooks, or durable product behavior changes.

## Weekly hygiene

Once per cycle:

1. Review current-cycle issues and backlog.
2. Confirm owners, dependencies, blockers, and next actions.
3. Cancel genuinely stale work with a reason.
4. Mark true duplicates as `Duplicate`.
5. Reschedule valid unfinished work rather than leaving it ambiguous.
6. Preserve issue history; do not bulk-delete work merely to make the backlog smaller.

## Local linear-cli compatibility note

Installed iPix workstation binary: `linear-cli 0.3.28`.

The upstream v0.3.28 `tpl remote-list` query expected `templates.nodes`, while the current Linear GraphQL API returns `templates` directly as an array. The local binary is patched so remote template listing works.

Until the fix ships upstream, do not blindly replace the patched binary with `linear-cli update`. Verify the upstream release first with:

```bash
linear-cli update --check
linear-cli tpl remote-list --type issue
```
## Authentication and security

Prefer OAuth or an approved secret-injection path. Never print or commit Linear API keys.

The CLI authentication priority is:

```text
LINEAR_API_KEY environment variable
→ OS keyring
→ OAuth tokens
→ config-file API key
```

In headless shells, Linux keyring access may fail when no DBus/X11 session is available; the CLI can fall back to config-file credentials. Treat that as a local security trade-off, not an application dependency.

## Verification checklist

```bash
linear-cli --version
linear-cli whoami
linear-cli i get IPI-1294 --output json
linear-cli c current -t IPI
linear-cli tpl remote-list --type issue
git diff --check -- docs/reference/linear.md
```

Expected result: authenticated workspace access, current cycle visible, issue fetch succeeds, and exactly the four approved iPix issue templates are returned.

## References

- Linear issue templates: https://linear.app/amo100/settings/issue-templates
- Linear docs: https://linear.app/docs
- Linear Method: https://linear.app/method
- `nesszer/linear-cli`: https://github.com/nesszer/linear-cli
- Upstream agent contract: https://github.com/nesszer/linear-cli/blob/master/AGENTS.md
- Upstream Claude guidance: https://github.com/nesszer/linear-cli/blob/master/CLAUDE.md
- iPix workflow task: https://linear.app/amo100/issue/IPI-1294/ipi-1294-linear-workflow-001-standardize-linear-github-docs-todo-and

## Final rule

**Start from Linear + current code. Use the approved template. Keep the issue resumable. Verify the real outcome. Update docs/changelog only when their durable responsibilities apply.**
