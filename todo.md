---
title: Current execution handoff
---

# Current execution handoff

Linear is the authoritative task/status source: https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

## Current

- IPI-1294 · LINEAR-WORKFLOW-001 — Standardize Linear, GitHub, Docs, TODO, and Changelog Workflow
- State: focused governance implementation is in PR #258 on branch `ipi-1294-linear-workflow-governance`.
- Exact head: `d2604ef06177cbfea748d43aeab0e399503c9837` before review-fix follow-up commit.
- Latest local proof: `npm run test:skills` 12/12 passed; `npm run docs:check` 72 active docs / 0 broken links; `npm test` 110 files / 1,424 passed / 3 skipped; `npm run typecheck` passed; `git diff --check` passed.
- Exact-head GitHub proof: PR Agent passed; CI build/full tests/typecheck/build and Supabase replay/security jobs passed; Playwright jobs were still running at the last recorded check.
- Remaining blockers: synchronize/retire live Linear template definitions through an authorized template-edit path, verify/fix GitHub ↔ Linear PR/status automation, finish exact-head review/CI, then merge and run exact-main post-merge proof.
- PR: https://github.com/amoai-tech/ipixai/pull/258

## Durable sources

- Product: `docs/prd.md`
- Roadmap: `docs/roadmap.md`
- Documentation/workflow standard: `docs/ipix-platform/BEST-PRACTICES.md`
- Shipped history: `changelog.md`
