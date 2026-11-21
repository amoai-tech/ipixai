# iPix Mastra MCP — Core → Advanced Roadmap

**Reviewed:** 2026-11-20 | **Code baseline:** `amoai-tech/ipixai` `origin/main` `07829181` | **Pinned:** Mastra Core 1.84.0, CLI 1.40.0. Reverify before implementation. This document is planning, not feature certification.

## Main decision

**Do not build an MCP platform just to fill the Studio MCP page.** Start with one safe, read-only **built-in MCP server smoke test**, then connect one carefully selected external MCP provider **only if an existing iPix feature actually needs it**. Keep production iPix on its existing Next.js / CopilotKit / Mastra / Supabase paths.

**Real-world example:** An iPix engineer asks a local coding assistant, “Which Mastra workflows does my test environment expose?” The assistant can inspect permitted, **read-only metadata** through an authenticated MCP connection. It cannot approve Brand DNA, edit a Shoot, run a paid crawl, or access another organization's data.

## What is verified now

| Item | Current evidence | Conclusion |
| --- | --- | --- |
| `http://127.0.0.1:4211/mcps` | HTTP 200 for UI HTML | Page reachable, **not** proof that the MCP backend is functional |
| `http://127.0.0.1:4211/api/mcp` | Anonymous HTTP 401 | Auth applies; authenticated MCP tool discovery **not yet tested** |
| `http://127.0.0.1:4211/api/mcp/builtin` | Anonymous HTTP 401 | Studio descriptor requires auth / permission |
| `@mastra/mcp` | Not pinned in `origin/main/package.json` or package-lock; absent as directly resolvable package in inspected installed 1.84 checkout | Required optional MCP package not installed as an iPix dependency |
| `mcpServers` and `server.mcp` | Absent from `src/mastra/runtime.ts` on current main | No custom MCP registrations; built-in endpoint needs separate readiness checks |
| Production Planner | Seven product tools; existing activeTools gate | **Do not bypass** when exposing via MCP |
| Existing separate 4111 Studio | Old 1.71 checkout; 4211 is patched main 1.84 checkout | Retain version distinction during testing |

**Do not infer:** a real MCP tool is executable from a Studio card, a 401 equals feature readiness, or an authenticated 501 has been observed. The exact authenticated result has not been checked in this research pass.

## The three architectures — choose deliberately

| Direction | Purpose | iPix decision |
| --- | --- | --- |
| **iPix as MCP Client** | Mastra agent calls an outside provider's scoped tools (e.g., read-only authorized catalog) | **Conditional Core** only for a named user feature; existing SDK/service first |
| **Built-in Mastra MCP Server** | External developer assistant can inspect/use *permitted* Mastra tools, agents and workflows through existing HTTP routes | **First read-only proof**; validate package, authentication, permissions, REST routes |
| **Custom Mastra MCPServer** | Publish a curated tool/resource/prompt API for outside consumers | **Advanced, deferred** until a concrete outside consumer needs it; no generic exposure of every tool |

**Not the same as:** ACP (coding-agent protocol), A2A (remote agent delegation), Mastra Studio itself, or MCP Apps (interactive embedded UI). These are separate choices, not prerequisites.

## Architecture boundary

~~~mermaid
flowchart TD
  D["Local developer / external MCP client"] --> B{"Built-in MCP endpoint enabled?"}
  B -->|"No"| X["Explicit unavailable/disabled response"]
  B -->|"Yes"| T["Existing Mastra HTTP authentication + authorization"]
  T -->|"Denied"| Z["401/403, no tool execution"]
  T -->|"Allowed"| R["Bounded, read-only discovery/test"]
  R --> I["Existing seven Planner tools and workflows"]
  O["Authenticated iPix operator /app"] --> N["Existing CopilotKit → Mastra Planner"]
  N --> G["Current activeTools + domain security"]
  G --> I
  I --> S["Existing Supabase and approved workflows"]
  E["Future provider MCP server"] --> C["Server-scoped MCPClient only for a named feature"]
  C --> G
~~~

**Critical:** The built-in server exposes registered Mastra capabilities, not an automatic copy of CopilotKit's per-turn `activeTools` policy. Validate every exposed operation's *own* route and domain checks; **readOnly / include / exclude settings are not substitutes for authenticated server authorization**.

## Documents

1. [01 — Core → Advanced implementation roadmap](./01-roadmap.md): ordered stages, actual file owners, existing Linear tasks, test gates and application boundaries.
2. [02 — Review of all supplied Mastra MCP links](./02-reference-review.md): 15 URL entries (14 distinct; one repeated), including Studio and GitHub examples.
3. [03 — Existing Linear task mapping and proposed new tasks](./03-task-proposals.md): what to reuse, one concrete new baseline task draft, and what **not** to create.

## Rule for every change

Current iPix code + installed versions → verified existing Linear owner → official Mastra docs/types → smallest native integration → focused tests → real authorized /app or MCP Inspector proof → exact-head CI → post-merge check.

Do not install `@mastra/mcp@latest` blindly, use service-role credentials for Studio, open private/customer data to a generic MCP client, or copy old MCP 1.x examples without checking the protocol.

**Status:** Documentation only. No packages installed, MCP servers exposed, ports opened, authentication changed, provider credentials touched, tools executed, or databases modified.
