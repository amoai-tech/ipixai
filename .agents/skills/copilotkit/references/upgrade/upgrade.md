---
name: copilotkit-upgrade
description: "Use when migrating a CopilotKit v1 application to v2 -- updating package imports, replacing deprecated hooks and components, switching from GraphQL runtime to AG-UI protocol runtime, and resolving breaking API changes."
version: 1.0.0
---

# CopilotKit v1 to v2 Migration Skill

> **Current iPix exception:** These are older migration examples, not a CopilotKit 1.85 package-upgrade recipe. iPix already uses `@copilotkit/runtime/v2` and `@copilotkit/react-core/v2`. Do **not** use the stale `@copilotkit/react` consolidation examples below to replace those installed imports. Verify the [official v2 migration guide](https://docs.copilotkit.ai/migrate/v2.md), installed source/types and [IPI-1389](https://linear.app/amo100/issue/IPI-1389) before changing dependencies.

## Live Documentation (MCP)

This plugin includes an MCP server (`copilotkit-docs`) that provides `search-docs` and `search-code` tools for querying live CopilotKit documentation and source code. Useful for looking up current v2 API signatures during migration.

- **Claude Code:** Auto-configured by the plugin's `.mcp.json` -- no setup needed.
- **Codex:** Requires manual configuration. See [debug MCP setup](../debug/debug.md#mcp-setup).

## Overview

CopilotKit v2 is a ground-up rewrite built on the AG-UI protocol (`@ag-ui/client` / `@ag-ui/core`). Users continue to install and import `@copilotkit/*` packages -- the v2 changes are exposed through the same package names with updated APIs (new hook names, component names, runtime configuration). The `@copilotkit/*` packages remain public imports; use version-specific `/v2` subpaths and verify installed exports.

## Migration Workflow

### 1. Audit Current Usage

Scan the codebase for all v1 imports and API usage:

```
@copilotkit/react-core    -> hooks, CopilotKit provider, types
@copilotkit/react-ui      -> CopilotChat, CopilotPopup, CopilotSidebar
@copilotkit/react-textarea -> CopilotTextarea (removed in v2)
@copilotkit/runtime       -> CopilotRuntime, service adapters, framework integrations
@copilotkit/runtime-client-gql -> GraphQL client, message types
@copilotkit/shared         -> utility types, constants
@copilotkit/sdk-js         -> LangGraph/LangChain SDK
```

### 2. Identify Deprecated APIs

Key hooks and components to find and replace:

| v1 API                             | v2 Replacement                                       |
| ---------------------------------- | ---------------------------------------------------- |
| `useCopilotAction`                 | `useFrontendTool`                                    |
| `useCopilotReadable`               | `useAgentContext`                                    |
| `useCopilotChat`                   | `useAgent` + `useSuggestions`                        |
| `useCoAgent`                       | `useAgent`                                           |
| `useCoAgentStateRender`            | `useRenderToolCall` / `useRenderActivityMessage`     |
| `useLangGraphInterrupt`            | `useInterrupt`                                       |
| `useCopilotChatSuggestions`        | `useConfigureSuggestions` + `useSuggestions`         |
| `useCopilotAdditionalInstructions` | `useAgentContext`                                    |
| `useMakeCopilotDocumentReadable`   | `useAgentContext`                                    |
| `CopilotKit` (root import)         | `CopilotKit` (from `@copilotkit/react-core/v2`)      |
| `CopilotTextarea`                  | Removed -- use standard textarea + `useFrontendTool` |

### 3. Map to v2 Equivalents

Refer to `references/v1-to-v2-migration.md` for detailed before/after code examples.

### 4. Update Package Dependencies

The `@copilotkit/*` package names stay the same. Historical translation table below (not the current iPix package install plan). Keep the installed `@copilotkit/react-core/v2` and `@copilotkit/runtime/v2` surfaces:

```
@copilotkit/react-core        -> @copilotkit/react-core/v2 (installed v2 export)
@copilotkit/react-ui           -> check current v2 UI exports; do not infer a @copilotkit/react replacement
@copilotkit/react-textarea     -> removed (no v2 equivalent)
@copilotkit/runtime            -> @copilotkit/runtime (same package, new agent-based API)
@copilotkit/runtime-client-gql -> legacy GraphQL client; v2 uses installed AG-UI packages
@copilotkit/shared             -> @copilotkit/shared (same package)
@copilotkit/sdk-js             -> @copilotkit/agent (new package for agent definitions)
```

### 5. Update Runtime Configuration

The v1 `CopilotRuntime` accepted service adapters (OpenAI, Anthropic, LangChain, etc.) and endpoint definitions. The v2 `CopilotRuntime` accepts AG-UI `AbstractAgent` instances directly.

**v1 pattern** (service adapter + endpoints):

```ts
import { CopilotRuntime, OpenAIAdapter } from "@copilotkit/runtime";
const runtime = new CopilotRuntime({ actions: [...] });
// used with copilotKitEndpoint() for Next.js, Express, etc.
```

**v2 pattern** (agents + Hono endpoint):

```ts
import { CopilotRuntime, createCopilotHonoHandler } from "@copilotkit/runtime/v2";
import { BuiltInAgent } from "@copilotkit/agent";
const runtime = new CopilotRuntime({
  agents: { myAgent: new BuiltInAgent({ model: "openai:gpt-4o" }) },
});
const app = createCopilotHonoHandler({ runtime, basePath: "/api/copilotkit" });
```

### 6. Update Provider

The provider component keeps the name `CopilotKit` -- only the import path changes. The package root (`@copilotkit/react-core`) is the legacy v1 provider; the `/v2` subpath is the migration target.

**v1 (root import):**

```tsx
import { CopilotKit } from "@copilotkit/react-core";
<CopilotKit runtimeUrl="/api/copilotkit">{children}</CopilotKit>;
```

**v2 (`/v2` import):**

```tsx
import { CopilotKit } from "@copilotkit/react-core/v2";
<CopilotKit runtimeUrl="/api/copilotkit">{children}</CopilotKit>;
```

> **Note:** `@copilotkit/react-core/v2` also exports a `CopilotKitProvider` component. Do **not** migrate to it -- it is a functionality subset of `CopilotKit`, which is the compatibility bridge across v1 and v2 and accepts every `CopilotKitProvider` prop.

### 7. Verify

- Run the application and check for runtime errors
- Verify all agent interactions work (chat, tool calls, interrupts)
- Check that tool renderers display correctly
- Confirm suggestions load and display

## Quick Reference

| Concept              | v1                                              | v2                                                                         |
| -------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| Package scope        | `@copilotkit/*`                                 | `@copilotkit/*` (same scope, updated APIs)                                 |
| Protocol             | GraphQL                                         | AG-UI (SSE)                                                                |
| Provider component   | `CopilotKit` (from `@copilotkit/react-core`)    | `CopilotKit` (from `@copilotkit/react-core/v2`)                            |
| Define frontend tool | `useCopilotAction`                              | `useFrontendTool`                                                          |
| Share app state      | `useCopilotReadable`                            | `useAgentContext`                                                          |
| Agent interaction    | `useCoAgent`                                    | `useAgent`                                                                 |
| Handle interrupts    | `useLangGraphInterrupt`                         | `useInterrupt`                                                             |
| Render tool calls    | `useCopilotAction({ render })`                  | `useRenderToolCall`                                                        |
| Chat suggestions     | `useCopilotChatSuggestions`                     | `useConfigureSuggestions`                                                  |
| Runtime class        | `CopilotRuntime` (adapters)                     | `CopilotRuntime` (agents)                                                  |
| Endpoint setup       | `copilotKitEndpoint()`                          | `createCopilotHonoHandler()`                                                  |
| Agent definition     | `LangGraphAgent` endpoint                       | `AbstractAgent` / `BuiltInAgent`                                           |
| Chat components      | `CopilotChat`, `CopilotPopup`, `CopilotSidebar` | `CopilotChat`, `CopilotPopup`, `CopilotSidebar` (from `@copilotkit/react`) |
