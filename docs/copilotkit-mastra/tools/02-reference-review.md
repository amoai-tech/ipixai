# 02 — Official Mastra Tools and Community Reference Review

**Reviewed:** 2026-11-20, using the supplied URLs, Mastra Docs connector, Context7, public GitHub pages and installed Mastra 1.84.0 exports. The current upstream documentation may be newer than the pinned iPix SDK. **All 17 requested links are tracked below.**

**Classification:** Core = directly applicable now; Conditional = useful when named need is proven; Deferred = avoid adding now; Reference = example/background, not a production implementation source; Unverified = inaccessible direct source.

| # | Requested source | What the source supports | iPix-specific decision |
| --- | --- | --- | --- |
| 1 | [Agents: Tools](https://mastra.ai/docs/agents/tools) | Agent tools for API/DB access, typed execute, schemas, built-ins, request-context and tools from MCP | **Core.** Use current createTool definitions, existing agent registry and gate; no second tool platform |
| 2 | [CometChat backend-tools agent example](https://github.com/cometchat/ai-agent-mastra-examples/blob/main/mastra-backend-tools-agent/README.md) | Simple server-side get-deals tool returns grounded chat answers through a Mastra endpoint; sample warns to add auth/rate limiting | **Reference only.** Useful pattern of grounded results; iPix already has secure Next.js/CopilotKit, do NOT add CometChat or expose example endpoint |
| 3 | [Workflows: Agents and tools](https://mastra.ai/docs/workflows/agents-and-tools) | Invoke registered tool/agent inside steps or compose as typed steps | **Conditional.** Reuse when an actual Brand/Shoot workflow needs existing tool; keep domain action auth |
| 4 | [Tools topic index](https://mastra.ai/topics/tools) | Curated Mastra blog articles on tools, search, browser and integrations | **Reference only.** Articles provide options, not tested iPix dependencies |
| 5 | [Introducing built-in tools](https://mastra.ai/blog/introducing-built-in-tools) | Aug 13, 2026 announcement for web search/fetch, user question, plan submission and task list family | **Reference.** Check current docs and installed exports; not a reason to enable all built-ins |
| 6 | [Provider web search](https://mastra.ai/docs/agents/tools#use-provider-web-search) | webSearchTool resolves provider-native web search where supported | **Conditional under IPI-1251/1477.** Verify actual model/provider, grounded citations, cost, result shape and failure; don't claim works automatically |
| 7 | [Task tracking](https://mastra.ai/docs/agents/tools#task-tracking) | TaskSignalProvider, TaskStateProcessor and task list tools with thread-scoped Memory | **Defer.** Do not replace current Brand workflow state, AG-UI progress or existing business tasks |
| 8 | [Fetch a web page](https://mastra.ai/docs/agents/tools#fetch-a-web-page) | webFetchTool fetches HTTP(S) page text, blocks localhost/private/reserved/DNS-to-private, caps response and redirects | **Conditional under IPI-1251.** Compare with existing Gemini URL Context/search plan; also verify content trust, citations and failures |
| 9 | [Ask user a question](https://mastra.ai/docs/agents/tools#ask-the-user-a-question) | askUserTool suspends an agent for free-text or select inputs; requires host handling/resume | **Conditional.** User can supply a budget/target channel, but first reuse existing CopilotKit form or HITL |
| 10 | [Submit plan for review](https://mastra.ai/docs/agents/tools#submit-a-plan-for-review) | submitPlanTool suspends on a markdown plan **file path** for a coding-agent host | **Not an iPix approval substitute.** Product Shoot/Brand review requires exact persisted revision/hash + authorized RPC, not a filesystem plan |
| 11 | [Mastra Code tools](https://code.mastra.ai/tools) | File/shell/search/edit operations of the **Mastra Code coding agent** | **Reference only, different product surface.** Do not mount agent filesystem/terminal tools in customer-facing iPix Planner |
| 12 | [createTool reference](https://mastra.ai/reference/tools/create-tool) | Zod schemas, execute(inputData, context), tool results, conversion to model output | **Core.** Already used in iPix; inspect installed types before using additional hooks/toModelOutput |
| 13 | [askUserTool reference](https://mastra.ai/reference/tools/ask-user-tool) | Native question suspend/resume semantics, tool ID ask_user | **Conditional.** Test AG-UI resume and correct operator/user route; question answer is not security authorization |
| 14 | [GitHub topic mastra-tools](https://github.com/topics/mastra-tools) | Community repository discovery URL | **Unverified direct page** at review (web cache miss; related mastra topic search appeared). No selected package or claim of curated security |
| 15 | [awesome-mastra-skills](https://github.com/YGhorbel/awesome-mastra-skills) | Third-party skill instructions and examples, not automatically runnable iPix tools | **Reference only.** iPix already has its own Mastra specialist skill; no bulk installs or duplicate skill router |
| 16 | [Mastra Client JS tools API](https://mastra.ai/reference/client-js/tools) | listTools, getTool, details and execute through MastraClient | **Server-side / authenticated only.** Exposing direct execution to browser could bypass the real Planner/HITL boundary |
| 17 | [Introducing Tool Search Processor](https://mastra.ai/blog/introducing-tool-search-processor) | ToolSearchProcessor provides search_tools and load_tool for large tool sets; adds a lookup step and context-token tradeoff | **Defer.** Seven existing tools + activeTools policy are simpler; search is not tenant authorization |

## Verified current Mastra SDK exports

Read-only inspection of installed Mastra Core 1.84.0 exports confirmed:
- createTool, webSearchTool, webFetchTool, askUserTool, submitPlanTool
- taskWriteTool, taskUpdateTool, taskCompleteTool, taskCheckTool
- ToolSearchProcessor (from the processors entrypoint)

**This confirms API availability, not app/UI support, provider availability, authorization or production success.** An added built-in tool must still be registered on the correct agent, gated by current server permissions, routed accurately and tested with the real CopilotKit bridge.

## Source-specific decisions and failure modes

### Tools are capabilities, not user permissions

Mastra tools are functions, and available tools are discoverable by the model. iPix currently sets per-turn activeTools through planner-tool-gate.ts. Keep independent server-side user/org verification and exact-asset approval. A model prompt, tool description, input schema, ToolSearchProcessor or RequestContext alone is never proof of authorization.

### Research provider choice

Mastra supports native provider search and a bounded fetch tool. iPix's existing IPI-1251 explicitly prefers existing approved Brand data, then assesses Gemini URL Context + Google Search for ad-hoc website inspection. Compare each read-only option on the actual iPix model/provider and real test URLs. Don't introduce a second crawler into Brand DNA.

**Example:** User pastes a Colombian fashion-brand website. Return dated sourced observations and an honest note for inaccessible pages; do not claim competitor pricing or private data without evidence.

### Built-in question/task/plan tools

- askUserTool can pause the model run, but the host must present the question and resume the correct saved thread. **CopilotKit support must be proved on the installed AG-UI adapter**; plain form input may be cheaper.
- task tracking needs Memory/Signal UI integration and maintains *agent* task state; iPix already tracks real long-lived Brand/Shoot status.
- submitPlanTool is file-path based, not a replacement for actual iPix approval/readback. Avoid a filesystem-based approval subsystem.

### Tool Search and third-party resources

ToolSearchProcessor is documented for growing tool sets and exposes meta-tools; it may save model context but costs discovery/loading round trips. Without a measured need or per-request authorized filter, do not deploy it on a small tenant-aware Planner.

CometChat, Mastra Code tools, GitHub topics and third-party skills are **examples/discovery**, not dependency or implementation requirements. Do not install broad community tools, public tool-execution endpoints or self-managed file/shell permissions as a shortcut.

### Evidence and source limits

- Official links #1, #3–#13, #16 and #17 were directly retrieved; #2 and #15 GitHub public README material was retrieved.
- The requested #14 GitHub topic page could not be opened directly, so this plan makes no claims about its specific listed repositories.
- Current upstream docs may be ahead of iPix Core 1.84; installed types and existing tests remain authoritative for implementation. No new agent/tool was executed during source review.

## Repo and existing task owners

| Current file | Purpose |
| --- | --- |
| src/mastra/tools/planning.ts | Four typed deterministic planning tools |
| src/mastra/tools/compose-shoot-plan.ts | Full proposal combining outputs and assumptions |
| src/mastra/tools/brand-intelligence.ts | Protected start analysis and approved draft decisions |
| src/mastra/agents/production-planner.ts | Seven-tool agent registration |
| src/mastra/planner-tool-gate.ts | Tool selection in stream and resume; 5 planning vs 2 Brand actions |
| src/mastra/agents/active-workspace-context.ts | Active-context handling |
| src/mastra/tools/index.ts | Standalone weather starter, not Planner's product tool set |
| tests/tool-001.test.ts, tests/planner-tool-gate.test.ts, tests/planner-routing-eval-corpus.test.ts | Existing deterministic/selection contracts |

**Task mapping:** [IPI-1250](https://linear.app/amo100/issue/IPI-1250), [IPI-1223](https://linear.app/amo100/issue/IPI-1223), [IPI-1251](https://linear.app/amo100/issue/IPI-1251), [IPI-995](https://linear.app/amo100/issue/IPI-995), [IPI-1151](https://linear.app/amo100/issue/IPI-1151), [IPI-1477](https://linear.app/amo100/issue/IPI-1477), [IPI-1086](https://linear.app/amo100/issue/IPI-1086). Keep the existing owner for each problem; do not duplicate issues.

## Conclusion

**Core now:** existing planning correctness, useful site research, real conversational routing, trustworthy Brand context, explicit review/save. **Advanced later:** cited specialist research, output shaping, domain tool reuse, measured evals, search-on-demand and external integrations only when proven useful.

This source review is documentation; it is **not** evidence of a live customer journey, approved changes, vendor charges or deployed new tools.
