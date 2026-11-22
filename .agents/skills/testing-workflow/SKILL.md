---
name: testing-workflow
description: Route iPix QA requests to the existing test design, review, automation, debugging, and CI skills. Use when asked to plan QA, create test cases, choose test levels, automate tests, diagnose failures, or verify PRs and user journeys.
metadata:
  author: iPix
  version: 2.0.0-ipix
---

# Testing workflow — iPix

Use the smallest relevant workflow. Inspect the live Linear task, repo tests, and affected runtime first. Testomat.io and Explorbot are retired and are not part of the iPix test stack.

## Routing

| Request | Skill | Output |
| --- | --- | --- |
| What can go wrong? Feature or PR QA risk | `qa-review` | Relevant failures, negative paths, and highest-value scenarios |
| What does the app currently do? | `qa-explain-behavior` | Evidence-backed behavior and gaps |
| What did this PR actually change? | `qa-pr-analysis` | Intent versus changed files and scope |
| Write test scenarios or checklists | `qa-write-test-cases` | Reviewable scenarios derived from requirements |
| Improve or deduplicate existing cases | `improve-test-cases`, `qa-automation-test-consolidation` | Leaner, clearer cases |
| Unit vs integration vs end-to-end? | `qa-split-testing-levels-pyramid` | Cheapest reliable test level per risk |
| Automate agreed manual scenarios | `automate-manual-test-cases` | Vitest / Playwright code matching the repo's installed versions |
| Seed safe fixture data | `qa-data-seeder` | Test-only fixtures, never production records |
| Fix failed/flaky tests | `diagnosing-bugs` in **automated-test mode** | Root cause, minimal fix, targeted rerun |
| Review CI quality | `ci-review` plus `tasks` | Verified GitHub Actions behavior, least privilege and release gates |
| Run deterministic browser journeys | `playwright-cli` | Browser evidence tied to the acceptance criteria |
| Verify release readiness | `task-verifier` | Independent gaps and verified proof |

## iPix testing stack

- **Vitest:** fast unit/component/contract tests.
- **Supabase:** SQL/RLS/RPC integration tests, including Org A vs Org B denial.
- **Playwright:** deterministic authenticated browser journeys, retries, and recovery.
- **GitHub Actions:** scoped checks and exact-head release evidence.
- **Mastra/CopilotKit tests:** streaming, tools, tenant context, interrupted approval and durable readback.

Do not install a new TMS, reporter, autonomous browser service, or CI workflow by default. Only use a new service following an explicitly approved task. Prefer existing checks before new scripts; verify failure and security behavior as well as the happy path.
