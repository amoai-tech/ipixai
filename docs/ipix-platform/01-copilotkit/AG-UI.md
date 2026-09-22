# CopilotKit AG-UI

> Status: Placeholder — current event contract and UI-state mapping still need consolidation.

## Purpose

Document how CopilotKit/AG-UI carries agent events, streaming state, generative UI, reconnect/replay, and operator-visible state in iPix.

## Required sections

- Current AG-UI package/version baseline
- Event flow from Mastra to CopilotKit UI
- Message/state ownership
- Reconnect and replay contract
- Generative UI/component events
- Error and terminal events
- Cross-tenant isolation requirements
- Regression tests and acceptance evidence

## Primary source material

- Current iPix runtime code, tests, installed package source/types, and lockfile versions.
- [iPix platform documentation index](../README.md).
- [Documentation standards](../00-platform/DOC-STANDARDS.md).
- [IPI-1293 · AGENT-PLATFORM-001 — Rebuild forward from proven CopilotKit + Mastra architecture](https://linear.app/amo100/issue/IPI-1293/ipix-agent-platform-agent-platform-001-rebuild-forward-from-proven).
- [IPI-1117 · Fix Copilot runs across Vercel instance changes](https://linear.app/amo100/issue/IPI-1117/ipi-1117-fix-copilot-runs-across-vercel-instances) for distributed-run evidence where relevant.

Do not use stale `mastra-agui-dojo` examples as implementation authority; verify against current iPix tests and installed packages.
