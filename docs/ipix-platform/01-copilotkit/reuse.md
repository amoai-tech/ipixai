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

- `../80-plans/iPix Reference Reuse Matrix.md`
- `../80-plans/prd-ipix-agent-platform.md`

## Rule

Repo existence, stars, or README claims are discovery evidence only. COPY/ADAPT requires exact source inspection and compatibility proof against the iPix package family.