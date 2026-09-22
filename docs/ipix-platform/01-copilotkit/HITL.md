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

- `../_temp-pr241/PRD.md`
- `../80-plans/prd-ipix-agent-platform.md`
- `../80-plans/iPix Reference Reuse Matrix.md`

Linear owns live task status; this document owns the durable CopilotKit HITL interaction contract.