# CopilotKit Progress

> Status: Readiness draft — verification is still TBD for the areas below; this is not a task tracker.

Linear owns live task status, blockers, assignees, and sequencing.

## Readiness snapshot

| Area | Status | Evidence | Next proof |
| --- | --- | --- | --- |
| Runtime/auth | TBD | Current repo + Agent Platform PRD | Re-verify exact HEAD |
| Streaming/AG-UI | TBD | Current tests | Confirm current package family |
| Reconnect/replay | TBD | Cross-process/replay tests | Re-run on target architecture |
| Stop/cancel | TBD | [IPI-1117 · Fix Copilot runs across Vercel instance changes](https://linear.app/amo100/issue/IPI-1117/ipi-1117-fix-copilot-runs-across-vercel-instances) + [IPI-1292 · RUNNER-SPIKE-001 — Spike 3 candidate architectures for cross-instance Copilot run ownership](https://linear.app/amo100/issue/IPI-1292/ipi-1117-runner-spike-001-spike-3-candidate-architectures-for-cross) evidence | Cross-instance termination proof |
| HITL | TBD | Existing approval patterns | Domain E2E proof |
| GenUI | TBD | Existing components/references | MVP workflow proof |
| Reuse qualification | TBD | Reuse matrix | Pin exact sources/versions |

## Rules

- Use Green / Yellow / Red only with evidence.
- Percent complete is optional and must be explainable.
- Link to Linear rather than duplicating task status.
- Update after verified architecture or production evidence changes.

Live execution: https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues
