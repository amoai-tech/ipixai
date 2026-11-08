---
name: copilotkit-debug
description: "Use when diagnosing CopilotKit issues -- runtime connectivity failures, agent not responding, streaming errors, tool execution problems, transcription failures, version mismatches, and AG-UI event tracing."
version: 1.0.0
---

# CopilotKit Debugging Skill

> **Current iPix:** Start with the real authenticated runtime and installed package family. [Official CLI](https://docs.copilotkit.ai/cli.md) `verify --expect-runtime oss --agent default` can help on a **permitted test runtime**, but `--round-trip` calls a model and persists a thread. Never run an unpinned CLI, cloud setup, or a production round trip automatically. CLI PASS does not prove tools, SSE ordering, HITL, persistence or cross-tenant safety; use [the canonical lookup and verification contract](../../SKILL.md).

## When to Use

Invoke this skill when:

- The CopilotKit runtime is unreachable or returning errors
- Agents fail to connect, respond, or stream events
- Frontend tools are not executing or returning results
- Transcription (voice) is failing
- Version mismatch errors appear between packages
- AG-UI SSE events are malformed or missing
- CORS errors block browser requests to the runtime

## Diagnostic Workflow

### Step 1: Gather Information

Before proposing any fix, collect:

1. **Package versions** -- Run `npm ls @copilotkit/runtime @copilotkit/react-core @copilotkit/channels @ag-ui/client @ag-ui/mastra` (or the v1 equivalents). Version mismatches between runtime and react packages are a common root cause.
2. **Runtime mode** -- Is this SSE mode (`CopilotSseRuntime`) or Intelligence mode (`CopilotIntelligenceRuntime`)? Check the runtime constructor.
3. **Transport configuration** -- What is `runtimeUrl` set to on the `CopilotKit` provider (from `@copilotkit/react-core/v2`)? Does it match the `basePath` in `createCopilotHonoHandler`?
4. **Agent type** -- Is the agent a `BuiltInAgent`, `LangGraphAgent`, `A2AAgent`, or custom `AbstractAgent`?
5. **Error messages** -- Collect the exact error from browser console and server logs. CopilotKit uses structured error codes (see `references/error-patterns.md`).
6. **Browser network tab** -- Check the `/info` request (runtime discovery), the `/agent/:id/run` SSE stream, and any CORS preflight failures.

### Step 2: Check Logs and Error Codes

CopilotKit has three error code systems:

- **V1 error codes** -- Legacy error codes from the v1 runtime layer (`@copilotkit/runtime`). Codes like `NETWORK_ERROR`, `AGENT_NOT_FOUND`, `API_NOT_FOUND`. Still surfaced in some contexts since `@copilotkit/*` packages wrap v2 internally.
- **V2 `CopilotKitCoreErrorCode`** -- Used by `@copilotkit/core`. Codes like `runtime_info_fetch_failed`, `agent_connect_failed`, `agent_run_failed`.
- **`TranscriptionErrorCode`** -- Used by both v1 and v2 for voice transcription. Codes like `service_not_configured`, `rate_limited`, `auth_failed`.

Match the error code to the catalog in `references/error-patterns.md` for root cause and resolution.

### Step 3: Trace AG-UI Events

For streaming/agent issues, trace the AG-UI event flow:

1. **RunStartedEvent** -- Confirms the agent run was initiated
2. **TextMessageStartEvent / TextMessageChunkEvent / TextMessageEndEvent** -- Text streaming
3. **ToolCallStartEvent / ToolCallArgsEvent / ToolCallEndEvent** -- Tool invocations
4. **ToolCallResultEvent** -- Tool results flowing back
5. **StateSnapshotEvent / StateDeltaEvent** -- Agent state synchronization
6. **ReasoningStartEvent / ReasoningMessageContentEvent / ReasoningMessageEndEvent** -- Reasoning tokens (can cause stalls, see issue #3323)
7. **RunFinishedEvent** -- Successful completion
8. **RunErrorEvent** -- Agent-level error

Enable the CopilotKit Web Inspector (`@copilotkit/web-inspector`) to see events in real time. Or check the SSE stream directly in the browser Network tab -- each event is a `data:` line in the `text/event-stream` response.

### Step 4: Identify Root Cause

Use the reference documents to match symptoms to known issues:

- **`references/runtime-debugging.md`** -- Connectivity, CORS, transport, SSE streaming
- **`references/agent-debugging.md`** -- Agent discovery, state sync, tool execution, AG-UI protocol
- **`references/error-patterns.md`** -- Complete error code catalog with resolutions
- **`references/quick-workflows.md`** -- Step-by-step diagnostic sequences for common scenarios

### Step 5: Fix and Verify

1. Apply the fix
2. Verify the `/info` endpoint returns the expected agent list
3. Confirm the SSE stream produces a complete event sequence (RunStarted through RunFinished)
4. Check the browser console for any remaining structured errors

## Current docs lookup (use only connected tools)

Discover actual names/schemas first. There are **four** corpora: `search-docs` (product docs), `search-code` (library source), `search-ag-ui-docs` (protocol docs) and `search-ag-ui-code` (protocol SDK source). ChatGPT uses underscored names; `explore-docs` / `explore-code` may also be available.

A repo-local `.mcp.json` does **not** guarantee that every Claude, Codex or ChatGPT session has an MCP connection. When unavailable, use [CopilotKit docs `llms.txt`](https://docs.copilotkit.ai/llms.txt), focused `.md` pages, installed package types and [AG-UI docs](https://docs.ag-ui.com/llms.txt).

A signed-out request receiving `401` from `/api/copilotkit/info` can be correct tenant/auth behavior. Never use `login` or `project select` to make a self-hosted OSS runtime appear healthy.

## Key File Locations in the CopilotKit Codebase

| Component                    | Path                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| V1 Error classes & codes     | `packages/v1/shared/src/utils/errors.ts`                             |
| V2 Core error codes          | `packages/v2/core/src/core/core.ts` (`CopilotKitCoreErrorCode` enum) |
| V2 Transcription errors      | `packages/v2/shared/src/transcription-errors.ts`                     |
| Runtime SSE response         | `packages/v2/runtime/src/handlers/shared/sse-response.ts`            |
| Runtime info endpoint        | `packages/v2/runtime/src/handlers/get-runtime-info.ts`               |
| Runtime CORS config          | `packages/v2/runtime/src/endpoints/hono.ts`                          |
| Intelligence platform client | `packages/v2/runtime/src/intelligence-platform/client.ts`            |
| Agent package (BuiltInAgent) | `packages/v2/agent/src/index.ts`                                     |
| Web Inspector                | `packages/v2/web-inspector/src/index.ts`                             |
