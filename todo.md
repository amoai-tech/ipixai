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
- Remaining IPI-1294 work (not PR merge blockers): synchronize/retire live Linear template definitions through an authorized template-edit path and verify/fix GitHub ↔ Linear PR/status automation before marking IPI-1294 Done.
- Next action: finish exact-head PR review/CI; if green, merge/certify PR #258; then complete the live Linear template + integration settings work.

## Durable sources

- Product: `docs/prd.md`
- Roadmap: `docs/roadmap.md`
- Documentation/workflow standard: `docs/ipix-platform/BEST-PRACTICES.md`
- Shipped history: `changelog.md`
