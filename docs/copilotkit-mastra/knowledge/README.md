# Task: iPix Mastra Knowledge — Product-Facing Plan

**As of:** November 22, 2026. **Existing implementation epic:** [IPI-1466 — iPix Knowledge — Let Production Copilot Answer From Shared Company Docs](https://linear.app/amo100/issue/IPI-1466). **Coordination tracker:** [IPI-1484](https://linear.app/amo100/issue/IPI-1484) and [00-ai-platform-progress-tracker.md](../00-ai-platform-progress-tracker.md).

## What to add — product value first

Give the existing Production Copilot **read-only, source-backed access to shared operational runbooks**. Do not turn Knowledge into a duplicate Brand DNA database, chat Memory, a new vector engine, or public documentation server.

**Real-world use case:** An operator asks “What should we check before a product photoshoot?” The AI finds the actual current pre-shoot runbook, gives a concise checklist, and shows the source document and version. If a company policy is not documented, it says so.

| Priority | Suggested Knowledge content | Operator question | Benefit | Existing owner |
| --- | --- | --- | --- | --- |
| 1 | Pre-shoot preparation checklist | “What do I need to confirm before a shoot?” | Fewer missed production steps | [IPI-1469](https://linear.app/amo100/issue/IPI-1469) |
| 2 | Asset upload, review and handoff | “How do I review the right photo version?” | Clear source/version-aware steps | [IPI-1469](https://linear.app/amo100/issue/IPI-1469); existing Asset QA domain |
| 3 | Brand DNA review guide | “Who edits the Brand DNA draft and what is reviewed?” | Consistent operator process | [IPI-1469](https://linear.app/amo100/issue/IPI-1469); [IPI-1128](https://linear.app/amo100/issue/IPI-1128) owns actual Brand evidence |
| 4 | Shoot Plan proposal/review/save process | “What happens after I approve this proposal?” | Understands real persisted workflow | [IPI-1469](https://linear.app/amo100/issue/IPI-1469); [IPI-1151](https://linear.app/amo100/issue/IPI-1151) owns app behavior |
| 5 | Campaign handoff and channel checklists | “Which approved assets do we need for social publishing?” | Better preparation, fewer mistakes | [IPI-1469](https://linear.app/amo100/issue/IPI-1469); existing campaign domain |

**Important:** These are content *candidates*, not claims that company-approved policies or source documents already exist. Verify author, actual process, source and version before seeding. Start with 3–5 non-sensitive, validated existing Markdown documents; do not invent vendor rates, availability, ownership, company policy or publishing status.

## Core and Advanced feature decisions

| Capability | Stage | Decision |
| --- | --- | --- |
| Source-controlled runbooks and search/read tools | **Core** | One native Knowledge instance attached to the current Mastra Planner |
| Tenant scope / verified current user | **Core** | Server derives org and Memory IDs; rejects user/model-supplied cross-org scope |
| Citations, source version, unknown fallback | **Core** | Actual document path/title/version or “not documented” |
| Idempotent seed/update | **Core** | Re-run without duplicates; withdrawn sources must be retired/suppressed, not silently served |
| Persistent storage | **Core** | Verify @mastra/pg **1.37.0** pinned on current main against the installed 1.84 family and actual live schema before any migration |
| Agent editing shared Knowledge | **Not in pilot** | Read-only tools; edits through a guarded server-side content seed |
| Pinned knowledge per turn | **Advanced** | IPI-1471 only after measurable pilot value |
| Knowledge Studio tree/graph/activity | **Advanced optional** | IPI-1471, not a prerequisite for operator answers |
| Auto-generated notes/cross-scope synthesis | **Defer** | Mastra Knowledge alpha has cross-scope leakage risk |
| Semantic embeddings/import pipeline | **Defer** | Only if measured text search is insufficient; no second vector store |

## Verified baseline

- Current GitHub main 078291810c pins Mastra Core 1.84.0 and @mastra/pg 1.37.0 in package.json and package-lock.json; older local node_modules may still contain 1.71.0 / 1.27.1 and must not be used to certify current APIs; no Knowledge instance in src/mastra/runtime.ts and no KNOWLEDGE_ROUTES registration.
- Local HTTP checks on November 22: 127.0.0.1:4211 is **not listening** (connection refused); current Studio UI/content cannot be certified.
- Earlier authenticated Studio testing found the /knowledge page reachable but /api/knowledge returned **404** because routes were not enabled. That historical result is separate from today's live check.
- Live DB schema and actual Knowledge tables **not inspected in this documentation task**; verify under [IPI-1467](https://linear.app/amo100/issue/IPI-1467).
- Mastra Knowledge is **alpha**. Its scopes are useful for scoped reads, but it does not have cross-scope information-flow guardrails. Start with **non-sensitive runbooks**; do not let multi-scope agents copy private content into shared pages.

## Documentation

1. [01 — Knowledge implementation and verification plan](./01-implementation-plan.md) — exact owner, source paths, acceptance and test stages.
2. [02 — Suggested source content and rollout examples](./02-source-content-proposals.md) — five content candidates and sourcing criteria.
3. [Full AI platform task tracker](../00-ai-platform-progress-tracker.md) — real Linear status, scores, PRs, failures and next action.

**No new Knowledge epic or duplicate Knowledge issues:** Existing IPI-1466 and children IPI-1467–1471 are the canonical implementation. This is a plan, not implementation or deployment.
