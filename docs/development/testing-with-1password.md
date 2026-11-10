# iPix QA: reuse the existing 1Password-backed Playwright runner

**Purpose:** When a user journey needs **existing QA accounts** and real authenticated browser checks, reuse the local iPix 1Password runner. This is conditional testing guidance, **not** a new test framework, a production-testing authorization, or a replacement for [AGENTS.md](../../AGENTS.md) and the [tasks testing standard](../../.claude/skills/tasks/references/user-journey-testing.md).

## Select the cheapest adequate proof first

1. **Docs / local code change:** `npm run docs:check`, focused unit/contract tests and `npm run secrets:check`. Do not open a browser or access 1Password.
2. **Local browser/UI change:** run the existing isolated Playwright fixtures for the changed journey; use deterministic test accounts and existing `storageState` only within their approved QA scope.
3. **Authenticated real-user / RLS / cross-org journey:** use the existing iPix 1Password QA runner *when installed and authorized*, and verify the exact target project, SHA, environment and clean QA worktree before any actions.
4. **Production or paid-model journey:** requires the owning Linear release/test task and explicit authorization; never infer consent from a QA login or this guide.

## Existing local setup (observed on one developer workstation; re-verify before use)

An **untracked**, workstation-local `/home/sk/ipixai/testing.md` explains the original QA process. It is *optional local context*, not part of the Git repository: a fresh clone may not have it. Do **not** commit or copy its test account identities, session files, credentials, 1Password environment IDs or contents. This versioned guide is the portable starting point.

The local wrapper `ipix-qa-op` and tools `op` / `1password-mcp` were detected on that workstation. Wrapper availability is **machine-local, not a promise about every agent or CI runner**. The setup uses the **iPix-QA** 1Password Environment; do not select a production/archive vault or other project just because it exists.

### Safe preflight — read-only, no test-account login

```bash
command -v ipix-qa-op
command -v op
ipix-qa-op check
```

Use this only after verifying the existing local script is trusted. 1Password Desktop may request human approval; **stop at that approval prompt**, never bypass it or dump credentials. `check` should verify required names/presence without showing secret values. If it fails or is unavailable, report the blocker and use the existing deterministic tests instead. Do not invent a fallback password or reset existing accounts.

### Authorized QA sign-in and browser checks

After checking that the wrapper's fixed QA worktree and browser fixtures match the intended **code/deployment SHA**, verifying non-production environment and receiving approval for side effects:

```bash
ipix-qa-op login
ipix-qa-op e2e
```

These use the existing repository Playwright fixtures and QA environment. Each org gets an **isolated browser context**; never export auth `storageState` to a PR, chat, screenshot, console log or another tenant. Do not run E2E merely because a documentation PR merged. If the QA worktree is older than the candidate SHA, **STOP**: do not call its tests exact-SHA certification, and do not reset/update another person's QA worktree automatically.

**Critical real-world cases (only when the task requires them):** Org A login → dashboard → Planner → authorized review/save/readback/reload; Org B is denied Org A's data; shoot detail actions; ~390px mobile; bounded CopilotKit/Mastra errors and recovery. Verify actual UI, API and durable database outcome; negative auth and retry results are separate proofs.

## 1Password security boundaries

- Prefer the existing wrapper. Its `op run` invocation makes secrets available only to the subprocess for the required QA operation, following official [1Password CLI run](https://www.1password.dev/cli/reference/commands/run) guidance. **Do not** print environment values, run `op run --no-masking`, export secrets into shell history, or commit secret references.
- 1Password's [local Environments MCP server](https://www.1password.dev/environments/mcp-server) can list authorized environment and variable **names** without returning secret values; it may prompt through 1Password Desktop. Do not presume it is connected in every agent session. Do not create a second Environment or mount a new env file for this test.
- iPix's existing **Dotenvx / `.env.agent` isolation stays authoritative**. Do not replace app secret wiring, bypass RLS, include service-role credentials in the coding-agent environment, or use credentials belonging to a different tenant.
- **No production writes, paid AI checks, destructive account actions or auth resets** without explicit task-scoped human approval. A valid account login does not authorize publishing, approval, payment or cross-organization access.

## Evidence / recovery

Report target environment and **exact SHA**; which fixture was run; sanitized PASS/FAIL; negative-path evidence; protected screenshot/trace location if authorized; and remaining blocker/next action in the **existing Linear task**. Close contexts and clean up any approved synthetic test records. If an operation's write result is unknown after disconnect, read back durable state before an idempotent retry—never issue a second consequential action blindly.
