---
name: explorbot
description: Unified Explorbot skill for setup, CLI usage/debugging, exploratory runs, and hand-written test plans. Use for first-time installation/config, no-install global usage, command/flag questions, run failures, result locations, auth/session setup, or authoring/running an Explorbot markdown plan.
license: MIT
metadata:
  source: consolidated from testomatio/skills explorbot-fundamentals + explorbot-setup + explorbot-plan
  version: 1.0.0-ipix
---

# Explorbot

One entry point for Explorbot. Route the request before acting:

| Need | Mode |
|---|---|
| Try/run Explorbot without project installation, command/flag help, run/debug/results | **Fundamentals** |
| Install/configure Explorbot in a repository, provider/auth/session setup | **Setup** |
| Write an Explorbot markdown test plan from requirements without live exploration | **Plan** |

Explorbot is an autonomous AI web-testing CLI. It drives a browser through research → plan → test. It is currently an iPix exploratory-testing pilot, not a mandatory merge gate unless a repository-owned task explicitly makes it one.

## Shared rules

- Verify commands and flags from the installed CLI, not memory:
  ```bash
  npx explorbot@0.4.6 --help
  npx explorbot@0.4.6 <command> --help
  ```
- If `--help` does not show a command or flag, do not invent it.
- Prefer non-production targets for exploratory testing.
- Never expose provider keys, login secrets, or session cookies in output, logs, plans, or committed files.
- `explorbot start` is an interactive TUI; ask the user to run it themselves. Agent-driven flows should use the non-interactive commands.
- Explorbot is best suited to interactive/CRUD-heavy applications; warn when the target is essentially static content.
- `explore` and `test` exit `0` when the session completes; that is not the same as every scenario passing. Read the generated report. `navigate` is the useful reachability preflight: non-zero means setup/reachability failed.

# Mode 1 — Fundamentals

Use for running, debugging, command questions, result locations, or trying Explorbot without changing the project.

## No-install path

Explorbot can run through `npx` without adding project files:

```bash
npx explorbot@0.4.6 init --global --provider <name>
npx explorbot@0.4.6 explore https://app.example.com/login --max-tests 3
```

Global provider configuration lives under the user's Explorbot home, not the repository. For CI or one-off environments, use the CLI-documented `EXPLORBOT_*` variables rather than inventing configuration.

## Where results land

With a project `explorbot.config.js`, output is project-local. Global/no-install runs use `~/.explorbot/sites/<host>/`.

Typical output:

| Path | Contents |
|---|---|
| `output/reports/` | session report: coverage, defects, execution issues |
| `output/plans/` | generated/executed plans |
| `output/states/` | HTML, ARIA snapshots, screenshots |
| `output/research/` | UI research maps |
| `output/tests/` | generated automation |
| `output/explorbot.log` | run log; start here on failure |
| `knowledge/`, `experience/` | taught/learned application knowledge |

## Target resolution

- Absolute target: `http://...` or `https://...`
- Relative target: starts with `/` and requires project `web.url` or `EXPLORBOT_URL`
- Commands with no target (`test`, `learn`, `knows`, `experience`, `compact`) use the same configured site context.

## Cheap before expensive

Use the lowest-cost command that answers the question:

```bash
npx explorbot@0.4.6 context <url>
npx explorbot@0.4.6 shell <url> '<codecept command>'
npx explorbot@0.4.6 knows <url>
npx explorbot@0.4.6 navigate <url> --session
```

Read `output/explorbot.log` before guessing why a run failed.

# Mode 2 — Setup

Use when the project needs persistent Explorbot config/knowledge/tests.

Setup ends when `npx explorbot@0.4.6 navigate <path>` can reach the app successfully. Exploration/testing after that uses Fundamentals mode.

## Requirements

- Node ≥ 24 or Bun. Do not install a runtime from this skill.
- Generated config uses ESM. Do not change an existing package's module semantics without explicit approval; use `explorbot.config.mjs` with `--config-path` if the project must remain CommonJS.
- Prefer staging/test/local over production.

