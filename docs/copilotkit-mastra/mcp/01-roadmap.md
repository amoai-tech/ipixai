# 01 — Core → Advanced MCP Implementation Roadmap

**Authority:** Verified iPix `origin/main` at `07829181` and Linear issue state on 2026-11-20; Mastra Core 1.84.0 / CLI 1.40.0. No live authenticated MCP tool invocation or external-provider connection was performed by this planning pass. Check exact version, PR and production SHA before implementation.

## Stage 0 — Core: Prove the existing server, not a new one

### P1 proposed new task — Prove One Authenticated, Read-Only MCP Connection to iPix's Existing Mastra Server

See [03-task-proposals.md](./03-task-proposals.md). This is a **new task draft**, not a created Linear ID. It is distinct from existing IPI-995 tool-governance and IPI-1002 generalized integration standardization.

**User story:** An engineer opens the existing Studio `/mcps` page and connects an MCP Inspector or Claude Code to the **existing** Mastra server. The client can list only allowed metadata/tools; invalid token and attempt to execute a Brand write are rejected.

**Fastest implementation sequence:**

1. **Record status before any installation:** exact main/PR and running app SHAs; `/mcps` UI; unauthenticated `/api/mcp` and `/api/mcp/builtin`; existing `server.auth` and local Studio `studio.auth`. A 401 is expected for anonymous; test authorized flows separately.
2. **Read package compatibility:** Core 1.84.0 meets the documented MCP 2.0 core peer minimum (>=1.76), but `@mastra/mcp` is not currently declared. Choose a **compatible pinned v2 version** only if the feature is needed. Do not mass-upgrade Mastra or install latest by default. Recheck the runtime's exact built-in server availability and version handling after install.
3. **Prefer native built-in server:** verify `server.mcp` defaults, built-in endpoint and descriptor. Do not create a second `MCPServer`, separate API host, or duplicate agent registry merely to show a card.
4. **Keep auth strict:** local loopback only for developer proof, existing Supabase-backed caller identity and server-side organization ownership; read-only metadata/test fixture, not customer data or privileged write. Verify `/api/mcp/*` transport **and** REST/Studio routes against caller permissions. Never forward user JWT into model messages.
5. **Inspect the actual MCP client:** use a trusted CLI/Inspector against `http://127.0.0.1:4211/api/mcp` with an authorized short-lived developer token managed outside git/URLs. Verify `tools/list`, one **safe read-only tool** (if exposed), and negative forbidden tool. The built-in server has per-caller tool discovery; don't assume the local Studio card shows the same list.
6. **Retest and document:** local authenticated/anonymous and wrong-org tests, request timeouts, client version negotiation, restart, log redaction; leave development workflow output truthful.

**Likely code/test owners (minimal, conditional):** `package.json` / lockfile, `src/mastra/runtime.ts`, `src/mastra/server-auth.ts`, `tests/mastra-mcp-availability.test.ts` (new if needed), `tests/mastra-mcp-authz.test.ts` (new), existing auth/route allowlist tests. **Do not alter `server.auth` globally just to enable Studio's MCP read badge.**

**Done when:** a *real* authenticated MCP client lists the intentionally exposed read-only capability, an explicitly unauthorized invocation is denied at the HTTP and domain boundary, and no separate service or new sensitive stored secrets were created.

~~~mermaid
sequenceDiagram
  participant D as Developer / MCP client
  participant M as Existing Mastra /api/mcp
  participant A as Existing server auth
  participant T as Existing authorized tool
  D->>M: tools/list with developer bearer
  M->>A: authenticate + authorize caller
  alt invalid or insufficient
    A-->>D: 401/403, no list or execution
  else allowed read-only
    A-->>M: scoped authorized identity
    M-->>D: permitted tools
    D->>M: call one safe read-only tool
    M->>T: recheck permitted action
    T-->>D: bounded metadata result
  end
~~~

## Stage 1 — Core: One useful external MCP integration, only if needed

