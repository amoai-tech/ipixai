# ADR 004 — Upgrade CopilotKit + AG-UI + Mastra as one bundle

**Status:** Accepted · 2026-08-24
**Context:** Independent “latest” bumps previously broke AG-UI event shapes and HITL payloads.

**Decision:** Pin one mutually compatible family from the CopilotKit Mastra starter + `npm view` peers at implement time. One PR upgrades CopilotKit, `@ag-ui/mastra`, `@mastra/*`, and AI SDK together, with contract tests (agent ids, thread ids, interrupt payload, tool-result shape).

**Do not:** Dependabot-bump one package in the bundle alone. Snapshot versions in this folder are **not** install instructions.