# iPix Agent Platform — Roadmap

**Status:** Draft. No production code changed by this document.
**Date:** 2026-09-20
**Companion:** [IPIX-AGENT-PLATFORM-PRD.md](IPIX-AGENT-PLATFORM-PRD.md) for the "why," [IPIX-REFERENCE-REUSE-MATRIX.md](IPIX-REFERENCE-REUSE-MATRIX.md) for exact files, [IPIX-MIGRATION-PLAN.md](IPIX-MIGRATION-PLAN.md) for the decision table and journeys.

Each phase lists: iPix files affected, exact reference URL/file, COPY/ADAPT/MODEL classification, what to preserve, what not to copy, tests, success criteria, rollback — per this plan's own rule 21.

---

## Phase 0 — Evidence + baseline (mostly complete as of this pass)

**Done, cited:**
- Known-good baseline identified: `3b0cc62` (2026-08-24 bootstrap). Confirmed via git archaeology **not** to be a valid revert target — see PRD §3. Preserve its *wiring shape* (module-scope-simple `CopilotRuntime` construction where possible), not its *reconnect behavior* (pre-`TenantAbortRunner`, confirmed broken).
- Current architecture inventory: PRD §2.
- P0 contract: unchanged from IPI-1117 (`run`/`connect`/`isRunning`/`stop`, real two-process proof).
- Repo/reference mapping: PRD §10, full matrix in IPIX-REFERENCE-REUSE-MATRIX.md.

**Remaining for Phase 0:** none — this phase closes with this document set.

---

## Phase 1 — Minimal AgentController spike

