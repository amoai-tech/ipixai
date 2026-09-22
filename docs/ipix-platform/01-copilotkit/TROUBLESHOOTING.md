# CopilotKit Troubleshooting

> Status: Placeholder — add only verified failure modes and fixes.

## Purpose

Give engineers a fast path to diagnose CopilotKit runtime, streaming, reconnect, auth, and UI-state failures without repeating historical investigation.

## Troubleshooting areas

- Runtime endpoint/auth failures
- Missing or wrong tenant/resource context
- Stream starts but follow-up drops
- Refresh/reconnect loses history
- Stop/cancel does not terminate work
- Duplicate or late events
- AG-UI state mismatch
- Generative UI rendering failures
- Version compatibility failures
- Preview vs production differences

## Evidence format

For each failure record: symptom → likely layer → exact check → fix → verification → related issue/PR.

## Primary source material

- Current iPix runtime code, tests, installed package source/types, and lockfile versions.
- [iPix platform documentation index](../README.md).
- [Documentation standards](../00-platform/DOC-STANDARDS.md).
- [IPI-1293 · AGENT-PLATFORM-001 — Rebuild forward from proven CopilotKit + Mastra architecture](https://linear.app/amo100/issue/IPI-1293/ipix-agent-platform-agent-platform-001-rebuild-forward-from-proven).
- [IPI-1117 · Fix Copilot runs across Vercel instance changes](https://linear.app/amo100/issue/IPI-1117/ipi-1117-fix-copilot-runs-across-vercel-instances) for distributed-run evidence where relevant.

Do not copy old incident conclusions unless they still reproduce on the current version family.
