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

- `../80-plans/iPix Reference Reuse Matrix.md`
- `../80-plans/prd-ipix-agent-platform.md`
- `../80-plans/iPix Agent Platform — Migration Plan.md`

Do not use stale `mastra-agui-dojo` examples as implementation authority; verify against current iPix tests and installed packages.