---
title: Current execution handoff
---

# Current execution handoff

Linear is the authoritative task/status source: https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

## Current

- IPI-1294 · LINEAR-WORKFLOW-001 — Standardize Linear, GitHub, Docs, TODO, and Changelog Workflow
- Branch: `ai/ipi-1294-linear-github-integration-probe`
- PR: https://github.com/amoai-tech/ipixai/pull/261 — real post-configuration GitHub ↔ Linear automation probe.
- State: Repository governance work is merged and exact-main certified. Linear GitHub code access is now enabled for `amoai-tech/ipixai`; the remaining work is to prove native PR discovery and automatic issue status transitions with one real PR.
- Last proof: PR #259 merged at `a057512a312c21cad066d9bf765b9de7eb1f75f8`; exact-main CI #1291 passed. The Linear GitHub settings now show `amoai-tech/ipixai` linked to iPix1 with code access enabled.
- Remaining blocker: verification only — PR #261 is now discovered by Linear Reviews/Diffs. Prove the configured `review → In Review` transition with a real review-request event, then after an approved merge prove `merge → Done`.
- Next action: keep PR #261 open through normal CI/review, trigger a real review request when a reviewer is available, and verify IPI-1294 moves to In Review. Do not mark IPI-1294 Done until the merge transition is also proven.

## Durable sources

- Product: `docs/prd.md`
- Roadmap: `docs/roadmap.md`
- Documentation/workflow standard: `docs/ipix-platform/BEST-PRACTICES.md`
- Shipped history: `changelog.md`