## Install

If ESM conversion is approved:

```bash
npm pkg set type=module
npm i explorbot@0.4.6 --save-exact
npm exec --no -- playwright install chromium
npx explorbot@0.4.6 init
```

If ESM conversion is not approved:

```bash
npm i explorbot@0.4.6 --save-exact
npx explorbot@0.4.6 init --config-path explorbot.config.mjs
```

## Provider and secrets

Provider names, current model IDs, and required environment variables come from the installed Explorbot docs/generated config, never this skill.

Have the user place secrets in `.env` or the supported global env file themselves. Verify presence without printing the value. Confirm `.env` is ignored.

## App URL

Do not guess the host. Derive a suggestion only from repository evidence (scripts/env/framework config); otherwise ask. Store host-only `web.url` in project config.

## Reachability/auth ladder

Stop at the first failure, fix it, then resume:

1. Basic HTTP reachability (`curl` or equivalent).
2. Resolve redirects/auth wall.
3. Run `navigate` with session state stored outside the repository when possible.
4. If login knowledge is needed, teach it with environment-variable placeholders, never raw credentials.

Example:

```bash
npx explorbot@0.4.6 knows /login
npx explorbot@0.4.6 learn "/login" 'Sign in with ${env.APP_USER} / ${env.APP_PASSWORD}'
```

Use a non-production test account. Add the minimum extra knowledge needed when auth still fails.

## Setup handoff

Report the project artifacts created/changed, secret prerequisites without values, verified navigation result, and the first safe exploration command, for example:

```bash
npx explorbot@0.4.6 explore /<crud-page> --max-tests 10
```

# Mode 3 — Plan

Use when the user wants a test plan written from requirements/docs/ticket without browsing the live app.

A plan is markdown input to `explorbot test`; Explorbot does not need to be installed merely to author the file.

## Inputs

- feature/requirements/user story
- suite title
- mandatory start URL (relative path or absolute URL)
- optional per-test start URLs
- scenario priorities: `critical`, `important`, `high`, `normal`, `low`

## Canonical plan shape

```markdown
<!-- suite -->
# User Authentication

### Prerequisite

* URL: /login

<!-- test
priority: critical
-->
# User signs in with valid credentials

## Requirements
/login

## Steps
* Enter a registered email in the email field
* Enter the matching password
* Submit the sign-in form

## Expected
* The user lands on the authenticated dashboard
* The signed-in account is shown in the header
```

## Plan rules

- `<!-- suite -->` immediately precedes the suite `#` heading.
- The first prerequisite item is `* URL: <path-or-url>`.
- Every test has its own `<!-- test ... -->` metadata block and H1 scenario title.
- Give every test a `## Requirements` section containing its start URL; do not rely only on the suite prerequisite.
- `## Steps` and `## Expected` use `* ` bullets.
- Steps are intent/guidance, not brittle selectors.
- Every expected result must be independently verifiable.
- Titles describe business outcomes, not click sequences.

Store durable plans in the repository's normal test-plan location when appropriate. Use Explorbot's generated output folder only when the user specifically wants the plan alongside generated artifacts.

Run a plan with the installed CLI's current syntax. For v0.4.6:

```bash
npx explorbot@0.4.6 test checkout-plan.md '*'
EXPLORBOT_URL=https://app.example.com npx explorbot@0.4.6 test checkout-plan.md '*'
```

`test` has no URL positional argument; site context comes from project config or `EXPLORBOT_URL`. Read `output/reports/` for scenario results rather than treating process exit `0` as a pass verdict.

## Anti-patterns

- Installing Explorbot when a no-install `npx` run satisfies the request.
- Changing package module type without approval.
- Guessing provider/model/key names from memory.
- Storing secrets or auth cookies in committed knowledge/config/session files.
- Treating the TUI as agent-automatable.
- Treating process exit `0` as test success.
- Writing plans with selectors or expected results that merely restate steps.
