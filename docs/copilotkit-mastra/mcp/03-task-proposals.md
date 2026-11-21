# 03 — Existing Linear Owners and New MCP Task Proposals

**Status:** Recommendations reviewed 2026-11-20. **No new Linear IDs assigned or issues created.** The user requested task suggestions, so avoid speculative duplicate tickets. Recheck current statuses and dependency titles at implementation.

## Existing tasks — reuse first

| Order | Existing verified Linear task and status | Ownership, not duplicated |
| --- | --- | --- |
| Core baseline | [IPI-1143 · MASTRA-EPIC — Govern One Current Mastra Runtime Across iPix](https://linear.app/amo100/issue/IPI-1143) — In Progress | Correct Mastra version, single runtime, dev Studio auth/registry owner |
| Core tool permissions | [IPI-995 · MASTRA-WF-002 — Govern the Real iPix Tool Surface Without a Custom Registry Framework](https://linear.app/amo100/issue/IPI-995) — Backlog | 5 compute and 2 Brand action visibility and execution policy |
| Existing native selection | [IPI-877 · PLATFORM-NATIVE-001 — Check Native Platform Features Before Building Custom Tools](https://linear.app/amo100/issue/IPI-877) — Backlog | Native SDK/API or built-in before custom MCP server |
| Integrations standard | [IPI-1002 · MASTRA-WF-009 — Standardize External Integrations Only After Repeated Need](https://linear.app/amo100/issue/IPI-1002) — Backlog | Reusable boundary **only after** repeated integration need; not first MCP test |
| Engineering MCPs | [IPI-1219 · DSH-INTEGRATIONS-001 — Add Verified DeepSeek Harness Integrations, MCPs, Web Research, and Engineering Plugins](https://linear.app/amo100/issue/IPI-1219) — In Review | Local development harness connectors; not customer-facing MCP |
| Brand research | [IPI-1477 · AGENTS-004 — Add Research Expert for Cited Competitor and Website Research](https://linear.app/amo100/issue/IPI-1477) — Backlog | Read-only cited research; optional provider MCP |
| CRM data | [IPI-1478 · AGENTS-005 — Add CRM Expert With Authorized Contact and Deal Context](https://linear.app/amo100/issue/IPI-1478) — Backlog | Correct tenant-scoped CRM access before optional provider MCP |
| Shopify catalog | [IPI-1302 · PRODUCTS-SHOPIFY-001 — Add Shopify as an Optional Read-Only Catalog Adapter](https://linear.app/amo100/issue/IPI-1302) — Todo | Existing ProductRef adapter and official SDK first |
| Social research | [IPI-1156 · XPOZ-001 — Add Read-Only Social Intelligence to Brand Research](https://linear.app/amo100/issue/IPI-1156) — Backlog | Existing narrow provider wrapper, not full MCP catalog |
| Secure agent delegation | [IPI-1474 · AGENTS-001 — Prove Safe Concierge Delegation Before Changing the Agent Registry](https://linear.app/amo100/issue/IPI-1474) — Backlog | Local agents can delegate without MCP |
| Native tool gating | [IPI-1208 · PLANNER-TOOLGATE-001 — Exclude Consequential Write Tools From the Planner's Tool Set During Plan-Generation Turns](https://linear.app/amo100/issue/IPI-1208) — Done | Keep approved per-turn `activeTools` behavior |
| Historical cancelled | [IPI-138 · AIOR-023 · MCP registry foundation](https://linear.app/amo100/issue/IPI-138) — Canceled | Do not revive the generic registry or old app/src/mastra path |

## One recommended new task (create when development starts)

### Proposed title: **MCP-BASELINE-001 — Connect One Read-Only MCP Client to the Existing iPix Mastra Runtime**

**Why new:** No active existing issue directly owns the concrete `/mcps` → optional `@mastra/mcp` → protected `tools/list` → one safe invocation **end-to-end** proof. IPI-1143 owns broad runtime governance, IPI-995 owns product tools and IPI-1002 waits for *repeated* external integrations; this task would be a narrow testable first slice, not another framework or registry.

**What changes:** Confirm compatibility and optionally pin `@mastra/mcp` in iPix, use the native built-in server, test the existing authentication boundary with a real local MCP client and document results. No new MCP server class unless shown necessary.

**Real-world example:** An engineer's MCP Inspector connects to local Mastra and reads an allowed agent/workflow list; an unauthorized client cannot list data or run protected tools.

**Faster/better:** Existing Mastra `/api/mcp` + exact pinned compatible package + existing server auth → one test fixture → negative tests. Prefer read-only native toolsets and current localhost; no custom API host, proxy, approval engine or auth bypass.

**Status:** Proposed, not created, 0% implementation verified.

**Stack:** Mastra Core 1.84, compatible MCP 2.x, current server auth / Supabase identity, existing Next.js/Mastra runtime, Vitest/MCP Inspector. No new database table.

**Acceptance criteria:**
1. App still boots with and without optional MCP disabled, without breaking Product Planner.
2. Authenticated local MCP client connects, lists only permitted read-only capabilities and produces one verified safe result.
3. Anonymous, invalid/expired credential, wrong org and wrong permission denied; protected Brand approval/crawl/Shoot save inaccessible.
4. Verify both `/api/mcp` protocol and any exposed REST/Studio tool endpoints; client/app logs contain no tokens or private data.
5. Handle missing package, unsupported protocol, network failure, timeout and client restart predictably.
6. Focused unit/integration tests, runtime inspector proof, typecheck, exact-head CI and human review pass. One actual owner is assigned at implementation.

**Suggested files:** `package.json`, `package-lock.json` (only if installing), `src/mastra/server-auth.ts` and `src/mastra/runtime.ts` only for verified needs, `tests/mastra-mcp-availability.test.ts`, `tests/mastra-mcp-authz.test.ts`. Keep user-facing Studio auth separate from normal API auth.

**Suggested linkage:** related to IPI-1143, IPI-995, IPI-1002 and the current Studio auth PR #365. An existing owner may choose to absorb this narrow work into IPI-1143 if it avoids creating another issue; record that decision before creating.

## Conditional new tasks — DO NOT create yet

| Proposed title | Trigger (must be proved first) | Why currently deferred |
| --- | --- | --- |
| **MCP-PROVIDER-001 — Prove One User-Scoped Read-Only Provider MCP** | A named product issue confirms direct SDK/API cannot meet a real need and selects one provider | Otherwise duplicates IPI-1477, IPI-1478, IPI-1302 or IPI-1156; create only as a child of the concrete product owner |
| **MCP-EXTERNAL-001 — Publish a Curated Read-Only iPix MCP Server for One External Client** | A real authorized external consumer asks to connect with a documented identity and tool scope | No current external consumer verified, and built-in server may already suffice; don't create speculative public MCP exposure |

**Explicitly do not create:** a general MCP registry task, separate connectors DB/service, every vendor's MCP wrapper, MCP Apps/Studio iframe project or another CopilotKit UI task. The existing tasks govern the real product need.

## Acceptance task-order map

~~~mermaid
flowchart TD
  A["IPI-1143: one current Mastra runtime"] --> B["Proposed MCP-BASELINE-001: auth + read-only proof"]
  C["IPI-995: existing 7-tool governance"] --> B
  B --> D{"Named business need?"}
  D -->|"No"| E["Stop. Native runtime proof is sufficient"]
  D -->|"Yes"| F["IPI-1477 / 1478 / 1302 / 1156"]
  F --> G{"Existing SDK/API sufficient?"}
  G -->|"Yes"| H["Use existing provider adapter"]
  G -->|"No"| I["Conditional provider MCP slice"]
  I --> J["IPI-1002 after repeated need"]
  B --> K{"External MCP consumer exists?"}
  K -->|"No"| E
  K -->|"Yes"| L["Consider curated server + OAuth scope proof"]
~~~

**Decision:** Start with the narrow new baseline test only if iPix's developer MCP capability is a real current requirement. Product integrations stay with their existing Linear tasks, and advanced MCP exposure remains unplanned until a real use case exists.
