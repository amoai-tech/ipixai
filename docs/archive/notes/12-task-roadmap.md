# 12 — Task roadmap (sequential Linear backlog)

**Linear IDs:** all `IPI-V2-xxx` are **PROPOSED**. Do not treat them as live Linear issues until created.  
**After:** [11-product-plan.md](./11-product-plan.md)
**Parent brief:** [README.md](../../notes/README.md)
**Rule:** current production `app/` stays up. Work in a new tree (`app-v2/` or git worktree). One concern per PR.

```text
Existing iPix code → official starter → official SDK → example repo → smallest custom code
```

**Stop line:** nothing in Epic B+ starts until **IPI-V2-018** (golden `TEST-<uuid>`) is green with SQL + browser proof on **preview** Mastra storage.

**Empty GitHub:** `amo-tech-ai/ipix` has no application code yet. IPI-V2-001 is bootstrap, not “rebuild in progress.” Prefer squash-merge + delete-branch; Private while proprietary UI is ported; branch protection after first starter commit.

**Four proof waves (tickets stay small):**

```text
WAVE 1  001–002   starter + one compatible package family + install/typecheck/build
WAVE 2  005B–008  preview DB contract + PostgresStore + Auth + org fail-closed
WAVE 3  009–017   Planner + thread locator + Memory + 403
WAVE 4  018       TEST-<uuid> stream → SQL → refresh → restart → Org B 403
```

Only after Wave 4: OperatorShell → Brand/Shoots/Assets → tools → GenUI → HITL → workflows → traces/evals.

**Three proof gates (in order):** package family → DB contract vs preview schema → persist + 403. Do not widen UI until all three are green.

**Live schema SSOT:** [01-current-state-audit.md](./01-current-state-audit.md) — `mastra_workflow_definitions` **exists** (0 rows). Do not copy old `42P01 missing-table` language into new tickets.

**Waves (tickets stay small; execute in parallel inside a wave):**

| Wave | Tickets | Outcome |
| ---- | ------- | ------- |
| 1 | 001–005 | Starter, compatible lockfile, thin runtime, in-process Mastra |
| 2 | 005B, 006–011 | Schema-contract audit, **preview** PG, auth, org, Planner, Gemini |
| 3 | 009 (authz), 012–017 | Thread locator + 403, memory, minimal UI, tests |
| 4 | 018 | Golden persist + restart + Org B 403 |

---

## Suggested skills / MCPs per epic

| Epic | Skills | MCP / CLI |
| ---- | ------ | --------- |
| A Runtime | `copilotkit`, `mastra`, `ipix-supabase`, `writing-plans` | Context7, Mastra docs, CopilotKit docs, Supabase |
| B UI | `frontend-design`, `shadcn`, `copilotkit` | Playwright / Chrome |
| C AI MVP | `mastra`, `copilotkit`, `fashion-production` | Mastra docs |
| D Cloudflare | `cloudflare-ipix`, `wrangler` | Cloudflare docs MCP |
| E Advanced | domain skills as needed | — |

---

# Epic A — Clean AI runtime

## IPI-V2-001 · BOOT-001 — Create parallel Next.js app from CopilotKit Mastra starter