**Existing owner:** [IPI-1002 · MASTRA-WF-009 — Standardize External Integrations Only After Repeated Need](https://linear.app/amo100/issue/IPI-1002) — Backlog, **not a blocker**. Use provider-specific product issue for the real feature; do not move M7 abstraction into the critical path.

Candidate business owners, each **already exists**:

| Existing task | Practical MCP use case | Fastest and safer choice |
| --- | --- | --- |
| [IPI-1477 · AGENTS-004 — Add Research Expert for Cited Competitor and Website Research](https://linear.app/amo100/issue/IPI-1477) — Backlog | “Compare three fashion competitors with cited sources” | Prefer current trusted research/crawl and provider SDK; evaluate one read-only MCP source only if it provides missing evidence |
| [IPI-1478 · AGENTS-005 — Add CRM Expert With Authorized Contact and Deal Context](https://linear.app/amo100/issue/IPI-1478) — Backlog | “Which contacts need follow-up?” | Existing internal CRM/RPC first; if external CRM MCP required, use user-scoped OAuth and read-only initial capability |
| [IPI-1302 · PRODUCTS-SHOPIFY-001 — Add Shopify as an Optional Read-Only Catalog Adapter](https://linear.app/amo100/issue/IPI-1302) — Todo | Read Shopify products/variants | Current Shopify GraphQL/SDK adapter first; MCP only if truly removes complexity without losing canonical ProductRef |
| [IPI-1156 · XPOZ-001 — Add Read-Only Social Intelligence to Brand Research](https://linear.app/amo100/issue/IPI-1156) — Backlog | Check public brand social trends with provenance | Issue already favors narrow official SDK wrapper; **do not mount full social MCP tool catalog** |
| [IPI-1219 · DSH-INTEGRATIONS-001 — Add Verified DeepSeek Harness Integrations, MCPs, Web Research, and Engineering Plugins](https://linear.app/amo100/issue/IPI-1219) — In Review | Developer tooling and code assistant integrations | **Developer harness only**, not a new production MCP feature |

**First slice:** Choose **one** named provider and one allowlisted read-only function, only after comparing direct API/SDK vs MCP on complexity, user consent, latency, availability, cost and tool truth.

**MastraClient options:**
- `MCPClient({servers:{...}})` with local `command + args` or remote Streamable HTTP `url`.
- `listTools()` is suitable for one app-owned credential and static dev configuration.
- For multi-tenant users, **do not load a shared personal API key into every user's agent**. Use per-request scoped credentials/toolsets, namespace exact provider tools and disconnect on shutdown; never put bearer tokens into prompts/client bundle.
- Tool descriptions and `ToolSearchProcessor` are not permission systems. Use existing activeTools and server-side domain checks even after MCP discovery.

**Proof:** selected provider can answer a real authorized read request with stable provenance, no access to another user's connection, no synthetic success, graceful outage and reconnect, and no surprise writes or unsolicited external costs.

## Stage 2 — Core: Security, reliability and discoverability

**Existing task owners:**

- [IPI-995 · MASTRA-WF-002 — Govern the Real iPix Tool Surface Without a Custom Registry Framework](https://linear.app/amo100/issue/IPI-995) — Backlog: inventory existing seven Planner tools, identify external MCP discovery/loaded-tool boundary only when one is truly integrated.
- [IPI-1143 · MASTRA-EPIC — Govern One Current Mastra Runtime Across iPix](https://linear.app/amo100/issue/IPI-1143) — In Progress: version pin, Studio vs production runtime ownership, compatibility and host boundary.
- [IPI-877 · PLATFORM-NATIVE-001 — Check Native Platform Features Before Building Custom Tools](https://linear.app/amo100/issue/IPI-877) — Backlog: prefer provider capability before custom MCP proxy.
- [IPI-1474 · AGENTS-001 — Prove Safe Concierge Delegation Before Changing the Agent Registry](https://linear.app/amo100/issue/IPI-1474) — Backlog: one Mastra runtime; external MCP is optional, **not** a requirement to delegate local specialist agents.
- [IPI-1208 · PLANNER-TOOLGATE-001 — Exclude Consequential Write Tools From the Planner's Tool Set During Plan-Generation Turns](https://linear.app/amo100/issue/IPI-1208) — Done: preserve the current narrower planning tool set when integrating external capabilities.

**Safety checklist:** actor/org mapped server-side; per-request OAuth audience/scope/expiry; provider metadata/schema validation; bounded timeouts/response sizes, cancel propagation, transport error handling, prompt injection in untrusted MCP outputs, logging redaction, no arbitrary process/file/browser tools, explicit authorized mutation boundaries, repeat/retry idempotency. Verify **transport and REST execution routes**, not just one MCP URL.

**Operational checks:** package peer compatibility, server startup no hanging stdio child processes, discovery timeout, disabled MCP falls back to normal Planner without fake tool availability, provider revocation immediately prevents use, no cross-tenant caching, Vercel/serverless compatibility for remote vs stdio.

## Stage 3 — Advanced: Publish selected iPix capabilities if a consumer exists

**Do not deploy a custom `MCPServer` without a confirmed external client** needing a curated set of iPix tools/resources. The built-in MCP server is a faster starting point but exposes registered categories subject to current HTTP auth. For carefully selected external access, define a narrow explicit server only after a consumer and scope are proven.

**Possible future use case:** An approved agency's coding assistant queries an iPix-owned read-only campaign brief or project status with its **own** restricted identity. It cannot edit campaign data or see unrelated client records.

- Explicitly allowlist safe read-only tools/resources; no automatic export of all seven Planner tools/workflows.
- Use native `MCPServer` and built-in `server.auth` / OAuth discovery or accepted identity provider; verify audience/scope/tenant.
- MCP v2's **2026-07-28** server protocol is stateless; distinguish from 2025 session-oriented clients. Test actual client compatibility, avoid old `/sse` tutorials, do not add sticky-session infrastructure.
- Test MCP transport, Studio REST tool execution and resource routes; do not enforce auth on only `/mcp` and leave sibling REST routes exposed.
- If the intended external client uses an older protocol, choose a documented version-compatibility plan; do not pretend all clients negotiate v2.
- Deferrable MCP Apps (`ui://` iframe views) add a separate sandbox/UI boundary. Do not duplicate the existing CopilotKit A2UI/GenUI product UI merely to support Studio.

**No new public URL or production endpoint until there is a named external consumer, auth and exact user journey.**

## Stage 4 — Advanced: Only measured expansion

| Capability | When useful | Decision |
| --- | --- | --- |
| OAuth token refresh / delegated provider access | Different iPix operators connect their own permitted external account | Add only for a selected provider; do not use app-wide service key |
| MCP prompts and resources | External client needs a stable read-only resource and source attribution | Start with one bounded resource; ensure org authorization |
| Elicitation / `input_required` | A provider asks for extra information mid-tool call | Verify host support and replay after suspend; no approval bypass |
| `ToolSearchProcessor` | Many already-authorized tools make prompts too large | Current Planner has seven; **defer** until measured improvement |
| MCP Apps in Studio | A tool's result is meaningfully interactive | Studio-only experiment; keep untrusted UI sandbox and no duplicate CopilotKit frontend |
| Observability and evals | Meaningful MCP tool failure/latency/cost warrants action | Reuse existing Sentry/Mastra traces and tests, no duplicate monitoring stack |

## Target checks for each implementation

1. **Static truth:** package installed/pinned, exact MCP endpoint, exposure map, server and agent auth remain strict, no secret import into client or logs.
2. **Transport:** client discovery with correct protocol, tools/list, one safe tool success, malformed input, failed upstream, timeout/reconnect, cancellation.
3. **Authorization:** anonymous 401; invalid/expired 401; wrong permission/tenant 403; read-only tool must not invoke Brand approval, paid crawl, Shoot save or another org's data.
4. **Lifecycle:** restart/redeploy doesn't leak subprocesses or stale cached cross-user credentials; no silent ephemeral claim.
5. **Business journey:** if external MCP added, demonstrate one real `/app` operator feature from user request → agent tool → source-backed UI result; database readback only for legitimately persisted data.
6. **Verification:** smallest Vitest → typecheck/lint → MCP Inspector and authenticated negative tests → browser Playwright if UI changes → exact-head CI → post-merge smoke.

**Recommendation:** Stage 0 readiness first; Stage 1 only when there is an actual missing external capability. Existing owners cover provider features and governance. **Do not create a new MCP registry epic**, and do not resurrect canceled [IPI-138 · AIOR-023 · MCP registry foundation](https://linear.app/amo100/issue/IPI-138).
