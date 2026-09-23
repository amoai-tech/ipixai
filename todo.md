---
title: Current execution handoff
---

# Current execution handoff

Linear is the authoritative task/status source: https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues

## Current

- IPI-1294 · LINEAR-WORKFLOW-001 — Standardize Linear, GitHub, Docs, TODO, and Changelog Workflow
- Branch: `ai/ipi-1294-linear-github-integration-probe`
- PR: pending — this branch is the real post-configuration GitHub ↔ Linear automation probe.
- State: Repository governance work is merged and exact-main certified. Linear GitHub code access is now enabled for `amoai-tech/ipixai`; the remaining work is to prove native PR discovery and automatic issue status transitions with one real PR.
- Last proof: PR #259 merged at `a057512a312c21cad066d9bf765b9de7eb1f75f8`; exact-main CI #1291 passed. The Linear GitHub settings now show `amoai-tech/ipixai` linked to iPix1 with code access enabled.
- Remaining blocker: verification only — prove that a new `IPI-1294` PR appears in Linear Reviews/Diffs and automatically moves the issue `In Progress → In Review`; after an approved merge, prove `In Review → Done`.
- Next action: open this focused docs-only PR with `IPI-1294` in the branch/title and verify Linear discovers it and moves IPI-1294 to In Review automatically. Do not mark IPI-1294 Done until the merge transition is also proven.

## Durable sources

- Product: `docs/prd.md`
- Roadmap: `docs/roadmap.md`
- Documentation/workflow standard: `docs/ipix-platform/BEST-PRACTICES.md`
- Shipped history: `changelog.md`
