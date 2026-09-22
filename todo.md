---
title: Current execution handoff
---

# Current execution handoff

Linear is the authoritative task/status source: https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

## Current

- IPI-1294 · LINEAR-WORKFLOW-001 — Standardize Linear, GitHub, Docs, TODO, and Changelog Workflow
- Branch: `ipi-1294-postmerge-handoff`
- PR: pending — post-merge handoff follow-up
- State: PR #258 is merged and exact-main certified. The four approved Linear execution templates now use the full canonical external-reference contract, and the stale rule-only `reuse-rule-linear-task` template is retired. Live template inventory is exactly four.
- Last proof: exact-main CI #1285 passed on the PR #258 merge SHA; `test:skills` is 13/13 and docs validation is 72 active files with 0 broken local links. Durable SHA/CI/template evidence is recorded in IPI-1294 and PR #258.
- Remaining blocker: Linear team Git automations are configured correctly (`start → In Progress`, `review → In Review`, `merge → Done`), but Linear Reviews/Diffs does not currently discover `amoai-tech/ipixai`; a documented PR-state resync did not change IPI-1294 from In Progress.
- Next action: use this focused follow-up PR as a fresh `IPI-1294` integration probe. If Linear still does not discover it or move the issue to In Review, grant `amoai-tech/ipixai` repository/code access to the existing Linear GitHub integration, then repeat the probe before marking IPI-1294 Done.

## Durable sources

- Product: `docs/prd.md`
- Roadmap: `docs/roadmap.md`
- Documentation/workflow standard: `docs/ipix-platform/BEST-PRACTICES.md`
- Shipped history: `changelog.md`
