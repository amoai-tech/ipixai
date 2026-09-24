---
name: testomatio
description: Use when working with Testomat.io reporting, test-case sync, MCP analytics, Testomat.io run commands, sprint QA reports, or change-aware PR testing and CI integration.
license: MIT
metadata:
  author: Testomat.io + iPix consolidation
  version: 1.0.0-ipix.1
  consolidates: qa-e2e-tests-reporting, qa-sprint-report-by-testomatio, run-tests-with-testomatio-reporter, setup-change-aware-pr-testing, sync-test-cases-with-tms, testomatio-mcp
---

# Testomat.io

Single entry point for Testomat.io-specific workflows. Keep general QA design, test generation, coverage mapping, flaky-test repair, and generic CI authoring in their owning QA skills.

## Route by intent

| Intent | Read |
|---|---|
| Install/configure reporters, artifacts, or produce a Testomat.io sprint QA report | [reporting.md](references/reporting.md) |
| Pull/push Markdown test cases between the repo and Testomat.io | [sync.md](references/sync.md) |
| Configure/use Testomat.io MCP, analyze runs, cluster failures, triage defects | [mcp.md](references/mcp.md) |
| Start/finish/filter/local/remote Testomat.io runs with the reporter CLI | [runs.md](references/runs.md) |
| Wire change-aware Testomat.io runs into PR/deploy CI | [pr-testing.md](references/pr-testing.md) |

Read only the reference needed for the request. For PR testing, also read `runs.md`; for sprint reporting, also read `mcp.md` because the report is sourced from MCP data.

## Shared safety rules

- Never expose Testomat.io API keys, project tokens, CI credentials, or artifact-store secrets in chat, logs, committed files, or generated docs.
- Prefer environment variables / CI secret stores. Before writing `.env`, prove it is gitignored.
- Never guess CLI flags, Testomat.io CI profile names, MCP tool contracts, IDs, labels, or remote state. Verify from the installed CLI/MCP or current vendor documentation.
- Remote writes are consequential: confirm scope before pushing test cases, mutating Testomat.io entities, creating defects, or launching expensive/full-suite remote runs.
- Prefer local repository tests for discovery when they exist; use Testomat.io MCP for remote state, run analytics, targeted lookup, and Testomat.io-only data.
- `setup-ci-automation` owns generic CI structure; `qa-test-code-coverage` owns coverage maps. This skill owns only the Testomat.io-specific mechanics layered on top.

## Related iPix QA owners

- `testing-workflow` — QA router.
- `qa-test-code-coverage` — source-to-test coverage map used by change-aware filters.
- `qa-write-test-cases` / `improve-test-cases` — create or improve cases before syncing.
- `diagnosing-bugs` automated-test mode — repair failing/flaky automated tests after Testomat.io identifies failures.
- `setup-ci-automation` — generic CI investigation, authoring, secrets, and PR delivery.
