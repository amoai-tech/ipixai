# iPix Reference Reuse Matrix

**Status:** Draft. Every "Verified" row was independently checked this session (source read, dependency-version check, or repo metadata via `gh api`/firecrawl) — not taken from a pasted report at face value. Rows marked "Not independently verified" are carried from a source report and should be re-checked before being relied on for an implementation decision.
**Date:** 2026-09-20
**Companion:** [IPIX-AGENT-PLATFORM-PRD.md](IPIX-AGENT-PLATFORM-PRD.md) · [IPIX-AGENT-PLATFORM-ROADMAP.md](IPIX-AGENT-PLATFORM-ROADMAP.md) · [IPIX-MIGRATION-PLAN.md](IPIX-MIGRATION-PLAN.md)

## Capability matrix

| iPix capability | Proven repository | Exact source files | COPY/ADAPT/MODEL | Existing iPix files | Change required | Risk | Verified? |
|---|---|---|---|---|---|---|---|
| CopilotKit↔Mastra integration | `CopilotKit/CopilotKit` `examples/integrations/mastra` | `src/agent.ts`, `src/mastra/`, `channels.mts` | ADAPT | `src/agent.ts`, `src/app/api/copilotkit/[[...slug]]/route.ts` | Wiring-shape alignment only; auth/tenant stays iPix's own | Low | **Yes** — deps read directly (`runtime@1.72.0`) |
| Runtime/server boundary (interactive) | `mastra-ai/mastra` `packages/core/src/agent-controller/` | `agent-controller.ts`, `session.ts`, `types.ts` | ADAPT | New: `src/lib/mastra/remote-client.ts` | Genuinely new adapter code + deployment decision | Medium-High | **Yes** — full source read, 40+ test files, pluggable `threadLock` confirmed |
| AgentController client | `mastra-ai/mastra` `client-sdks/client-js/src/resources/agent-controller.ts` (npm: `@mastra/client-js`) | `AgentControllerSession.state/subscribe/abort` | ADAPT | New: `src/lib/mastra/planner-session-client.ts` | Map 4 ops onto SDK methods | Medium | **Yes** — `.d.ts` read directly, already installed |
| Concierge / task management | `mastra-ai/template-agent-harness` | task/approval/schedule modules (not individually opened below top-level this pass) | ADAPT HEAVILY | New: Concierge agent module | Storage/auth/permission adaptation | Medium | Repo existence/activity verified (2★, real); internals not opened |
| Memory | Existing `@mastra/memory` + Supabase | n/a | KEEP AS-IS | `src/mastra/` | None — already correct | Low | Existing iPix code, not a new dependency |
| Schedules | `mastra-ai/template-agent-harness` | schedule module | MODEL | New | Design-level reuse only | Low | Not independently verified — internals not opened |
| HITL | iPix's own approval pattern + `template-deep-search`'s suspend/resume shape | n/a | KEEP + MODEL | Existing HITL gates | Apply same pattern to new workflows | Low | iPix pattern verified by existing code; template internals not opened |
| Brand Intelligence | `mastra-ai/template-deep-search` | nested-workflow structure | ADAPT | `src/mastra/tools/` (existing Brand DNA/composeShootPlan tools) | Restructure orchestration, keep tool logic | Medium | Repo existence verified (6★, real); internals not opened |
| Browser research | `mastra-ai/template-browsing-agent` | session/navigation/extraction modules | ADAPT | New: Research/Brand tool additions | Add iPix approval boundary around writes | Medium | Repo existence verified (43★, real, highest of templates); internals not opened |
| Internal knowledge | `mastra-ai/template-company-knowledge` | pgvector indexing + MCP/web fallback | ADAPT | New: Knowledge agent | Neon → Supabase pgvector swap | Medium | Repo existence verified (2★, pushed 2026-07, older); internals not opened |
| pgvector | Existing Supabase pgvector | n/a | KEEP AS-IS | Existing Supabase schema | None | Low | Existing iPix infra |
| Auth | Existing AUTH-002 `resourceId`/RLS | n/a | KEEP AS-IS; `mastra-ai/mastra-auth-examples` for negative comparison only | `src/lib/auth/`, `tenant-abort-runner.ts` `scope()` | None to iPix code; audit template only for gaps | Low | iPix pattern verified this session (multiple prior passes); `mastra-auth-examples` confirmed **stale** (May 2025), its "supabase" example is just Supabase's own generic starter README, not Mastra-auth-specific guidance |
| Multi-agent delegation | `CopilotKit/CopilotKit` `examples/showcases/multi-agent-canvas` | delegation/selector UX | MODEL (UX only) | New: Concierge delegation UI | UI pattern only, not backend | Low | Repo location confirmed real (in-repo); internals not opened this pass |
| AG-UI protocol | `mastra-ai/mastra-agui-dojo` | event-shape examples | REFERENCE ONLY | n/a | None — validate against real iPix event flow instead | Low | **Confirmed stale** (May 2025, 21★) — do not anchor protocol tests on this; use iPix's own already-passing AG-UI event tests instead |
| Reconnect | iPix's own `TenantAbortRunner.connect()` durable-replay fallback | `src/lib/copilotkit/tenant-abort-runner.ts` | **KEEP — already better than every reference reviewed** | Same file | Port into new adapter unchanged if Phase 2 proceeds | Low | Directly verified this session — beats `AgentCoreRunner`'s empty-snapshot fallback and `SqliteAgentRunner`'s equivalent |
| Stop/cancel | None proven cross-instance anywhere reviewed | — | Build via Phase 1 spike (IPI-1292) | `src/lib/copilotkit/tenant-abort-runner.ts` | Genuinely new | High | Exhaustively checked this session across CopilotKit, Mastra, and OpenBot — confirmed absent everywhere |
| Workflows (business processes) | Mastra core workflows (already an iPix dependency) | `@mastra/core` workflow APIs | ADAPT | New workflow definitions for Brand Analysis/Shoot/Campaign | Restructure existing tool-call sequences into Workflow steps | Medium | Package confirmed installed; iPix doesn't yet use Workflow API for these flows (confirmed via current `src/mastra/tools/` shape) |
| Frontend tools / context injection | Existing `RequestContext`/`requestToken` pattern | `src/lib/request-token.ts` | KEEP AS-IS | n/a | None | Low | Existing iPix code, already ahead of every reference reviewed |
| Tenant auth | Existing AUTH-002 | n/a | KEEP AS-IS | n/a | None | Low | Verified multiple times this session |
| E2E testing | iPix's own `tests/copilot-runner-cross-process.test.ts` | n/a | **KEEP — already ahead of CopilotKit's own `examples/e2e`** | Same file | Extend for new candidate | Low | Directly verified: CopilotKit's own e2e suite has zero runner-lifecycle coverage (`tests/v1.x/*` only, legacy UI specs) |
| Long-running jobs | Mastra `AgentController` background-task handling + Workflow suspend/resume | n/a | ADAPT, with a known open gap | n/a | Test explicitly for Mastra issue #23707 (idle-session wake gap) | Medium | Issue confirmed real and open (filed 2026-09-12) |
| Recovery/observability | `mastra-ai/mastra-smoke` (low priority) + iPix's own logging | n/a | REFERENCE ONLY | n/a | None immediate | Low | Repo existence confirmed (0★, very new) — low priority, not a near-term dependency |
| MCP | `mastra-ai/template-company-knowledge`'s MCP fallback pattern | n/a | MODEL | New: Knowledge agent | Design-level only | Low | Internals not opened this pass |
| Generative UI | `CopilotKit/generative-ui` | AG-UI/A2UI/MCP Apps component patterns | ADAPT UI | Existing approval-card components | Additive UI patterns for Brand DNA/shot-list/CRM/campaign cards | Low | Repo confirmed real, 836★, pushed 2026-03 |
| Approvals | iPix's own existing HITL gate pattern + OpenBot's audit-row shape | `docs/architecture.md` (OpenBot) | KEEP + MODEL | Existing approval components | Add `initiator_kind` (person/deployment/routine/handoff)-style audit field if adopted | Low | OpenBot's architecture doc directly read this session |
| Audit | OpenBot governance model | Same as above | MODEL | New, if adopted | Additive only | Low | Same as above |

