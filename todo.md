---
title: Current execution handoff
---

# Current execution handoff

Linear is the authoritative task/status source: https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

## Current

- IPI-1294 · LINEAR-WORKFLOW-001 — Standardize Linear, GitHub, Docs, TODO, and Changelog Workflow
- Branch: `ipi-1294-linear-workflow-governance`
- PR: https://github.com/amoai-tech/ipixai/pull/258
- State: four-template routing, canonical workflow docs, handoff/changelog ownership, and strengthened governance regression tests are implemented and pushed.
- Live verification evidence: PR #258 + IPI-1294. Keep exact SHA, CI, and review state there instead of copying transient values into this handoff.
- PR merge gate: exact-head CI and review state must be green; then merge PR #258 and run exact-main post-merge proof.
- Live Linear template checkpoints: synchronized through authenticated `linear-cli` with read-back verification; structural maintainability/refactor gates are also live in all four approved templates.
- Remaining IPI-1294 work (not PR merge blockers): finish canonical external-reference field synchronization where still missing, retire the rule-only `reuse-rule-linear-task`, and verify/fix GitHub ↔ Linear PR/status automation before marking IPI-1294 Done.
- Next action: finish current-head review/CI on PR #258; if green, merge/certify exact `main`; then complete the remaining Linear template retirement/reference-field and integration settings work.

## Durable sources

- Product: `docs/prd.md`
- Roadmap: `docs/roadmap.md`
- Documentation/workflow standard: `docs/ipix-platform/BEST-PRACTICES.md`
- Shipped history: `changelog.md`
