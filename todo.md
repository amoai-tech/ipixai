---
title: Current execution handoff
---

# Current execution handoff

Linear is the authoritative task/status source: https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

## Current

- IPI-1294 · LINEAR-WORKFLOW-001 — Standardize Linear, GitHub, Docs, TODO, and Changelog Workflow
- Branch: `ai/ipi-1294-linear-github-integration-probe`
- PR: https://github.com/amoai-tech/ipixai/pull/261 — real post-configuration GitHub ↔ Linear automation probe.
- State: PR #261 is the live GitHub ↔ Linear probe. Linear discovers the PR, and the native PR-ready automation has now moved IPI-1294 to In Review without a fake reviewer.
- Last proof: commit `faab3bd9f699efe953f1e1dd1197c5a038c75b2c` adds the tested post-merge local-main sync gate. Live iPix1 Git automation now maps PR open/ready to In Review and has no merge → Done rule; Draft → Ready on PR #261 moved IPI-1294 to In Review.
- Remaining blocker: finish the fresh exact-head CI/review loop, merge PR #261 when green, then prove exact-main CI plus safe local-main synchronization (`main...origin/main = 0 0`) before marking IPI-1294 Done.
- Next action: refresh comments/checks on the final PR #261 head, resolve any valid findings, merge only when the exact-head gate is green, then run post-merge verification and local-main synchronization before setting IPI-1294 Done.

## Durable sources

- Product: `docs/prd.md`
- Roadmap: `docs/roadmap.md`
- Documentation/workflow standard: `docs/ipix-platform/BEST-PRACTICES.md`
- Shipped history: `changelog.md`
