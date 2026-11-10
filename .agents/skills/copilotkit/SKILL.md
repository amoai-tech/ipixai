---
name: copilotkit
description: >
  Use for CopilotKit v2 or AG-UI tasks in iPix: authenticated Production Copilot,
  Mastra integrations, chat UI, useAgent, useFrontendTool, useHumanInTheLoop,
  threads, streaming, Stop/replay, generative UI, catalogs, standardUI, surfaces, dynamic schema, A2UI, channels, voice,
  attachments, debugging, upgrades and /api/copilotkit/info failures.
  Look up current docs and installed source first. Do not use for unrelated
  Supabase-only tasks, pure styling or Linear-only administration.
metadata:
  version: "3.2.0-ipix.1"
  basedOn: "CopilotKit/CopilotKit skills/copilotkit/SKILL.md v3.2.0 @ c7815d9ac96f48fb3a64ad8c18e176a870c81763"
  priority: 2
---

# CopilotKit — current docs + secure iPix runtime

**Reference — ADAPT:** [Official CopilotKit coding skill v3.2.0](https://github.com/CopilotKit/CopilotKit/blob/c7815d9ac96f48fb3a64ad8c18e176a870c81763/skills/copilotkit/SKILL.md) → `skills/copilotkit/SKILL.md`. Use **look up current docs and source first**. Do not copy upstream hosted Intelligence setup, generic scaffolding, telemetry, or a second Mastra server into iPix.

## 1. Establish version and authorization truth

1. Read the live Linear issue, `AGENTS.md`, clean `origin/main`, `package-lock.json`, installed `node_modules/@copilotkit/*` and `node_modules/@ag-ui/*` source/types, and the relevant runtime code/tests. A PR or current docs page is **not** proof its APIs are installed.
2. At this skill's baseline, `main` has CopilotKit Runtime/React Core 1.73.3, Channels 0.11.0, AG-UI Client 0.0.59 and `@ag-ui/mastra` 1.1.4. Treat these as historical context only. [IPI-1389](https://linear.app/amo100/issue/IPI-1389) / [PR #319](https://github.com/amoai-tech/ipixai/pull/319) separately target CopilotKit 1.85 and AG-UI 1.0; verify the actual installed version after merging.
3. iPix runs an authenticated in-process `src/app/api/copilotkit/[[...slug]]/route.ts` → server-owned `createLocalAgents(resourceId)` → `TenantAbortRunner` → existing Mastra/Postgres. Preserve one provider and agent ID `default`. Do not create a new `/chat` server, remote Mastra runtime, managed Intelligence fallback, or second thread store.
4. v2 uses `@copilotkit/runtime/v2` and `@copilotkit/react-core/v2`. Package-root imports still expose deprecated v1 surfaces; check current installed signatures before making an API recommendation.

## 2. Discover the current answer — do not assume MCP availability

**Reference — REFERENCE ONLY:** [CopilotKit docs index](https://docs.copilotkit.ai/llms.txt) → [sitemap](https://docs.copilotkit.ai/sitemap.xml) → targeted `https://docs.copilotkit.ai/<path>.md`, e.g. [quickstart](https://docs.copilotkit.ai/quickstart.md), [Mastra](https://docs.copilotkit.ai/mastra/quickstart.md), [runtime](https://docs.copilotkit.ai/backend/copilot-runtime.md). Do not routinely load the multi-megabyte `llms-full.txt`.

If the CopilotKit Docs connector is **actually connected**, discover its tool names and schemas. Separate these four search corpora:

| Corpus | Common MCP name (ChatGPT variant) |
| --- | --- |
| CopilotKit docs and APIs | `search-docs` (`search_docs`) |
| CopilotKit package implementation | `search-code` (`search_code`) |
| AG-UI protocol docs | `search-ag-ui-docs` (`search_ag_ui_docs`) |
| AG-UI protocol SDK source | `search-ag-ui-code` (`search_ag_ui_code`) |

Optional `explore-docs` / `explore-code` browse an index. A repository `.mcp.json` **does not** guarantee that the tools are enabled in Claude/Codex/ChatGPT. If missing, fetch focused `.md` pages and use installed types, [official package source](https://github.com/CopilotKit/CopilotKit/tree/main/packages), or [AG-UI docs](https://docs.ag-ui.com/llms.txt).

**Source order:** clean current iPix runtime and auth → installed versions/types → focused tests → official version-matched code/examples → current docs → legacy bundled references. Explain conflicts. For every external example: exact URL → file/function/section → COPY/ADAPT/MODEL/REFERENCE ONLY → use → do not copy → iPix destination → verification.

## 3. Select one relevant reference (do not read all 97)

| Task | Local owner |
| --- | --- |
| iPix auth, production license, Vercel, 401, persistent threads | [Production](references/ipix-production.md) |
| In-process Mastra agent and default runtime | [Mastra](references/integrations/references/integrations/mastra.md) and [runtime wiring](references/runtime/references/wiring-mastra.md) |
| New project starter, not iPix architecture | [Setup](references/setup/setup.md) |
| Chat UI, frontend tools, HITL | [Develop](references/develop/develop.md) |
| External framework alternatives | [Integrations](references/integrations/integrations.md) |
| AG-UI protocol and SSE events | [AG-UI](references/agui/agui.md) |
| Pick the safest Generative UI approach | [iPix decision guide](references/generative-ui.md) |
| Typed custom components or reuse the standard catalog | [Catalogs + Standard UI](references/generative-ui/catalogs-and-standard.md) |
| Show generated results inside a named page region | [Surfaces](references/generative-ui/surfaces.md) |
| AG-UI transport, A2UI 1.0, legacy v0.9, dynamic schema | [AG-UI + A2UI boundary](references/generative-ui/a2ui-and-dynamic-schema.md) / [legacy A2UI v0.9 notes](references/a2ui-renderer.md) |
| Optional channels, inspector, hosted Intelligence | [Channels](references/channels.md) / [Inspector](references/inspector.md) / [Intelligence](references/intelligence.md) |
| Errors, agent discovery, frontend tool failures, reconnect | [Debug](references/debug/debug.md) |
| v1 migration, package upgrade and source contracts | [Upgrade](references/upgrade/upgrade.md) / [iPix conventions](references/upgrade/ipix-v2-conventions.md) |
| Frontend hooks/provider and backend runtime | [React Core](references/react-core/react-core.md) / [Runtime](references/runtime/runtime.md) |
| Refresh upstream **skills**, not application packages | [Self-update](references/self-update.md) |
| Contribute to upstream monorepo | [Contribute](references/contribute/contribute.md) |

Sibling `mastra` skill owns backend agents, workflows, persistent memory and HITL. Sibling `tasks` owns PR/Linear lifecycle. Keep **one canonical iPix CopilotKit skill** and the existing security overlay, not a duplicate upstream skill tree.

## 4. Safe diagnostic boundary

**Reference — REFERENCE ONLY:** [Official CopilotKit CLI skill](https://github.com/CopilotKit/CopilotKit/blob/c7815d9ac96f48fb3a64ad8c18e176a870c81763/skills/copilotkit-cli/SKILL.md) → `verify`, `--expect-runtime oss`, `--agent`, `--round-trip`.

- First confirm installed/selected CLI version, actual URL and an **authorized local test identity**. In iPix, signed-out `/api/copilotkit/info` intentionally returns `401`.
- The optional *authorized-localhost-only* example is `npx copilotkit@latest verify --expect-runtime oss --agent default --round-trip --json --runtime-url http://localhost:3000/api/copilotkit`. It may install/execute an unpinned CLI, emit telemetry, incur a model call and persist a thread. **Do not run automatically, or against production**, in a skills-only task. Prefer approved pinned/isolated diagnostics.
- `verify` checks some wiring, **not** AG-UI event order, tool correctness, tenant isolation, deployed tenant identity, exact Stop, HITL server revalidation or durable replay. Prove those separately.
- Do not run `login`, `project select`, `init` or `onboard` to "fix" a self-hosted runtime; those are cloud/scaffold workflows, not required iPix dependencies.

## 5. iPix security, approvals and proof

**Humans decide; AI assists.** Browser-supplied `orgId`, `threadId`, `resourceId`, permission flags and model output are not authorization. Supabase Auth + server checks + RLS own tenant security. Bind HITL to the exact reviewed artifact, server-revalidate the approved action and execute idempotently. Never autonomously publish, pay or delete.

For changes to chat, Stop, streaming, frontend tools or HITL, inspect both installed CopilotKit v2 and `@ag-ui/mastra` APIs. Prove the affected signed-out denial, Org A/B isolation, `default` agent, Stop/reconnect, durable history and exact approval with targeted tests, typecheck and a real operator journey. **Static skill tests do not certify runtime 1.85 or actual Claude selection accuracy.**

## PR review guard — concrete v2 import regression

**Browser-supplied IDs are not authorization.** Use installed package source/types and the real authenticated route to assess changed code; no speculative style-only blockers. If reviewing a PR that introduces a bare v1 package-root import in a v2 path, report:

- Fix: Restore the changed CopilotKit import to its `/v2` subpath.
- Verification: Run the existing targeted CopilotKit route tests, then `npm run typecheck`.
- Expected result: The route uses the `/v2` import and the targeted tests/typecheck pass.

For auth, HITL, streaming and Stop changes, require risk-specific evidence before recommending merge.
