# iPix CopilotKit v2 Conventions

Use this file for **legacy → current API translation** and upgrade-specific rules.

For the **current iPix CopilotKit↔Mastra runtime contract** — the installed
package family, the Production architecture, the minimal route shape, the HITL
protocol choice, and the security/persistence invariants — read
[`../integrations/references/integrations/mastra.md`](../integrations/references/integrations/mastra.md).
That file is canonical. This one must not restate it: two copies of the same
runtime truth drift apart, and only one of them gets updated when the runtime
changes. Installed package source/types outrank both references when they
disagree, and `package.json` + the lockfile outrank all three.

## Legacy → current API translation

Import the current React v2 APIs from `@copilotkit/react-core/v2` unless the installed source for the target component says otherwise.

| Legacy pattern | Current iPix v2 direction |
|---|---|
| `useCoAgent` | `useAgent` |
| `useCopilotReadable` | `useAgentContext` |
| `useCopilotAction` | `useFrontendTool` |
| render inside `useCopilotAction` | `useRenderTool` / `useRenderToolCall` or activity rendering as appropriate |
| `useCopilotChatSuggestions` | `useConfigureSuggestions` + `useSuggestions` |
| package-root v1 provider | `CopilotKit` from `@copilotkit/react-core/v2` |
| old framework endpoint helpers | `createCopilotHonoHandler` for Hono/Next.js runtime integration |

Do not mechanically translate an old hook name without checking the installed `@copilotkit/react-core/v2` types. Current installed exports include `useAgent`, `useAgentContext`, `useFrontendTool`, `useHumanInTheLoop`, `useInterrupt`, `useRenderTool`, `useRenderToolCall`, `useConfigureSuggestions`, and `useSuggestions`.

### Runtime endpoint factory — version-qualified

**Installed `@copilotkit/runtime 1.88.0`:** prefer `createCopilotHonoHandler`; `createCopilotEndpoint` is deprecated. The current iPix route already uses `createCopilotHonoHandler` (merged PR #347); do not reintroduce the alias.

Treat the factory name as **version-qualified guidance, not a permanent API name**. Upstream documentation surfaces currently also describe `createCopilotEndpointHono` and `createCopilotRuntimeHandler` variants, so re-check the installed `@copilotkit/runtime/v2` exports and types after any CopilotKit upgrade before relying on this name. The route shape itself lives in the canonical Mastra integration reference.

## Historical pins and newer CopilotKit releases — not installed APIs

As reviewed on iPix `main` on 2026-11-20, `package.json` and `package-lock.json` pinned `@copilotkit/react-core` and `@copilotkit/runtime` **1.88.0**, `@copilotkit/channels` **0.12.0**, `@ag-ui/core` and `@ag-ui/client` **1.0.2**, and `@ag-ui/mastra` **2.0.2**. This is a dated audit result, **not a promise about the version in a future checkout**. Earlier CopilotKit baselines were 1.73.3 and 1.85; never treat historical release tasks as the package inventory. Recheck lockfile, installed exports and the current release task before applying any of the following.

**Reference — REFERENCE ONLY:** https://github.com/CopilotKit/CopilotKit/blob/6f8e51b4682e1e5ff733895d11d099ff5afd015b/CHANGELOG.md → sections `1.89.0` and `1.90.0`. Use these to identify candidate behavior; **do not copy** APIs, hosted Intelligence setup, generated context, or telemetry configuration into the pinned 1.88 runtime. **Apply to:** a separately reviewed future CopilotKit package-upgrade task, not this skill refresh. **Verify:** exact installed exports/types, route tests, auth/tenant boundaries, event/replay/Stop tests, and authorized operator journey.

| Official release | What changed upstream | iPix application and guard |
| --- | --- | --- |
| **1.89.0** | An optional display `name` can differ from the agent registry ID. | **MODEL:** show “Ask iPix” to the operator, while preserving the server-registered `default` ID for routing, Stop and persistence. Do not rename the registry key or trust browser-supplied identity. |
| **1.89.0** | MCP Apps can opt into `ui/update-model-context` via the v2 provider's `mcpApps={{ modelContext: true }}`. | **REFERENCE ONLY:** a campaign filter or selected product might enter the *next* agent turn. This is off by default. An MCP server's widget could inject unseen prompt context, so leave it **disabled** until trusted-server scope, per-tenant provenance, injection handling and user-visible consent are reviewed. A2UI/UI context is not authorization or durable business truth. |
| **1.90.0** | Runtime reports the agent adapter's declared framework in an OSS telemetry event; the Core SDK also forwards its version when connecting to an Intelligence gateway. | **REFERENCE ONLY:** audit privacy and telemetry opt-out before upgrading. The Intelligence gateway feature is not a reason to add managed Intelligence to iPix's self-hosted Planner. |

**Verify before enabling newer capabilities:** check the installed `@copilotkit/react-core/v2` and `@copilotkit/runtime/v2` APIs; ensure Org A's context cannot reach Org B, model context cannot trigger writes, an untrusted MCP widget cannot influence approved actions, and the `default` agent still streams, Stops, replays and resumes correctly. The 1.89/1.90 changelog is **not evidence these capabilities ship in iPix 1.88**.

## Upgrade rules

- **A reference update is not a dependency upgrade.** Re-read `package.json`, the lockfile, and installed types before implementing against a future package family; any family change needs its own task and compatibility proof.
- **Retired pins must not reappear.** If a reference still names a superseded version as current, fix the reference rather than the version.
- **Installed source outranks every document**, including this one and any upstream page. Where an upstream page contradicts installed `@ag-ui/mastra` or `@copilotkit/runtime` behaviour, the installed source wins and the contradiction should be recorded.

## Verification before changing Product runtime code

1. Re-read `package.json`, lockfile, and the installed runtime/react/AG-UI types.
2. Inspect `src/app/api/copilotkit/[[...slug]]/route.ts`, `src/agent.ts`, `src/lib/copilotkit/tenant-abort-runner.ts`, and `src/mastra/pg-store.ts`.
3. Check the current official CopilotKit Mastra example and current HITL docs/source.
4. Keep the current in-process architecture unless a separate evidence-backed architecture task explicitly changes it.
5. Run the narrow contract tests first, then the owning skill/registry checks.

For the detailed CopilotKit↔Mastra source mapping and pinned upstream example, see
[`../integrations/references/integrations/mastra.md`](../integrations/references/integrations/mastra.md).