## Repos explicitly deprioritized this pass, with evidence

| Repo | Why deprioritized |
|---|---|
| `CopilotKit/mastra-pm-canvas` | Confirmed **archived** (53★, last push 2026-03) |
| `mastra-ai/mastra-auth-examples` | Confirmed stale (1★, last push **2025-05**, 16+ months) |
| `mastra-ai/mastra-agui-dojo` | Confirmed stale (21★, last push **2025-05**, 16+ months) |
| `mastra-ai/template-browser-agent` | Real but much lower signal (3★, pushed 2026-07-13) than `template-browsing-agent` (43★, pushed 2026-09-15) — likely superseded/duplicate, do not conflate the two |
| `mastra-ai/template-agent-builder` | Real but 1★ — essentially unvetted |
| `CopilotKit/agents-everywhere-starter-kit` | Confirmed **hackathon scaffold** (its own README banner: "AI Tinkerers global hackathon," Sept 12–13 2026), not a curated production reference |
| `examples/e2e` (CopilotKit monorepo) | Confirmed zero runner-lifecycle test coverage — legacy `v1.x` UI specs only |

## Not independently verified this pass — re-check before depending on

- `template-agent-harness`, `template-deep-search`, `template-company-knowledge`, `template-browsing-agent` internal file contents (only top-level existence/activity confirmed).
- `examples/showcases/multi-agent-canvas`, `enterprise-brex`, `strands-crm` internal file contents.
- `mastra-ai/mastra`'s own canonical `template-deep-search` equivalent, referenced in the roadmap Phase 4 but not located this pass.
