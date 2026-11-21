# iPix Mastra MCP — Product-Agent Tools Roadmap

**Updated:** 2026-11-20 | **Goal:** Give iPix **product-facing AI agents** secure, useful tools for Brand Intelligence, fashion shoots, assets, product catalogs, campaigns and customer operations. **Not** primarily a developer Studio/MCP Inspector integration. **Source:** verified iPix origin/main `07829181` and Mastra Core `1.84.0`; scores are **recommended priority /100**, not completeness or test pass rate.

## Plain-English decision

iPix should create a **curated, reusable agent-tool capability layer** using its existing Mastra `createTool` definitions and iPix's real Supabase/Cloudinary/Next.js services. Add **MCPClient** only where product agents need a genuine outside MCP provider; expose the **same existing tools through MCPServer** when an actual additional agent/client needs MCP interoperability. **Do not make the in-process Planner call its own tools through an unnecessary HTTP MCP round trip.**

**Example:** “Find images from our last swimwear shoot, plan 10 new shots and calculate a budget.” Agent reads authorized Brand/asset data, uses the existing shoot-planning tools, and returns grounded recommendations. Saving, approving or publishing must use the existing explicit user-reviewed server action, with correct tenant and transaction checks.

## Core product-facing MCP capabilities

| Rank | Feature for iPix agents | Real-world example | Benefit | Score /100 | Reuse / current work |
| --- | --- | --- | --- | ---: | --- |
| 1 | **Brand DNA and evidence lookup** | “Use my Brand DNA to make a campaign that feels on-brand.” | Personalized, consistent outputs | **98** | Existing Brand data/Intelligence; IPI-1476, IPI-1128 |
| 2 | **Shoot planning and shot lists** | “Plan 10 studio photos and five product videos.” | Faster structured production planning | **97** | Existing Planner `recommendShootType`, `planDeliverables`, `generateShotListDraft`, `composeShootPlan` |
| 3 | **Search creative assets and versions** | “Find my previous summer campaign images.” | Reuse trusted Cloudinary media | **95** | IPI-1069, IPI-1392; use current asset tables/service first |
| 4 | **Cost and budget estimates** | “What will 20 approved product images cost?” | Consistent, explainable estimates | **94** | Existing `estimateShootBudget`; fix IPI-1250 and IPI-1223 first |
| 5 | **Public Brand-website research** | “Look at this fashion retailer's website and suggest a shoot.” | Grounded source-backed research | **93** | IPI-1251, IPI-1477; compare built-in search/fetch and existing provider path |
| 6 | **Shoot / campaign status lookup** | “Which shoots are unfinished this week?” | Real operational visibility | **92** | Existing Shoot and Campaign domain reads; server-scope results |
| 7 | **Product and variant lookup** | “Select the exact black size-M jacket for this Shoot.” | Plans linked to real inventory | **90** | IPI-1165, IPI-1301, optional IPI-1302 |
| 8 | **Review, save and action tools** | “Review this exact plan and save one Shoot.” | AI ideas become actual saved work | **89** | Existing exact review/hash + idempotent RPC; IPI-1151 / IPI-1208 |

## Advanced product-agent capabilities

| Rank | Feature | Real-world example | Benefit | Score /100 | Existing owner / decision |
| --- | --- | --- | --- | ---: | --- |
| 1 | **Semantic asset intelligence** | “Find photos visually similar to this reference.” | Faster creative reuse | **94** | IPI-1136 / IPI-1392; reuse canonical assets and existing embedding services |
| 2 | **Competitor and trend research** | “Compare three Colombian fashion competitors using cited sources.” | Better campaign decisions | **92** | IPI-1477 / IPI-36; bounded read-only evidence |
| 3 | **Multi-agent collaboration** | “Ask Brand, Research and Creative specialists to build one proposal.” | Specialized advice in one chat | **91** | IPI-1474, IPI-1475; native Mastra delegation first |
| 4 | **Creative QA against Brand DNA** | “Check whether delivered images match my brief.” | Fewer revisions | **90** | IPI-1138 done; IPI-1136 and IPI-1131 follow-on |
| 5 | **CRM context and follow-up drafts** | “Who needs a shoot follow-up this week?” | Better account management | **88** | IPI-1478; server-scoped data, drafts not unsupervised sends |
| 6 | **Talent matching and scheduling** | “Shortlist suitable models for my campaign.” | Faster casting | **87** | Existing talent/matching domain; confirm authoritative availability |
| 7 | **Campaign preparation and publishing** | “Prepare approved campaign assets and captions for Instagram.” | Less manual production work | **85** | IPI-1480 / IPI-77; external publishing only through existing authorized path |
| 8 | **Per-organization external provider MCP connections** | “Connect this organization's Shopify or CRM account.” | New capabilities without custom provider infrastructure | **84** | IPI-1302 / IPI-1478 / IPI-1002; scoped OAuth where supported |

**Scoring logic:** 40% user value + 30% reuse of current iPix code + 20% practical effort + 10% risk/operations. These are *judgment-based priorities*, not completion claims.

## Architecture: native tools first, MCP only where it adds value

~~~mermaid
flowchart TD
  U["iPix operator /app"] --> UI["One CopilotKit interaction"]
  UI --> P["Mastra Planner / specialists"]
  P --> G["Server-derived org, user, Brand, Shoot + activeTools gate"]
  G --> A["Existing Mastra createTool definitions"]
  A --> D["Supabase / Cloudinary / existing domain services"]
  G --> X["MCPClient for justified external provider"]
  X --> Z["Scoped external research / catalog / CRM MCP"]
  A --> S["Optional curated MCPServer publishes same existing tools"]
  S --> E["Additional authorized MCP consumers"]
  D --> UI
  Z --> UI
~~~

**Core distinction:** In-process Mastra agents already call Mastra tools directly. MCP adds interoperability across processes or providers; it isn't a required duplicate transport. The built-in `/api/mcp` server is useful for external clients, not a reason to expose the entire production toolset or bypass the current Planner tool gate.

## Documents

- [01 — Product-agent Core → Advanced implementation roadmap](./01-roadmap.md): phases, file owners, real journeys, test gates.
- [02 — All 15 supplied MCP reference entries](./02-reference-review.md): Client vs Server, current v2 transport and important auth boundaries.
- [03 — Existing Linear tasks and new task proposals](./03-task-proposals.md): reuse existing product owners, propose one narrow product-agent MCP integration test; no duplicate epic.
- [04 — Full 16-Feature Product-Agent Delivery Plan](./04-product-agent-delivery-plan.md): exact Core/Advanced tool contracts, code owners, implementation slices, dependencies, real user journeys and acceptance tests.


**Status:** Roadmap and PR only. No agent MCP tool was implemented, provider authorized, new endpoint exposed, database modified or new Linear task created.
