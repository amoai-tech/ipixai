# CopilotKit Human-in-the-Loop

> Status: Placeholder — consolidate the approved iPix HITL interaction pattern here.

## Purpose

Define how CopilotKit presents AI proposals for human review before consequential actions execute.

## Core rule

AI proposes → operator reviews exact artifact/action → server revalidates → authorized idempotent action executes → durable result is recorded and read back.

## Required sections

- Approval-card UX
- Exact revision / stale proposal protection
- Roles and authorization
- Approve / reject / edit / regenerate
- Server revalidation
- Idempotency and duplicate-click protection
- Audit evidence
- Failure/recovery behavior
- Accessibility and keyboard interaction
- Required tests

## Primary source material

- Current iPix runtime code, tests, installed package source/types, and lockfile versions.
- [iPix platform documentation index](../README.md).
- [Documentation standards](../00-platform/DOC-STANDARDS.md).
- [IPI-1293 · AGENT-PLATFORM-001 — Rebuild forward from proven CopilotKit + Mastra architecture](https://linear.app/amo100/issue/IPI-1293/ipix-agent-platform-agent-platform-001-rebuild-forward-from-proven).
- [IPI-1117 · Fix Copilot runs across Vercel instance changes](https://linear.app/amo100/issue/IPI-1117/ipi-1117-fix-copilot-runs-across-vercel-instances) for distributed-run evidence where relevant.

Linear owns live task status; this document owns the durable CopilotKit HITL interaction contract.