**This phase already exists as a scoped, tracked task: [IPI-1292](https://linear.app/amo100/issue/IPI-1292).** Do not duplicate it — this roadmap phase and that Linear issue are the same work. IPI-1292 already commits to `AgentController` as the primary candidate (2026-09-20 decision), with Intelligence-mode and a custom Supabase runner as fallback-only.

**Files:** `spikes/ipi-1117-runner/candidate-0/*` (new, per IPI-1292's own step-by-step file list). No production route changes.

**Reference:** `node_modules/@mastra/client-js/dist/resources/agent-controller.d.ts` (ADAPT — map `isRunning`→`session.state()`, `connect`→`session.subscribe({reconnect:true})` + resync via `session.state()`, `stop`→`session.abort()`); `node_modules/@mastra/core/dist/agent-controller/agent-controller.d.ts` (REFERENCE ONLY, JSDoc example shape).

**New this pass — additional spike checkpoints IPI-1292 should absorb:**
- Use the pluggable `threadLock` constructor option explicitly (confirmed real, `packages/core/src/agent-controller/thread-locking.test.ts` in `mastra-ai/mastra`) rather than the default in-memory lock.
- Test a background-task-finishes-while-idle scenario explicitly (Mastra issue #23707, open) — Brand Analysis's shape, not just a simple chat message.
- Test a tool-approval-resume scenario for duplicate answers (Mastra issue #23116, closed-fixed, but recent) as a regression check.
- Decide deployment shape for the spike server: try `@mastra/deployer-vercel` first (confirmed real, official, no new infra class) with `AgentController`'s `storage` pointed at `@mastra/pg`, before assuming a standalone VM/container is required.

**Success criteria:** real two-OS-process P0-1/P0-2/P0-3 result, recorded in IPI-1117 per IPI-1292's own Definition of Done.

**Rollback:** none needed — no production code touched.

---

## Phase 2 — Dedicated Mastra service

**Only runs if Phase 1 passes.** Adapt the official CopilotKit/Mastra server separation.

**Reference:** `https://github.com/CopilotKit/CopilotKit/tree/main/examples/integrations/mastra` — **ADAPT**. Verified version-matched (`runtime@1.72.0`, one patch behind iPix's PR #239 branch). Study `src/agent.ts`'s `createLocalAgents()`/`createDefaultAgent()` shape and `channels.mts` for the surface-registration pattern, but note its own comment: *"there is no agent server here: the agents run in this process"* — this example does NOT itself demonstrate the separated-service pattern iPix needs; it demonstrates the current (in-process) pattern iPix is trying to move away from. Use it for the CopilotKit↔Mastra wiring conventions only, not the deployment topology.

**iPix files:**
- `src/app/api/copilotkit/[[...slug]]/route.ts` — ADAPT: replace direct `getMastra()`/`createLocalAgents()` in-process call with a call through the new `AgentController` client adapter proven in Phase 1. Preserve `requirePlannerResourceId()`, `copilotAuthHooksFor()`, `requestToken` ALS wiring unchanged.
- New: `src/lib/mastra/remote-client.ts`, `src/lib/mastra/planner-session-client.ts` — thin adapters only (create/get session, send, state, subscribe, abort). No business logic.
- `src/mastra/index.ts` — MODEL only: keep agent registration as-is, point the deployment target at the chosen Phase 1 hosting shape.

**Preserve:** existing agent instructions, tools, `RequestContext`, Supabase persistence, `resourceId`, planner thread IDs — this phase changes *ownership*, not agent behavior, per the same rule IPI-1292 already established.

**Do not copy:** any example's demo model credentials, or `examples/integrations/mastra`'s `channels.mts` multi-surface wiring (Slack/Discord) — out of scope until Phase 7+.

**Tests:** `tests/runtime-family.test.ts`, `tests/intelligence-001.test.ts` updated; extend `tests/copilot-runner-cross-process.test.ts` to point at the new adapter.

**Rollback:** `TenantAbortRunner` stays in the codebase, route.ts change is reverted via git if this phase fails its own P0 re-run.

---

## Phase 3 — Concierge (Agent Harness pattern)

**Reference:** `https://github.com/mastra-ai/template-agent-harness` — **ADAPT HEAVILY**. Verified real, official org, 2★ (low external adoption — treat as official reference, not battle-tested).

**COPY/MODEL:** task lifecycle, approval-gate pattern, schedule pattern, persistent-state conventions, observability pattern.
**ADAPT:** local storage → `@mastra/pg`/Supabase; demo agent → existing iPix Concierge; generic task system → iPix Planner tasks; permissions → AUTH-002 tenant/resource model.
**Do NOT copy:** unrestricted local shell/`LocalSandbox`, local-filesystem assumptions, demo OpenAI-specific config.

**iPix files:** new `src/mastra/agents/concierge.ts` (or equivalent), wired through the Phase 2 `AgentController` session, not a new parallel runtime.

**Tests:** delegation-journey test (Concierge → specialist → approval → persist), per PRD §8's agent catalog.

**Rollback:** Concierge ships behind a route/flag; existing single-agent Planner path stays live until parity is proven.

---

## Phase 4 — Brand Intelligence (Deep Search pattern)

**Reference:** `https://github.com/mastra-ai/template-deep-search` — **ADAPT**. Verified real, 6★. Also check the canonical/newer version inside `mastra-ai/mastra` itself before assuming the standalone repo is current (not verified this pass — do before starting this phase).

**Reuse:** nested workflows, self-evaluation loop, specialist-agent fan-out, cited sources, suspend/resume, HITL gate.

**Maps to:** existing `startBrandAnalysis` journey (`composeShootPlan`/Brand DNA tools already in `src/mastra/tools/`) — this phase restructures the orchestration shape, not the underlying tool logic already proven in production.

**Rollback:** current single-agent/tool Brand Analysis path stays live until the workflow version passes the same acceptance journey (PRD §7 / migration plan journeys).

---

## Phase 5 — Knowledge layer (Company Knowledge pattern)

**Reference:** `https://github.com/mastra-ai/template-company-knowledge` — **ADAPT**. Verified real, 2★, last pushed 2026-07-13 (older than most other templates checked — re-verify freshness before deep adoption).

**Adapt:** Neon → Supabase pgvector (already provisioned, do not introduce Neon); source set → Linear + iPix docs + Brand profiles + Shoot briefs + CRM records + Campaign documents + approved research (not the template's default Notion-only set).

**Strategy to reuse:** semantic-indexed knowledge → live internal/MCP source fallback → public web search fallback, in that order.

**Rollback:** additive — a knowledge agent with no existing production dependency; disable by not routing Concierge delegation to it.

---

## Phase 6 — Browser research (Browsing Agent pattern)

**Reference:** `https://github.com/mastra-ai/template-browsing-agent` — **ADAPT**. Verified real, 43★ (highest-starred template checked). Note: a separate, much lower-signal repo `mastra-ai/template-browser-agent` (3★) also exists — do not conflate the two; prefer `template-browsing-agent`.

**Use for:** brand website audit, PDP analysis, competitor research, shot-reference research, location/vendor research.

**Reuse:** session management, navigation, observation, structured extraction, reconnect pattern.

**Do NOT copy:** unrestricted write/action capability — every write must go through iPix's existing HITL approval gate (AGENTS.md "Humans decide, AI assists"), same as every other consequential tool.

**Rollback:** additive tool for Research/Brand agents; no existing path depends on it.

---

## Phase 7 — Specialist agents (CRM / Ecommerce / Campaign / Photo / Video)

**Reference:** `https://github.com/CopilotKit/OpenBot` — **MODEL only, not a runner fix** (confirmed: its own interactive Stop is process-local, it depends on CopilotKit Intelligence, not Mastra). Use for: agent isolation shape, per-agent tool/permission boundaries, audit-row pattern (`initiator_kind`: person/deployment/routine/handoff — genuinely useful governance idea, verified in their `docs/architecture.md`).

**Do NOT clone OpenBot wholesale** — it's a different product category (autonomous computer-use coworkers with browser/file access), most of its surface (per-Bot Docker computers, screencast, host-access broker) doesn't apply to iPix.

**iPix mapping:**
```text
iPix Concierge
├── Brand Intelligence (Phase 4)
├── Shoot Planner
├── CRM Expert
├── Ecommerce Expert
├── Campaign Expert
├── Photo Expert
├── Video Expert
└── Research Expert (Phase 6)
```

**Rollback:** each specialist ships independently; no single-phase rollback blocks another.

---

## Phase 8 — Production migration

Feature-flag the new architecture. Run old (`TenantAbortRunner`) and new (`AgentController`-backed) side by side where the flag allows, per user-facing surface, not a global cutover.

**Success gate:** every item in [IPIX-MIGRATION-PLAN.md](IPIX-MIGRATION-PLAN.md) §"Production success criteria" passes on Preview with real LLM calls, not mocked.

---

## Phase 9 — Remove obsolete custom code

**Only after Phase 8's production proof, never before.**

Candidates for removal/simplification, not immediate deletion:
```text
src/lib/copilotkit/tenant-abort-runner.ts   — simplify or remove once AgentController-backed path has equal or better reconnect quality (it currently has the BEST durable-replay fallback found in this whole investigation — do not regress it)
pendingRuns / pendingStops module state     — remove only once AgentController's own state fully supersedes their purpose
custom Intelligence-mode experiment code    — remove only if Candidate 0 wins Phase 1 and Intelligence mode is not adopted elsewhere
```

**Rule, restated from IPI-1292 and this session's established discipline:** do not delete until the replacement has passed the identical P0 bar plus full regression suite plus a real Preview journey — "looks done" is not "proven done."
