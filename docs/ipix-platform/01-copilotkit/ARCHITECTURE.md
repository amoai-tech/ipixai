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

- Current iPix runtime code, tests, installed package source/types, and lockfile versions.
- [iPix platform documentation index](../README.md).
- [Documentation standards](../00-platform/DOC-STANDARDS.md).
- [IPI-1293 · AGENT-PLATFORM-001 — Rebuild forward from proven CopilotKit + Mastra architecture](https://linear.app/amo100/issue/IPI-1293/ipix-agent-platform-agent-platform-001-rebuild-forward-from-proven).
- [IPI-1117 · Fix Copilot runs across Vercel instance changes](https://linear.app/amo100/issue/IPI-1117/ipi-1117-fix-copilot-runs-across-vercel-instances) for distributed-run evidence where relevant.

Do not copy stale architecture claims without re-verifying current code and installed package versions.
