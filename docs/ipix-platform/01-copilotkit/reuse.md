# CopilotKit Reuse Plan

> Status: Placeholder — exact reuse decisions must be version-pinned before implementation.

## Purpose

Record what iPix should KEEP, COPY, ADAPT, MODEL, REFERENCE, or SKIP from CopilotKit itself and related maintained examples.

## Required matrix

| Capability | Current iPix | Reference | Version/commit | Action | Exact reuse | Do not copy | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CopilotKit ↔ Mastra integration | TBD | CopilotKit integration example | TBD | ADAPT | runtime/wiring pattern | demo auth/domain | TBD |
| Generative UI | TBD | CopilotKit generative-ui examples | TBD | ADAPT | typed UI patterns | demo business logic | TBD |
| Multi-agent UX | TBD | multi-agent canvas | TBD | MODEL | delegation UX | backend assumptions | TBD |
| Shared editable state | TBD | Mastra PM / maintained successor | TBD | MODEL/ADAPT | human+AI state UX | old package APIs | TBD |

## Primary source material

- Current iPix runtime code, tests, installed package source/types, and lockfile versions.
- [iPix platform documentation index](../README.md).
- [Documentation standards](../00-platform/DOC-STANDARDS.md).
- [IPI-1293 · AGENT-PLATFORM-001 — Rebuild forward from proven CopilotKit + Mastra architecture](https://linear.app/amo100/issue/IPI-1293/ipix-agent-platform-agent-platform-001-rebuild-forward-from-proven).
- [IPI-1117 · Fix Copilot runs across Vercel instance changes](https://linear.app/amo100/issue/IPI-1117/ipi-1117-fix-copilot-runs-across-vercel-instances) for distributed-run evidence where relevant.

## Rule

Repo existence, stars, or README claims are discovery evidence only. COPY/ADAPT requires exact source inspection and compatibility proof against the iPix package family.
