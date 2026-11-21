# 02 — Every Supplied Mastra MCP Reference Reviewed

**Product-goal correction:** MCP is for **iPix product agents and their useful tools** (Brand DNA, Shoot Plans, Assets, Research, CRM). Mastra in-process agents already call native `createTool` directly: use `MCPClient` when connecting a justified outside MCP provider, or a curated `MCPServer` to reuse those same tools across agent/process boundaries. The built-in `/api/mcp` and local Studio are **developer validation tools**, not the primary product feature. See [README.md](./README.md) and [01-roadmap.md](./01-roadmap.md) for the ranked product roadmap.

**Date:** 2026-11-20. **Source hierarchy:** current iPix origin/main (07829181) + pinned 1.84.0 installed modules → Mastra Docs/Context7 → official current web docs → upstream GitHub examples. The supplied list includes **15 entries, 14 distinct URLs** because connections/mcp is repeated. This table accounts for all 15.

| # | Supplied URL | What it actually establishes | iPix decision |
| --- | --- | --- | --- |
| 1 | [Local Mastra Studio MCP page](http://127.0.0.1:4211/mcps) | UI responds 200; anonymous /api/mcp and /api/mcp/builtin respond 401; `@mastra/mcp` not declared or directly installed | **Developer QA test, not product feature.** Authenticated discovery and tools/list remain unproven. Do not bypass auth just for Studio |
| 2 | [Agent processors](https://mastra.ai/docs/agents/processors) | Input/output processors control messages, sanitize content, enforce model-side constraints | **Conditional** for untrusted external MCP outputs / prompt injection; not a substitute for server authorization |
| 3 | [Mastra docs index](https://mastra.ai/docs) | Current framework entry point; release examples may target newer versions | **Navigation only.** No version-independent implementation assumption |
| 4 | [MCPClient reference](https://mastra.ai/reference/tools/mcp-client) | MCPClient connects to stdio or HTTP servers; `listTools()`, toolsets, lifecycle, error handling, per-server configuration | **Conditional Core.** Only connect to a proven provider; per-user credentials must not leak into shared static tools |
| 5 | [MCPServer reference](https://mastra.ai/reference/tools/mcp-server) | Explicit selected agents/tools/workflows, prompts/resources and transports for third-party clients | **Advanced.** Don't build a custom server when built-in is enough, and don't export all iPix tools |
| 6 | [Connections > MCP](https://mastra.ai/docs/connections/mcp) | Client vs server, local command vs remote URL, auth and server registration | **Core concept.** Use the right direction instead of duplicating agent runtime |
| 7 | [Connections > MCP, repeated](https://mastra.ai/docs/connections/mcp) | Exact duplicate of #6 | **No separate implementation.** Kept for requested source completeness |
| 8 | [Why We're All-In on MCP](https://mastra.ai/blog/mastra-mcp) | Mar 5, 2025 article on tool integration/discovery problems and MCP benefits | **Background only.** Predates protocol 2026-07-28; do not copy old transport/session setup |
| 9 | [Built-in MCP server](https://mastra.ai/docs/server/mcp) | Optional `@mastra/mcp`; built-in `/api/mcp` wraps registered routes with auth; Studio descriptor `/api/mcp/builtin`, status/metadata | **Use only when a product or external client needs it.** Pin compatible package; verify route permissions including REST tool execute, not just Studio card |
| 10 | [Mastra MCP server workshop](https://github.com/mastra-ai/mcp-server-best-practice-workshop) | Demo with two workflow-shaped tools, schema resource, RBAC/SELECT-only query, API rate-limit examples | **Design inspiration.** Reuse “few clear tools, read-only default”; never transplant its sample `run_sql` or demo keys into iPix |
| 11 | [Connections overview](https://mastra.ai/docs/connections/overview) | MCP for external tools/resources; A2A remote agents; ACP coding agents; provider SDK runtimes | **Architecture rule.** MCP is not the same as ACP or A2A; don't use an MCP registry to solve agent delegation |
| 12 | [Introducing MCP 2.0](https://mastra.ai/blog/introducing-mcp-2) | Oct 21, 2026: `@mastra/mcp` v2 / 2026-07-28, stateless server semantics and compatibility caveats | **Use as version authority.** Client/server migration test needed; avoid stale `/sse` and sessions |
| 13 | [createTool reference](https://mastra.ai/reference/tools/create-tool) | Typed Mastra tools: Zod input/output, execute callback and contextual fields | **Already core.** Reuse current seven iPix tools; no second tool abstraction |
| 14 | [Mastra personal assistant example](https://github.com/mastra-ai/personal-assistant-example) | Older example of multiple third-party MCP servers (Zapier, GitHub, Hacker News, text editor) and agent memory | **Reference only.** Do not copy broad write/file-system integrations into product, or infer current compatibility |
| 15 | [Reference with ACP filter](https://mastra.ai/reference?list=acp) | General API/reference page filtered to **ACP**, not a dedicated MCP integration guide | **Not an MCP requirement.** Use direct MCP references instead |

## Two important current-doc details

### Built-in vs custom server

The **built-in MCP server** at `/api/mcp` can expose existing Mastra primitives without a new `MCPServer` class. It uses existing HTTP permission checks and has configuration for served toolsets and read-only limits. `@mastra/mcp` is an **optional dependency**. Missing dependency can result in HTTP **501 after the request reaches the MCP handler**, but iPix's *observed* anonymous requests returned **401** at the auth boundary; a 501 is **not yet directly observed**.

Studio's `GET /api/mcp/builtin` is a **descriptor**, not a substitute for MCP tools/list: it reports status, endpoint and toolset categories, not every per-caller permitted tool. The Studio UI alone is not proof of actual agent usage. Built-in server selection can constrain readOnly and toolsets, but end-user/tenant permissions must still be validated when a tool executes.

### MCP v2 and client compatibility

The official Oct 2026 migration guide (supplementary reference): [Migrate @mastra/mcp from v1 to v2](https://mastra.ai/reference/migrations/mcp-v2).

- MCP v2 **server** speaks protocol 2026-07-28 with self-contained requests, no stored server session. Streamable HTTP continues to use streaming response framing.
- Current **client** can negotiate with legacy servers, subject to feature availability. The built-in server docs separately describe protocol support for both 2026-07-28 and 2025 client revisions.
- Old `/sse` paths and `sessionId` settings are outdated for v2 servers; follow versioned examples, not blog snippets from 2025.
- `@mastra/core >=1.76` is the documented minimum peer family for MCP v2; iPix Core 1.84 meets this **version constraint**, but application compatibility and provider tools still require tests.

### Authentication is broader than the MCP transport

Supplementary source: [Mastra MCP authentication and authorization guide](https://mastra.ai/docs/guides/mcp-authentication-authorization).

MCP route access requires authenticating the caller **and** deciding which org's data/tools they may access. If publishing a custom MCP server, verify **both** transport and Studio REST routes (`/api/mcp/:serverId/tools/:toolId/execute`, resource routes). A custom middleware that protects only the `/mcp` transport is insufficient. Use existing `server.auth`, server-derived actor/org, per-tool read permissions and domain checks.

## Reuse decisions for external integrations

| Example external capability | Existing iPix owner | Recommended integration |
| --- | --- | --- |
| Research via public websites | IPI-1477 / IPI-1251 | Existing Brand/source research or narrow provider-native read-only tool first |
| Shopify product catalog | IPI-1302 | Canonical ProductRef from Shopify SDK/API; MCP only if better |
| XPOZ public social observations | IPI-1156 | Existing narrow SDK wrapper, not whole XPOZ MCP catalog |
| CRM contact lookup | IPI-1478 | Existing iPix CRM/domain API first; optional per-user read-only MCP |
| iPix developer coding tools | IPI-1219 | Developer-only harness, **not** production Planner tools |

## Version and evidence limitations

1. Mastra 1.84.0 present and two local Studio servers listening; no direct iPix dependency `@mastra/mcp` on main or in the inspected new local worktree.
2. iPix has zero custom `mcpServers` registrations in its current `src/mastra/runtime.ts`.
3. Local browser HTML `/mcps` returned 200; the anonymous MCP API/descriptor returned 401. No authenticated MCP client list/invoke was claimed.
4. No live provider OAuth, external tool invocation, secret retrieval, write, deploy or workflow run was performed.
5. Source descriptions are current upstream guidance; exact installed types and product constraints must govern implementation.

**Next:** [01-roadmap.md](./01-roadmap.md) for delivery; [03-task-proposals.md](./03-task-proposals.md) for existing Linear owners and genuinely new work.
