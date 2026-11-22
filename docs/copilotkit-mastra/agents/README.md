# iPix Mastra Agents — Core and Advanced Roadmap

**Task:** Build one reliable, evidence-backed AI Concierge with specialist capabilities by extending the existing iPix Production Planner. **Canonical Linear owner:** [IPI-1473 — Mastra Agents epic](https://linear.app/amo100/issue/IPI-1473).

## In 30 seconds

**Working now:** One Production Planner registered as the default Mastra agent, with typed planning and Brand tools, two workflows, CopilotKit /app and server-derived organization context. **Not yet built:** The specialist agent network tracked by IPI-1474–1482 (including the existing Shoot Planner Expert task).

**Real-world example:** A fashion operator asks “Help plan our summer collection.” Today the Planner can propose a Shoot; in the planned version one Concierge coordinates Brand evidence, sourced market research and the same Shoot Planner without a second chat. Exact reviewed saves use existing Supabase actions, not agent-side direct writes.

**The fastest route:** Prove one Mastra subagent inside the current top-level default agent first. The current bridge rejects multiple top-level registered agents. Use domain tools and existing storage; avoid a duplicate MCP server, agent backend, approval system or Agent Memory store.

## Progress at review time

| Area | Linear | Status |
| --- | --- | --- |
| Existing Planner / main agent | [IPI-1048](https://linear.app/amo100/issue/IPI-1048) | 🟢 Done (Planner scope only) |
| Agent integration and delegation | [IPI-1474](https://linear.app/amo100/issue/IPI-1474), [IPI-1475](https://linear.app/amo100/issue/IPI-1475) | 🔵 Backlog · 0% specialist implementation |
| Shoot Planner Expert | [IPI-1482](https://linear.app/amo100/issue/IPI-1482) | 🔵 Backlog · depends on delegation proof IPI-1474; prerequisite for IPI-1475 |
| Brand / Research roles | [IPI-1476](https://linear.app/amo100/issue/IPI-1476), [IPI-1477](https://linear.app/amo100/issue/IPI-1477) | 🔵 Backlog |
| CRM / Ecommerce / Campaign roles | [IPI-1478](https://linear.app/amo100/issue/IPI-1478), [IPI-1479](https://linear.app/amo100/issue/IPI-1479), [IPI-1480](https://linear.app/amo100/issue/IPI-1480) | 🔵 Backlog |
| Multi-agent negative / live testing | [IPI-1481](https://linear.app/amo100/issue/IPI-1481) | 🔵 Backlog |

**The Agents epic IPI-1473 is In Review in Linear as of November 22, 2026; that does not mean specialist agents are implemented.**

**These tasks already exist.** A previous locally drafted agent summary incorrectly said there were no separate agent tickets. That older conclusion must not be used for prioritization.

## Read in order

1. [Main Agent and AI Platform Tasks](./01-Main%20agent%20and%20AI%20platform%20tasks.md) — exact issue titles, progress table, verified source paths, architecture, use cases, dependencies, correctness and release gates.
2. [Official reference review](./02-reference-review.md) — confirmed Mastra supervisor / tools / memory / MCP guidance, pinned version caveats and iPix-specific integration rules.
3. [Existing Knowledge epic](https://linear.app/amo100/issue/IPI-1466) — shared non-sensitive runbooks; not a replacement for approved Brand evidence.
4. [AI Platform Progress Tracker (coordination)](https://linear.app/amo100/issue/IPI-1484) — cross-Agents/Workflows/Tools/MCP/Knowledge progress.

**Docs only:** None of the planned specialist roles or product features is implemented by adding this guide.
