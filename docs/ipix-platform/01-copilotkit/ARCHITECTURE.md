# CopilotKit Architecture

> Status: Placeholder — consolidate current verified runtime architecture here.

## Purpose

Document where CopilotKit sits in iPix and the boundary between the browser, Next.js runtime, Mastra, Supabase, and external services.

## Required sections

- Current verified architecture
- CopilotKit Runtime boundary
- Authentication and tenant context
- Local vs remote Mastra integration
- Streaming, reconnect, replay, and Stop
- Shared state and generative UI
- Failure modes and recovery
- Version/dependency contract
- Production gates

## Primary source material

- `../80-plans/prd-ipix-agent-platform.md`
- `../80-plans/iPix Agent Platform — Migration Plan.md`
- `../80-plans/iPix Agent Platform — Roadmap.md`
- `../_temp-pr241/PRD.md`

Do not copy stale architecture claims without re-verifying current code and installed package versions.