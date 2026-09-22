---
title: Current execution handoff
---

# Current execution handoff

Linear is the authoritative task/status source: https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

## Current

- IPI-1294 · LINEAR-WORKFLOW-001 — Standardize Linear, GitHub, Docs, TODO, and Changelog Workflow
- State: four-template routing and cross-system governance are being verified on branch `ipi-1294-linear-workflow-governance`.
- Last proof: governance contract tests were RED on clean `origin/main` for missing template routing and handoff/changelog contracts.
- Blocker: the installed Linear connector can read/apply issue templates but does not expose template edit/delete operations.
- Next: finish repo verification, open the focused PR, verify exact-head CI, and record the remaining live-template edit action in IPI-1294.

## Durable sources

- Product: `docs/prd.md`
- Roadmap: `docs/roadmap.md`
- Documentation/workflow standard: `docs/ipix-platform/BEST-PRACTICES.md`
- Shipped history: `changelog.md`