**Purpose:** Empty official foundation, not a copy of `app/src/app/api/copilotkit`.  
**User outcome:** Engineers can run a stock Copilot+Mastra chat on a preview URL without touching production.  
**Reuse:** none (starter only).  
**Reference:** [CopilotKit `examples/integrations/mastra`](https://github.com/CopilotKit/CopilotKit/tree/main/examples/integrations/mastra) · [Mastra quickstart](https://docs.copilotkit.ai/mastra/quickstart)  
**Steps:** `npx copilotkit@latest create` (Mastra) **or** copy that example into `app-v2/`; `.env.example` without secrets; README “does not replace production”.  
**Depends on:** none.  
**Tests:** `npm install` + `npm run dev` shows starter chat.  
**AC:** App boots; weather/demo agent answers; **no** import from old 681-line route.  
**Proof:** localhost screenshot.  
**Fails if:** mixed into `app/` production package.json.  
**Rollback:** delete `app-v2/`.  
**Prod:** N/A.

**Efficiency:** CLI/example clone beats scaffolding by hand.

---

## IPI-V2-002 · BOOT-002 — Discover and pin one compatible CopilotKit + Mastra family

**Purpose:** One lockfile that typechecks with the **current CopilotKit Mastra starter**, not “every package’s numeric latest.”  
**User outcome:** Preview uses current supported APIs (`CopilotRuntime` / `createCopilotRuntimeHandler` from `/v2` — confirm names from installed types).  
**Reuse:** compare `app/package.json` only as a delta list; do not copy overrides blindly.  
**Reference:** starter `package.json` + `npm view` + peerDependencies at **implement time**.  
**Steps (run, do not assume):**

```bash
npm view @copilotkit/runtime version
npm view @copilotkit/react-core version
npm view @copilotkit/react-ui version
npm view @ag-ui/mastra version peerDependencies
npm view @mastra/core version
npm view @mastra/pg version peerDependencies
npm view @mastra/memory version
npm view mastra version
```

Pin the **newest mutually compatible stable set**. Snapshot 2026-08-23: CopilotKit trio **1.69.0**, `@ag-ui/mastra` **1.1.2** (peers: runtime `^1.60.1`, core `>=1.29 <2`), `@mastra/core` **1.61.0**, `@mastra/pg` **1.21.1** (peer core `>=1.53`), `@mastra/memory` **1.27.0**. That snapshot can drift; re-run the commands.  
**Depends on:** 001.  
**Tests:** `npm ls @copilotkit/runtime @ag-ui/mastra @mastra/core @mastra/pg`; `tsc --noEmit`.  
**AC:** Documented matrix in PR; no mixed 1.10 + 1.69; no canary unless starter requires it.  
**Proof:** `npm ls` paste.  
**Fails if:** install each package’s latest independently and ignore peers.  
**Rollback:** revert lockfile.

**Efficiency:** copy starter lockfile, then bump once against peers.

---

## IPI-V2-003 · RT-001 — Official CopilotKit v2 route only

**Purpose:** Thin AG-UI endpoint.  
**User outcome:** Browser talks to `/api/copilotkit` with SSE.  
**Reuse:** **ideas** from current route (auth later), not code.  
**Reference:** `examples/v2/runtime` (node) + integrations/mastra `route.ts`.  
**Steps:** Official handler only. Compare installed APIs:

- **A:** `MastraAgent.getLocalAgents({ mastra, resourceId })` (starter)
- **B (preferred if types exist):** request-scoped `getLocalAgent({ mastra, agentId, resourceId })` inside `agents: async ({ request }) => …` so tenant `resourceId` is not mutated on a global agent

Auth + org checks belong in the request hook. Keep the route **thin** (no transport/storage/compatibility museum). Line count is a **guideline**, not AC — a secure ~105-line route beats a fake 79-line route with auth hidden elsewhere.  
**Depends on:** 002.  
**Tests:** hit `/info` or equivalent 200.  
**AC:** No ALS, no idle wrapper, no Worker fetch shim; handler is official + auth/org only.  
**Proof:** curl headers.  
**Fails if:** paste from `runtime-v2-fetch.ts`.  
**Rollback:** restore starter route.

**Efficiency:** official handler vs custom Hono.

---

## IPI-V2-004 · RT-002 — CopilotKit provider + useAgent on one page

**Purpose:** v2 React contract.  
**User outcome:** One page streams tokens.  
**Reuse:** none yet.  
**Reference:** `examples/v2/react` + starter layout.  
**Steps:** `<CopilotKit runtimeUrl="/api/copilotkit">`; `useAgent({ agentId })` matching registry; `agentId` includes `default` **or** explicit Planner id (alias in 010).  
**Depends on:** 003.  
**Tests:** Playwright send “ping”.  
**AC:** Stream visible; no `useCopilotAction` v1-only APIs.  
**Proof:** browser.  
**Fails if:** v1 `CopilotKit` without `/v2` imports.  
**Rollback:** starter page.

---

## IPI-V2-005 · MS-001 — In-process Mastra instance (no extra :4111 for Core chat)

**Purpose:** Same process as Next, like the starter.  
**User outcome:** One `npm run dev` for Core (Mastra Studio optional).  
**Reuse:** `getMastra()` lazy pattern **concept** from `app/src/mastra/index.ts`, simplified.  
**Reference:** starter `src/mastra/index.ts`.  
**Steps:** `new Mastra({ agents, storage, memory })`; call from route **inside handler**, never at module top in a way that breaks `next build`.  
**Depends on:** 002.  
**Tests:** unit: `getMastra().getAgent("…")`.  
**AC:** No Cloudflare context in this file.  
**Proof:** unit + page still streams.  
**Fails if:** `getCloudflareContext` imported.  
**Rollback:** starter mastra.

---

## IPI-V2-005B · DB-001 — Diff new `@mastra/pg` contract vs preview DB (before connect)

**Purpose:** New Mastra storage must not assume the **preview** `mastra` schema matches the **installed** `@mastra/pg`. Live prod (2026-08-23, [01](./01-current-state-audit.md)): 34 tables; `mastra_workflow_definitions` **exists, 0 rows** (IPI-1008). Historical Studio `42P01` is closed. The new package may still add/rename tables.
**User outcome:** Engineers know MATCH / NEW REQUIRED / NEW OPTIONAL / CHANGED COLUMN / DEPRECATED **before** the new runtime writes.  
**Reuse:** [04-supabase-postgres-audit.md](../../mastra/04-supabase-postgres-audit.md) + `supabase/migrations` Mastra files.
**Reference:** installed `@mastra/pg` types/source (constructor + expected tables).  
**Steps:** Compare installed `@mastra/pg` vs existing migrations vs **preview/branch** live schema. Classify every table/index. Do **not** connect production `mastra` yet.  
**Depends on:** 002 (lockfile known).  
**Tests:** checklist in PR; fail if unclassified required table.  
**AC:** Written contract; explicit decision if a required table is missing (migrate preview only, or pin older pg, or isolated preview schema).  
**Proof:** table in PR.  
**Fails if:** skip to 006 against production.  
**Rollback:** N/A (read-only).

**Efficiency:** one diff vs a surprise extra table at first persist.

---

## IPI-V2-006 · PG-001 — PostgresStore on **preview** `mastra` schema

**Purpose:** Durable memory on a **preview/staging** Supabase (or dedicated preview schema), not LibSQL, **not** production threads on day one.  
**User outcome:** Messages can survive process restart (proven in 018) without contaminating live operator chats.  
**Reuse:** `getMastraStorage()` connection rules (`MASTRA_DATABASE_URL` / pooler) **and** the live constructor pattern.  
**Reference:** `app/src/mastra/storage.ts` (`createPostgresStore`) + **installed** `@mastra/pg` types (verify at implement — names can change).  
**Steps:** Read installed `PostgresStore` constructor. iPix today:

```ts
new PostgresStore({
  id: "mastra-storage", // or "ipix-mastra-v2" on the new app
  connectionString,
  schemaName: process.env.MASTRA_SCHEMA, // required; never silent `public`
  disableInit: true, // migrations own DDL — never runtime auto-DDL
})
```

Require `MASTRA_SCHEMA`. Point at **preview** DB/schema until 018 + contract match. Switch to production `mastra` only after gold. App data (brands/shoots) may still **read** the existing Supabase project.  
**Depends on:** 005, **005B**.  
**Tests:** integration against preview Infisical env; Mastra storage API insert.  
**AC:** Writes to preview `mastra.mastra_threads` / `mastra_messages` (confirm names from that DB). `disableInit: true`.  
**Proof:** SQL select after one chat (can be 018).  
**Fails if:** new `public.copilot_threads`; `schema:` instead of installed `schemaName`; `disableInit: false`; production `mastra` writes before gold.  
**Rollback:** disable storage (dev only).

**Efficiency:** reuse proven constructor; isolate blast radius.

---

## IPI-V2-007 · AUTH-001 — Supabase Auth on the new app (same project)

**Purpose:** Real operators, not `demo-user`.  
**User outcome:** Login with existing QA/operator accounts.  
**Reuse:** `app/src/lib/auth`, middleware cookie pattern, `login` page.  
**Reference:** existing iPix login + `@supabase/ssr`.  
**Steps:** port login + callback; server client; fail-closed if no session on Copilot route.  
**Depends on:** 001.  
**Tests:** unauthenticated `/api/copilotkit` → 401.  
**AC:** Same Supabase project as production; no second user table.  
**Proof:** login screenshot.  
**Fails if:** starter `resourceId: "demo-user"` remains.  
**Rollback:** remove auth routes.

---

## IPI-V2-008 · AUTH-002 — Organization membership fail-closed

**Purpose:** Tenant key for Memory `resourceId`.  
**User outcome:** User without org never chats.  
**Reuse:** `getCurrentOrgId` / `org_members` query from current Copilot route **logic** (rewrite small).  
**Reference:** IPI-146 pattern in current route comments.  
**Steps:** resolve org once per request; 403 if missing. Core private Planner: `resourceId = org:{orgId}:user:{userId}`. **Document** (do not implement in Core) future shared shoot threads: `org:{orgId}:shoot:{shootId}` — Mastra `resourceId` is the owner of the conversation, not only a user. AuthZ still comes from Supabase membership.  
**Depends on:** 007.  
**Tests:** mock member missing → 403.  
**AC:** No fallback to bare `user.id`. Do not freeze the product forever on org+user.  
**Proof:** unit + one browser 403.  
**Fails if:** shared `"default"` resourceId.  
**Rollback:** 401-only (worse) — do not ship that.

---

## IPI-V2-009 · THR-001 — Explicit threadId (locator, not a capability)

**Purpose:** Refresh restore needs a stable id; CopilotKit thread id = Mastra thread id.  
**User outcome:** Planner URL remembers the conversation **and** Org B cannot use that UUID as a key.  
**Reuse:** none (current Intelligence restore unproven).  
**Reference:** CopilotKit threads + Mastra thread/resource model.  
**Steps:** generate UUID on first message; put in `?thread=`; pass into agent run. **On every request:** load thread → compare `resourceId` / org to session org → **403** if mismatch (even if UUID is valid). Thread id is a locator, not a token.  
**Depends on:** 004, 006, 008.  
**Tests:** two requests same threadId append messages; Org B + Org A `?thread=` → 403, no message bodies.  
**AC:** Stable id; Org B never receives Org A content.  
**Proof:** SQL two rows same `thread_id` + 403 test.  
**Fails if:** new UUID every send; 403 postponed to SEC-001 only.  
**Rollback:** N/A — Core blocker.

---

## IPI-V2-010 · AG-001 — Production Planner agent only (stub tools OK)

**Purpose:** One agent for golden test.  
**User outcome:** Operator talks to Planner, not weather bot.  
**Reuse:** `production-planner` prompt from `app/src/mastra/agents`.  
**Reference:** iPix agent file + starter agent shape.  
**Steps:** port instructions; registry keys `production-planner` + `default` alias; echo tool optional.  
**Depends on:** 005.  
**Tests:** agent id present.  
**AC:** No Creative Director in Core unless zero-cost alias.  
**Proof:** chat names Planner.  
**Fails if:** port all agents now.  
**Rollback:** starter agent.

**Efficiency:** copy prompt file; don’t rewrite voice.

---

## IPI-V2-011 · LLM-001 — Gemini via existing model helper

**Purpose:** Same model family as production.  
**User outcome:** Planner replies with Gemini, not OpenAI.  
**Reuse:** `app/src/mastra/models.ts` / `GEMINI_API_KEY`.  
**Reference:** iPix models + Infisical.  
**Steps:** `@ai-sdk/google`; Infisical `dev`; no `NEXT_PUBLIC_` keys.  
**Depends on:** 010.  
**Tests:** skip if no key in CI; local Infisical run.  
**AC:** One streamed reply.  
**Proof:** server log model id (no secrets). No raw HAR with cookies.  
**Fails if:** OpenAI required in Core.  
**Rollback:** starter OpenAI for local-only — not preview.

---

## IPI-V2-012 · SEC-001 — Copilot route: session + org + no tenant rewrite

**Purpose:** AuthZ on the public Copilot endpoint.  
**User outcome:** Other brands cannot hijack thread ids.  
**Reuse:** `rejectTenantKeyRewrite` **idea**; `withOperatorAuth`.  
**Reference:** current route org checks (rewrite, don’t copy 681 lines).  
**Steps:** wrap handler; compare request thread resource vs org; 403 mismatch.  
**Depends on:** 008, 009.  
**Tests:** Org A threadId + Org B token → 403.  
**AC:** Fail closed.  
**Proof:** automated test.  
**Fails if:** RLS-only assumption (`mastra` policies are `true` for runtime role).  
**Rollback:** block preview.

---

## IPI-V2-013 · ERR-001 — Small error envelope (no 5xx museum)

**Purpose:** Debuggable failures without the old sanitizer novel.  
**User outcome:** Operator sees “sign in” / “no organization”, not a hang.  
**Reuse:** maybe 10-line Gemini dual-auth header strip **if** still required (prove with one failing request).  
**Reference:** official handler errors.  
**Steps:** map auth errors; log **request id** on every Copilot request (Core observability); no stream idle timeout unless hang reproduced.  
**Depends on:** 003.  
**Tests:** 401/403 JSON; request id present in logs.  
**AC:** No `withStreamIdleTimeout` unless hang ticket. Request ids in Core; full traces in MVP (049).  
**Proof:** curl.  
**Fails if:** port 200 lines of normalizeRuntimeError.  
**Rollback:** starter errors.

---

## IPI-V2-014 · TST-001 — Unit tests for auth + resourceId

**Purpose:** Fast gate.  
**Reuse:** vitest patterns from `app/`.  
**Steps:** 401, 403 no org, resourceId format.  
**Depends on:** 012.  
**Tests:** `vitest run`.  
**AC:** CI job on `app-v2`.  
**Proof:** CI log.  
**Fails if:** tests mock success only.  
**Rollback:** N/A.

---

## IPI-V2-015 · TST-002 — Persistence helper: unique marker on expected thread

**Purpose:** Persistence evidence that cannot collide with old runs.  
**Reuse:** Mastra Memory/storage API **plus** SQL as the **trusted DB/pooler role** (Infisical). Do **not** assume `SUPABASE_SERVICE_ROLE_KEY` can `SELECT mastra.*` — production `service_role` has **no** schema USAGE on `mastra`.  
**Steps:** generate `TEST-<uuid>` (e.g. `TEST-98c70da8-…`). Assert expected `thread_id`, `resourceId`, content, org.  
**Depends on:** 006.  
**Tests:** skip without preview DB.  
**AC:** Helper used by 018; no global `LIKE '%TEST-123%'`.  
**Proof:** query/API output.  
**Fails if:** writes to `public`; uses `service_role` and silently gets empty.  
**Rollback:** N/A.

---

## IPI-V2-016 · UI-001 — Minimal Planner page (no OperatorShell yet)

**Purpose:** Golden UI without porting the whole shell.  
**Reuse:** Planner copy/layout snippets optional; chat can be starter UI.  
**Reference:** `examples/shadcn` only if styling is &lt; 1 hour.  
**Steps:** `/app/planner` behind auth; send box; show thread id.  
**Depends on:** 004, 007, 010.  
**Tests:** Playwright login + send.  
**AC:** Page exists; not full Command Center.  
**Proof:** screenshot.  
**Fails if:** port 40 screens.  
**Rollback:** starter page route.

---

## IPI-V2-017 · MEM-001 — Mastra Memory on PostgresStore (lastMessages)

**Purpose:** Reload history into the model.  
**Reuse:** Memory options from current `memory.ts` (`lastMessages: 40`) — simplify.  
**Reference:** Mastra Memory + PG.  
**Steps:** `new Memory({ storage })` on Planner; working memory **off** until MVP.  
**Depends on:** 006, 010.  
**Tests:** two turns, second sees first.  
**AC:** Working memory schema not required for Core.  
**Proof:** second-turn content.  
**Fails if:** LibSQL leftover.  
**Rollback:** storage-only.

---

## IPI-V2-018 · GOLD-001 — Golden persist / refresh / restart / cross-org test

**Purpose:** Core definition of Done.  
**User outcome:** User A’s unique marker survives refresh and Node restart; User B cannot open that thread.  
**Reuse:** QA login from CLAUDE.md.  
**Steps:**  
1. User A authenticates; server derives org A.  
2. New thread gets a stable UUID (locator).  
3. Send `TEST-<uuid>` → stream completes.  
4. Exact row under expected `threadId` + `resourceId` (Memory API + trusted SQL).  
5. Hard refresh → messages reload from Postgres.  
6. Restart Node → messages still reload.  
7. User B opens the same thread URL → **403**; no User-A content.  
8. User B can start a **new** thread normally.  
**Depends on:** 009–017.  
**Tests:** Playwright + Mastra API + trusted SQL on **preview** storage.  
**AC:** All steps; PR evidence = screenshot + **sanitized** network + SQL/API id. No raw HAR with cookies/tokens.  
**Proof:** **Local Runtime Verified** (or preview).  
**Fails if:** InMemory runner was the only store; production `mastra` mutated.  
**Rollback:** stay on production app.  
**Prod checklist:** do **not** mark production-ready; Core preview only.

**Efficiency:** this test replaces weeks of CF debugging.

---

# Epic B — UI reuse

*Blocked by IPI-V2-018.*

## IPI-V2-020 · TOK-001 — Port design tokens (Cormorant / Outfit / orange)

**Purpose:** New app looks like iPix.  
**Reuse:** `app` globals / CSS variables; `.dc.html` tokens.  
**Steps:** copy tokens; Google fonts; no Inter.  
**Depends on:** 018.  
**Tests:** visual snapshot optional.  
**AC:** Planner page uses serif headings.  
**Proof:** screenshot.  
**Fails if:** restyle brand.  
**Rollback:** starter CSS.

---

## IPI-V2-021 · SHELL-001 — Port OperatorShell

**Purpose:** Operator chrome.  
**Reuse:** `OperatorShell.dc.html` + `app/src/components/operator-shell`.  
**Reference:** shadcn Copilot example for chat slot only.  
**Steps:** layout wrap `/app/*`; nav links to ported routes as they land.  
**Depends on:** 020.  
**Tests:** nav renders; marketing routes without shell (existing test idea).  
**AC:** Planner lives inside shell.  
**Proof:** browser.  
**Fails if:** new shell from scratch.  
**Rollback:** hide nav.

---

## IPI-V2-022 · RAIL-001 — Port IntelligencePanel

**Purpose:** Right rail.  
**Reuse:** `intelligence-panel/*` + `panel-contract`.  
**Steps:** mount; may show static/dev fixture until data wired.  
**Depends on:** 021.  
**Tests:** existing panel tests copy.  
**AC:** Rail visible on Planner.  
**Proof:** screenshot.  
**Fails if:** new panel design.  
**Rollback:** omit rail.

---

## IPI-V2-023 · PG-CC — Port Command Center `/app`

**Reuse:** Command Center.v2 + `app/src/app/(operator)/app/page.tsx`.  
**Steps:** copy page; point Copilot to v2; data hooks same Supabase.  
**Depends on:** 021.  
**AC:** Loads for logged-in org.  
**Tests:** page render + RLS-safe fetch.  
**Proof:** browser.  
**Fails if:** redesign.

---

## IPI-V2-024 · PG-BRAND — Port Brand list + detail

**Reuse:** Brand pages + `.dc.html`.  
**Depends on:** 021.  
**AC:** List + detail from existing tables.  
**Tests:** org-scoped query.  
**Proof:** browser.

---

## IPI-V2-025 · PG-SHOOTS — Port Shoots list + detail

**Reuse:** shoots pages.  
**Depends on:** 021.  
**AC:** List + detail.  
**Proof:** browser.

---

## IPI-V2-026 · PG-WIZ — Port Shoot Wizard

**Reuse:** `shoots/new` + wizard components + later workflow (Epic C).  
**Depends on:** 025.  
**AC:** Wizard UI complete; commit can wait for HITL tools.  
**Proof:** browser walkthrough.

---

## IPI-V2-027 · PG-ASSETS — Port Assets list + detail

**Reuse:** assets pages + Cloudinary components.  
**Depends on:** 021.  
**AC:** Gallery loads.  
**Proof:** browser.

---

## IPI-V2-028 · PG-CRM — Port essential CRM (companies, contacts, pipeline)

**Reuse:** `app/crm/*`.  
**Depends on:** 021.  
**AC:** Lists work; skip Matching/Talent if timeboxed.  
**Proof:** browser.  
**Defer:** Matching, Talent onboarding, Analytics, Inbox, Campaign performance → Advanced unless blocking a shoot.

---

## IPI-V2-029 · CHAT-001 — Native chat chrome (shadcn Copilot example)

**Purpose:** Chat matches shell, not stock Copilot skin.  
**Reuse:** iPix chat dock if exists; else [examples/shadcn](https://github.com/CopilotKit/CopilotKit/tree/main/examples/shadcn).  
**Depends on:** 021.  
**AC:** Dock in shell; still v2 `useAgent`.  
**Proof:** screenshot.

---

# Epic C — AI-native MVP

*Blocked by IPI-V2-018 + OperatorShell (021).*

## IPI-V2-040 · STATE-001 — Shared state from mastra-pm mapped to shoots

**Purpose:** Board updates when Planner talks.  
**Reuse:** iPix shoot types; **patterns** from [canvas/mastra-pm](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra-pm) (`tasks[]` → fittings/shots).  
**Do not:** clone mastra-pm app or its old Copilot 1.10 lockfile.  
**Depends on:** 025, 017.  
**AC:** Agent updates a visible shoot field; refresh keeps it (DB app table **or** working memory — pick app table for product truth).  
**Proof:** UI + SQL.  
**Fails if:** second source of truth for shoot rows.

---

## IPI-V2-041 · GENUI-001 — Generative UI cards

**Purpose:** Shot list / approval as cards.  
**Reference:** CopilotKit generative-ui showcase.  
**Reuse:** `ApprovalCard.dc.html`.  
**Depends on:** 029.  
**AC:** One card from agent output.  
**Proof:** screenshot.

---

## IPI-V2-042 · HITL-001 — Official human-in-the-loop (no clone hack)

**Purpose:** Approve before writes.  
**Reuse:** business gates in tools; **not** `emitInterruptOutcome` mutation.  
**Reference:** CopilotKit HITL + Mastra suspend/resume (verify docs).  
**Depends on:** 041.  
**AC:** Approve continues; reject stops; no private agent config patch.  
**Proof:** browser approve path.  
**Linear cousin:** IPI-1010 stays on old app; this is the v2 proof.

---

## IPI-V2-043 · WM-001 — Planner working memory (Zod)

**Reuse:** existing Planner working-memory schema.  
**Depends on:** 017, 040.  
**AC:** `brandName` / shoot type survive refresh.  
**Proof:** SQL/memory row + UI.

---

## IPI-V2-044 · AG-002 — Attach real Planner tools

**Reuse:** `generateShotListDraft`, `estimateShootBudget`, `lookupChannelSpecs`, etc.  
**Depends on:** 042 (writes), 018 (chat).  
**AC:** One tool call in a reply; org-scoped.  
**Proof:** log + UI.  
**Fails if:** tools skip HITL on writes.

---

## IPI-V2-045 · AG-003 — Port Creative Director agent

**Reuse:** `creative-director` agent.  
**Depends on:** 044.  
**AC:** Switch agent in UI; `default` still Planner.  
**Proof:** browser.

---

## IPI-V2-046 · WF-001 — Brand Intelligence workflow on v2

**Reuse:** `brand-intelligence` workflow + tools.  
**Depends on:** 024, 044.  
**AC:** Run from Brand page; no secrets in snapshots.  
**Proof:** UI + `mastra` snapshot **optional**.

---

## IPI-V2-047 · WF-002 — Shoot Wizard Mastra workflow

**Reuse:** `shoot-wizard` workflow.  
**Depends on:** 026, 042.  
**AC:** Wizard can resume after refresh (workflow snapshot **or** app draft table — prefer existing shoot draft).  
**Proof:** browser.

---

## IPI-V2-048 · AG-004 — Brand Intelligence agent on Brand page

**Reuse:** brand-intelligence agent.  
**Depends on:** 046.  
**AC:** Chat on Brand detail uses that agent id.  
**Proof:** browser.

---

## IPI-V2-049 · OBS-001 — Mastra traces in staging (MVP foundation)

**Purpose:** Observability before porting dozens of tools. Current prod has ~6 stored spans.  
**User outcome:** Engineers can see agent run, model call, tool call, error, duration, thread id, request id in **staging**.  
**Reuse:** Mastra observability exporter; existing Sentry later for correlation (088).  
**Depends on:** 018, then first real Planner tools.  
**AC:** Staging traces for a Planner tool call; sampling/dashboards stay Advanced.  
**Proof:** one trace screenshot (no secrets).  
**Fails if:** wait until Epic E.

---

## IPI-V2-050 · EVAL-001 — Planner tool-order eval (MVP)

**Purpose:** Stop regressions like shot list before approval. Current iPix has hundreds of unit tests but no agent-eval layer.  
**User outcome:** CI (or Mastra eval CLI) fails if Planner asks for a shot list before deliverables/approval when the scenario requires that order.  
**Reuse:** Mastra evals / CLI actions; Planner prompts/tools.  
**Depends on:** real Planner tools attached (after 018).  
**AC:** Must: deliverables → approval → shot list. Must not: shot list then ask approval.  
**Proof:** failing eval on inverted order + passing eval on correct order.  
**Fails if:** evals only in Advanced.

---

# Epic D — Cloudflare (after Node gold)

## IPI-V2-060 · CF-001 — AI Gateway for Gemini (Node still hosts Copilot)

**Purpose:** Observability/limits without Worker runtime.  
**Reuse:** iPix AI Gateway verification scripts.  
**Depends on:** 018.  
**AC:** Planner traffic visible in Gateway; golden test still passes.  
**Proof:** Gateway dashboard + unique `TEST-<uuid>`.

---

## IPI-V2-061 · CF-002 — R2 / Queues for assets/jobs (not chat persist)

**Purpose:** Media/jobs.  
**Depends on:** 027.  
**AC:** Upload path documented; chat still Mastra PG.  
**Proof:** one upload.  
**Fails if:** threads stored in R2.

---

## IPI-V2-062 · CF-003 — Worker compatibility eval (read-only)

**Purpose:** List Node APIs Copilot/Mastra need.  
**Reuse:** `wrangler.jsonc` as **reference**, do not enable `MASTRA_STORAGE_MODE=noop`.  
**Depends on:** 018.  
**AC:** Written eval: go / no-go.  
**Proof:** doc.  
**Fails if:** silent cutover.

---

## IPI-V2-063 · CF-004 — OpenNext preview of app-v2

**Depends on:** 062 go.  
**AC:** Preview Worker boots.  
**Proof:** `*.workers.dev`.

---

## IPI-V2-064 · CF-005 — Same golden `TEST-<uuid>` on Worker

**Depends on:** 063, Hyperdrive or TCP to PG **working**.  
**AC:** Refresh + restart + cross-org on Worker (same steps as 018).  
**Proof:** SQL + browser on preview.  
**Cutover:** only if this matches Node.  
**Rollback:** keep Vercel Node Copilot.

---

## IPI-V2-065 · CF-006 — Production DNS cutover (optional)

**Depends on:** 064.  
**AC:** Human approval; production iPix Copilot decommission plan.  
**Proof:** Production Verified unique marker.  
**Rollback:** DNS back to Node.

---

# Epic E — Advanced

Do not schedule until MVP screens + HITL are in use.

| ID | Task | Why later | Official ref |
| -- | ---- | --------- | ------------ |
| IPI-V2-080 | MCP tools | Extra surface | CopilotKit MCP showcase |
| IPI-V2-081 | Browser research tools | Cost/safety | Mastra browser |
| IPI-V2-082 | Multi-agent canvas | Needs shared state (040) | multi-agent showcase |
| IPI-V2-083 | **Signals** (shared shoot thread, multi-client) | After persist+authz; **before A2A** | Mastra Signals |
| IPI-V2-084 | CopilotKit Intelligence Threads UI | After Mastra persist proven | CopilotKit Intelligence docs |
| IPI-V2-085 | Chatwoot / WhatsApp | Channels | CopilotKit channels |
| IPI-V2-086 | Postiz publishing | Product later | Postiz |
| IPI-V2-087 | Snapshot prune / retention | Ops | SQL job |
| IPI-V2-088 | Sampling, dashboards, Sentry↔trace correlation | After 049 | existing Sentry |
| IPI-V2-089 | Matching / Talent / Analytics / Inbox port | Non-blocking | existing pages |
| IPI-V2-090 | A2A | After Signals; weaker iPix fit | a2a-travel |
| IPI-V2-091 | Clean scheduler proof (one shoot reminder) | **Do not port** current dispatcher rows | Mastra schedules |

Signals &gt; A2A for iPix (producer + photographer + later WhatsApp on one shoot thread).

---

# Execution order (do this)

```text
001 starter
 → 002 compatible family (npm view + peers)
 → 003 route + 005 mastra + 007 auth (parallel after 002)
 → 005B schema contract vs preview DB
 → 006 PostgresStore on preview (schemaName + disableInit)
 → 008 org + 010 Planner + 011 Gemini
 → 009 thread locator + 403 + 012 authz + 013 request ids + 016 page + 017 memory
 → 014–015 tests (unique TEST-<uuid>, trusted SQL)
 → 018 GOLDEN GATE
 → 020–029 UI ports (shell first, then pages)
 → 049 traces (staging) + Planner tools + 050 evals
 → 040–048 AI MVP
 → 060–064 Cloudflare eval (same golden)
 → 083 Signals (shared shoots) then 091 clean schedules
 → 080+ other Advanced (A2A after Signals)
```

---

# Suggested first Linear create (human)

Create Epic **iPix v2 clean runtime** then issues **IPI-V2-001 … 018** plus **005B**. Do not bulk-create Epic E.

---

# Definition of Done (any task)

- [ ] Touched production Copilot route? **Must be no** (except freeze notice).
- [ ] Official starter/SDK used before custom code.
- [ ] Test command in PR.
- [ ] Browser proof if UI.
- [ ] SQL proof if persist.
- [ ] Rollback named.
