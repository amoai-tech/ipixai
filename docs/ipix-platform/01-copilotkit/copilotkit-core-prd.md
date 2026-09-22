# CopilotKit Core PRD

> Status: Placeholder — Core scope to be consolidated from verified current behavior and Agent Platform plans.

## Core outcome

One authenticated operator can use the iPix Copilot reliably with correct tenant context, streaming, refresh/reconnect behavior, Stop/cancel semantics, and no consequential silent writes.

## Core scope

- Authenticated Copilot runtime
- Server-derived user/org/resource context
- Stable stream lifecycle
- Durable replay/reconnect contract
- Stop/cancel contract
- Basic AG-UI event correctness
- Existing Planner interaction
- Cross-tenant denial
- Version compatibility proof

## Out of Core

- Rich generative UI library
- Multi-agent delegation UX
- Advanced shared-state editing
- Multi-surface channels

## Acceptance evidence

Use exact-head tests, two-process lifecycle proof where applicable, authenticated Preview journey, and zero cross-tenant leakage.