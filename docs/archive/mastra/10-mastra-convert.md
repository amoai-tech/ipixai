# 10 — Mastra conversion plan (steps only)

Source of truth for **what to move** from `/home/sk/ipix/app/src/mastra` into `/home/sk/ipixai/src/mastra`. Do **not** copy the old tree. Do **not** mutate production Supabase. Do **not** run combined `npm run dev` (DEV-STAB-001).

Starter: CopilotKit `examples/integrations/mastra`. Runtime stays simpler than old iPix.

---

## Audit verdict (locked)

1. **Executive verdict:** Port **business logic** (Planner instructions, HITL gates, deterministic shoot tools, `makeMemoryResourceId`, Shoot Wizard **step logic**). Rebuild **runtime** (Mastra boot, storage, CopilotKit route). Drop Worker/Hyperdrive/ALS/SSE/interrupt patches until a current failure proves they are required.

2. **Reusable Mastra business code:** ~**40%** of old `src/mastra` (prompts, tool schemas + execute bodies, workflow step algorithms, tenant ID helpers, unit tests as fixtures).

3. **Runtime code to delete / not port:** ~**80%** of old storage + CopilotKit route + Workers PG scope + durable-agent wrappers + observability exporter glue.

4. **First move:** `production-planner` + minimal **read/compute** tools + Memory + PostgresStore + org/thread isolation + golden persistence test. **Not** Shoot Wizard, **not** write tools, **not** Brand Intelligence.

5. **Installed vs old APIs (2026-08-24):** iPixai has `@mastra/core` **1.41.0**, `@mastra/memory` **1.0.1-alpha.1**, `@mastra/libsql` in-memory, **no `@mastra/pg`**. Old iPix uses PostgresStore + `schemaName`/`disableInit` (verify on **installed** `@mastra/pg` after pin). CopilotKit still uses `MastraAgent.getLocalAgents({ mastra, resourceId })`. Working memory `scope: "resource" | "thread"` is current. Observational memory: **Post-MVP**.

6. **Old tests run this audit (no prod DB):** `generateShotListDraft.test.ts`, `memory.test.ts`, `agents/index.test.ts` — **32 passed**. Planner routing tests are Cloudflare-model specific — **do not port as-is**.

7. **Scores:** migration plan **78/100**. confidence **72%** until `@mastra/pg` pin + preview gold test. P0: package pin, preview schema, no service-role reads.

---

## Guards (every step)

- Split servers only: `npm run dev:ui` and `npm run dev:agent`.
- Preview Supabase / `mastra_preview` only. Production `mastra` schema: **read-only audit**, never write.
- Tools that mutate domain data: **SECURITY DEFINER RPCs + user JWT**. No Mastra `postgres` writes to `shoot.*`.
- Fail closed on blank `orgId` / `userId`. Storage RLS does **not** isolate orgs — `resourceId` is the partition.
- Re-verify Agent / Memory / PostgresStore / workflow APIs from **installed** packages before each port.

---

## Step 0 — Inventory freeze (old `/src/mastra`)

87 TS files. Classify once; do not expand scope mid-Core.

### KEEP (ideas / contracts)

| Item | Why |
|------|-----|
| Agent IDs `default`, `production-planner` | CopilotKit + UI |
| Three HITL gates (deliverables → shots → budget) | Proven operator contract |
| `makeMemoryResourceId` = `org:{org}::user:{user}` | Tenant partition |
| `PlannerWorkingMemory` Zod shape | MVP working memory |
| `agentTools` registry pattern | Auditable surface |
| Shoot Wizard **business** steps | HITL mapping |
| Brand Intelligence **prompts + tool contracts** | MVP |
| `REQUIRED_AGENT_IDS` fail-fast | Registry hygiene |

### PORT AS-IS (logic, not files)

- `recommendShootType` rules
- `planDeliverables` / channel defaults (also in shoot-wizard)
- `generateShotListDraft` + `buildShotListFromReferences` (copy **lib**, not CF wrappers)
- `estimateShootBudget` (if pure compute)
- `approveShotList` (if validation-only)
- `lookupChannelSpecs` (if static/spec table read via RLS)
- CRM **search** tools’ query shapes (MVP+)
- Unit tests as **behavior specs** (rewrite imports)

### PORT + ADAPT

- `agents/index.ts` Planner + Creative Director **instructions** (strip `navigateTo` / CF model / durable)
- `lookupShotReferences` — **stop service-role**; user JWT + RLS or RPC
- `saveApprovedShootDraft` — drop `createSupabaseAdminClient`; JWT + RPC only
- `getCurrentPageContext` — rebuild against new CopilotKit context, keep verified-ID rule
- `memory.ts` — drop Proxy/ALS; keep schemas + ID helpers
- `workflows/shoot-wizard.ts` — keep steps; rewrite `createWorkflow`/`suspend` against **1.41** APIs
- CRM writes (`logActivity`, `moveDealStage`) — keep org check via JWT; drop ALS `requestToken`
- Brand tools — same; no edge-function CF glue

### REBUILD CLEAN

- `src/mastra/index.ts` (starter Mastra instance)
- Storage: one `PostgresStore` (preview), `schemaName: "mastra"` (or preview schema), `disableInit: true` on anything that is not a disposable preview
- CopilotKit route + `src/agent.ts` `resourceId` from auth (not `"default"`)
- Tool execute context (JWT from request, not ALS)
- Observability: ConsoleLogger first; exporter later

### DEFER

- Creative Director, Brand Intelligence agent, Shoot Wizard **runtime**, HITL write, structured output/GenUI, task tracking, CRM/booking/talent/assets, schedules, MCP, dynamic workflows, observational memory, `mastraWorkflows()` lazy bind, `createDurableAgent`

### DROP

- `storage.ts` Workers skip / InMemory / Hyperdrive / `MASTRA_STORAGE_MODE` / module-global PG
- `durable.ts` + `bindWrappedWorkflows`
- `models.ts` re-export of CF/Gemini routing (new app uses starter model pin until a provider ticket)
- `tools/edge.ts` Cloudflare edge caller
- `public-marketing-agent` + `prompts/public-marketing.ts` + `types/marketing-lead.ts` (not operator Core)
- `suggestShootBrief.ts` (not in `agentTools`)
- CopilotKit `emitInterruptOutcome` mutations, `runtime-v2-fetch`, body tee, URL thread parsing, Hyperdrive ALS
- `__mastra_notification_dispatcher` / 6k snapshot fan-out
- Weather demo agent/tool (after Planner registers)

### Classification by old file

| Old file | Decision |
|----------|----------|
| `agents/index.ts` (Planner + CD) | PORT + ADAPT (Planner first) |
| `agents/*.routing.test.ts` | DROP (CF routing) |
| `agents/index.test.ts` | PORT + ADAPT (IDs/tools) |
| `agents/brand-intelligence-agent.ts` | DEFER then PORT + ADAPT |
| `agents/visual-identity.ts` | DEFER |
| `agents/social-discovery.ts` | DEFER |
| `agents/model-match-agent.ts` | DEFER |
| `agents/booking-agent.ts` | DEFER |
| `agents/crm-assistant-agent.ts` | DEFER |
| `agents/public-marketing-agent.ts` | DROP |
| `durable.ts` / `durable.test.ts` | DROP |
| `index.ts` / `observability.test.ts` | REBUILD CLEAN |
| `memory.ts` / `memory.test.ts` | PORT + ADAPT |
| `storage.ts` / `storage.test.ts` | DROP + REBUILD CLEAN |
| `models.ts` / `models.test.ts` | DROP |
| `agent-workflows.ts` | DEFER (static workflow bind first) |
| `tools/index.ts` | REBUILD CLEAN (tiny registry) |
| `tools/recommendShootType.ts` | PORT AS-IS |
| `tools/planDeliverables.ts` | PORT AS-IS |
| `tools/generateShotListDraft.ts` | PORT AS-IS (+ lib) |
| `tools/estimateShootBudget.ts` | PORT AS-IS |
| `tools/approveShotList.ts` | PORT AS-IS |
| `tools/explainShootDnaAlerts.ts` | DEFER |
| `tools/lookupShotReferences.ts` | PORT + ADAPT |
| `tools/lookupChannelSpecs.ts` | PORT + ADAPT |
| `tools/saveApprovedShootDraft.ts` | DEFER then PORT + ADAPT (RPC) |
| `tools/currentPageContext.ts` | DEFER then REBUILD CLEAN |
| `tools/brand-intelligence-tools.ts` | DEFER |
| `tools/crm/*` | DEFER |
| `tools/booking-tools.ts` | DEFER |
| `tools/talent-match-tools.ts` | DEFER |
| `tools/getAssetDnaEvidence.ts` etc. | DEFER |
| `tools/social-discovery.ts` | DEFER |
| `tools/draftCampaignBrief.ts` | DEFER |
| `tools/edge.ts` | DROP |
| `tools/suggestShootBrief.ts` | DROP until product asks |
| `workflows/shoot-wizard.ts` | DEFER then PORT + ADAPT |
| `workflows/brand-intelligence-workflow.ts` | DEFER then PORT + ADAPT |
| `prompts/*` `types/*` | DROP from Core |

### Agent cards (deep review)

Shared old hacks on almost every agent: `resolveAgentModel` / Cloudflare `cfEnv`, `@ts-expect-error` Memory, `navigateTo` frontend tools. **Do not port** those. Port instructions + tool **policy**.

| Agent | Purpose | Model (old) | Tools | Memory | Business rules | Deps / Supabase | Tests | New dest | When |
|-------|---------|-------------|-------|--------|----------------|-----------------|-------|----------|------|
| **production-planner** | End-to-end shoot plan, 3 HITL gates | CF dynamic → Gemini/Groq legacy | Subtracted `agentTools` (shoot + page context; **no** CRM/booking/assets) | `getPlannerMemory()` thread + `PlannerWorkingMemory` | Strict tool order; no invented angles; no DB except `saveApprovedShootDraft` after gates | `lookupShotReferences` **service role**; save uses JWT **and** admin | `index.test.ts` (keep); `*.routing.test.ts` DROP | `agents/production-planner.ts` | **CORE first** |
| **default** | CopilotKit prebuilt UI | Same as Planner via `createDurableAgent` | Same | Same | Alias only | Durable wrapper | registry | Same Agent instance, no DurableAgent | CORE |
| creative-director | Campaigns briefs + asset DNA | CF dynamic | DNA evidence, retakes, bulk-approval **draft**, `draftCampaignBrief`, page context | `getMastraMemory()` | **No silent writes**; drafts only; no re-audit | Asset DNA reads; ALS on some tools | routing tests DROP | `agents/creative-director.ts` | MVP after wizard |
| brand-intelligence | Brand DNA on `/app/brand/*` | CF + catch → `resolveModel` | brand tools + `mastraWorkflows("brand-intelligence")` | base Memory | Context-first; `explainPillar` required; HITL draft_ready; no parallel analysis | Brand tables + **workflow uses service role + edge fns + direct `brands` update** | snapshot + routing | `agents/brand-intelligence.ts` | MVP; **rewrite workflow runtime** |
| visual-identity | Extract design from homepage | CF native or **vision** model | `extractVisualIdentity` (Gemini vision + Cloudinary) | none in file | brandId + URL → extract | Cloudinary, vision | `visual-identity.test.ts` | later | Post-MVP / brand pipeline |
| social-discovery | Find + **save** social accounts | CF | `discoverSocialChannels` | none | Given brandId, discover and persist | **Write** — not Core | tool tests | later | After brand HITL |
| model-match | Talent search + shortlist | CF | search / score / `manageShortlist` | none | Never invent scores; shortlist only on explicit ask | talent tables + ALS JWT | — | later | After Planner gold |
| crm-assistant | Relationship Hub | CF + catch | search, log, move stage, score, summarize, draft follow-up | base Memory | Never won/lost; no silent retry; draft email does not send | org via `getCrmUserClient` (ALS) | routing + agent tests | later | After CD |
| booking | Draft booking requests | CF | availability, quote (read), `createBookingDraft` | none | Never confirm; `operatorConfirmed` only after HITL | booking APIs + ALS | snapshot tests | later | After model-match |
| public-marketing | Unauth marketing chat | CF `fast` | **none** | **none** | No operator tools | Lead capture is edge fn, not agent | agent tests | **DROP** from iPixai operator | — |

**First agent to move:** Production Planner (expected). Creative Director is second **personality** but third **port** (after Shoot Wizard HITL, because CD is a different surface).

---

## Step 1 — Pin current APIs (P0)

Do this **before** any agent port.

1. Add compatible `@mastra/pg` (plan assumed **1.12.0** — **installed types win**). Keep `@mastra/core` on the starter line unless a documented peer requires a bump.
2. Diff `PostgresStore` constructor: `schemaName` vs `schema`, `disableInit`, pool options. Record in a one-pager under `docs/mastra/`.
3. Confirm Memory: `lastMessages`, `workingMemory.enabled`, `workingMemory.scope`, `workingMemory.schema`.
4. Confirm CopilotKit: `getLocalAgents({ mastra, resourceId })` — **never** hardcode `"default"` in Core.
5. Do **not** add `@mastra/observability` until Core gold is green.
6. Do **not** enable observational memory.

**Tests before next step:** package install + TypeScript compile of a 10-line `PostgresStore` smoke (preview connection string only).

---

## Step 2 — Replace demo Mastra boot

| Starter file | Decision |
|--------------|----------|
| `src/mastra/index.ts` | MERGE: keep `new Mastra` + ConsoleLogger; replace LibSQL with PostgresStore; agents `{ default, production-planner }` same instance |
| `src/mastra/agents/index.ts` | REPLACE weather with Planner; remove proverb `AgentState` |
| `src/mastra/tools/index.ts` | REPLACE weather with Core shoot **read/compute** tools |
| `src/agent.ts` | MERGE: keep `getLocalAgents`; `resourceId` from auth helper |
| `src/app/api/copilotkit/.../route.ts` | KEEP starter handler; add auth → resourceId later in this step if route already has user |

**Tests:** agent registry contains `production-planner` and `default` (alias OK). Weather agent gone.

---

## Step 3 — Memory + PostgresStore + org isolation (CORE)

Target:

```text
CopilotKit → Mastra → Memory/PostgresStore → preview mastra schema
resourceId = org:{orgId}::user:{userId}
```

1. Port `makeMemoryResourceId` + `requireResourceId` (fail closed). **Not** old `makeThreadId` slash format unless gold test needs it — prefer CopilotKit thread ids + resource partition.
2. One Memory instance: `lastMessages: 40`. Working memory **off** in Core (starter `scope: "resource"` caused the thread-not-found fix; Core persists **messages** first).
3. `disableInit: true` except disposable preview if catalog mismatch.
4. No InMemoryStore, no LibSQL in production path, no Workers getter, no HMR global store.

**Tests before Planner chat:** resourceId rejects empty org/user; two orgs cannot share resourceId; store connects to **preview** only.

---

## Step 4 — Production Planner first (CORE)

**Why first:** richest proven contract, smallest write surface if tools are compute-only, UI already expects `production-planner` / `default`.

| Field | Old | New |
|-------|-----|-----|
| Purpose | Fashion shoot planning, 3 HITL gates | Same instructions, **no writes** |
| Model | `resolveAgentModel` CF/Gemini | Starter provider (OpenAI until provider ticket) |
| Tools | Subtracted `agentTools` (shoot + page context; **no** CRM/booking/asset) | Same **subset**, minus page context until CopilotKit context exists |
| Memory | `getPlannerMemory()` thread + schema | Shared Memory, no working schema yet |
| Business rules | Strict tool order; no invented angles | Keep in instructions |
| Supabase | lookup via **service role** (unsafe) | Core: static/compute tools only **or** JWT+RLS lookup |
| Tests | ID + routing | ID + tool names + schema tests; **not** CF routing |
| Hacks | DurableAgent, `@ts-expect-error` Memory | Plain `Agent` |
| Destination | `src/mastra/agents/production-planner.ts` + register in `index.ts` | |

`default` **aliases** Planner (old `durableAgents`). Do not add a second personality.

**Do not attach:** CRM, booking, talent writes, asset DNA, `saveApprovedShootDraft`, Brand workflow.

---

## Step 5 — Minimal safe tools (CORE)

Group now; only **shoot compute + optional RLS read** in Core.

| Tool | Group | R/W | Org | Idempotent | HITL | RPC/table | Reuse | Cleanup |
|------|-------|-----|-----|------------|------|-----------|-------|---------|
| `recommendShootType` | shoot | compute | n/a | yes | no | none | yes | none |
| `planDeliverables` | shoot | compute | n/a | yes | gate 1 later | none | yes | none |
| `lookupShotReferences` | shoot | **read** | **missing** (service role) | yes | no | `shot_type_references` | **no until RLS/RPC** | **P0** |
| `lookupChannelSpecs` | shoot | read/static | check | yes | no | specs | adapt | JWT |
| `generateShotListDraft` | shoot | compute | n/a | yes | gate 2 later | lib | yes | none |
| `estimateShootBudget` | shoot | compute | n/a | yes | gate 3 later | none | yes | none |
| `approveShotList` | shoot | compute | n/a | yes | yes later | none | yes | none |
| `saveApprovedShootDraft` | shoot | **write** | token + admin mix | need RPC idempotency | **required** | `commitShootDraft` + **admin** | **no** | RPC only |
| `explainShootDnaAlerts` | shoot | read | check | yes | no | DNA | defer | JWT |
| `getCurrentPageContext` | utility | read | verified flag | yes | no | CopilotKit | rebuild | new context |
| `getBrandProfile` / scores / explain / approve / startAnalysis / searchSimilar | brand | mix | check | mixed | yes on approve | brand RPCs | defer | |
| CRM search | CRM | read | `getCrmUserClient` org | yes | no | crm tables | defer | drop ALS |
| `logActivity` / `moveDealStage` | CRM | write | org | check | stage HITL | lib | defer | |
| booking / talent / assets / social | those | mix | ALS token | mixed | drafts | various | defer | |

**Flags (do not copy):**

- Direct **service-role** reads (`lookupShotReferences`).
- **Admin client** on shoot commit.
- ALS `requestToken` — replace with explicit request-scoped JWT.
- Duplicate shoot logic in tools **and** wizard — share one lib module.
- `suggestShootBrief` unused in registry.

**Core tool order:** `recommendShootType` → `planDeliverables` → `generateShotListDraft` → `estimateShootBudget` → (`lookupChannelSpecs` if no DB). **Then** JWT `lookupShotReferences`. **Never** Core: save draft.

**Tests:** Zod input/output; generateShotList rejects empty deliverables/references (port old tests); lookup without org JWT fails closed.

---

## Step 6 — Golden persistence test (CORE exit)

On **preview** only, thread id `TEST-<uuid>`:

1. Org A operator → Production Planner → stream.
2. Rows in `mastra.mastra_threads` + `mastra_messages` with `resourceId` Org A.
3. Browser refresh → history (split `dev:ui` / `dev:agent`).
4. Restart **agent** process → history.
5. Org B same `threadId` → denied (app check; do not rely on mastra RLS).

**Do not** use production threads (`dev-unauthenticated`).

---

## Step 7 — MVP ports (after gold)

Order:

1. `PlannerWorkingMemory` + `workingMemory` — prefer `scope: "resource"` until server-created threads exist; **retest** `thread` scope (old Planner). Do not enable OM.
2. Task tracking / structured output / GenUI (CopilotKit canvas **patterns only**).
3. HITL: workflow **or** tool interrupts on **current** APIs — **retest** `emitInterruptOutcome`; default **DELETE** old patches.
4. Shoot Wizard: port **steps**; rewrite wrapper; **static** `createWorkflow` (not dynamic). Tests: suspend schemas, resume `approved`, no commit without three gates.
5. `saveApprovedShootDraft` via RPC + JWT; idempotency key.
6. Brand Intelligence agent + workflow (same: business steps, new wrapper).
7. Creative Director (asset tools read-only first).
8. Remaining **read** tools, then **write** tools one domain at a time (CRM → talent → booking).

Workflow map (old, for rewrite):

```text
Shoot Wizard (code-registered, static .then().commit())
  input: brand_id, shoot_name, brief, channels (+ product_category on first step)
  → deliverable-gate suspend/resume
  → shot-list-gate (lookup refs + buildShotList; validate resume vs trusted reference ids)
  → budget-gate suspend/resume (recompute estimate; optional override)
  → output approved_* fields
  final writes: NOT in this workflow (comment claims commit; execute only returns numbers).
       Persist later via saveApprovedShootDraft RPC — do not add a silent fourth write step.
  Port: business steps + suspend schemas. Rewrite: createWorkflow vs 1.41 APIs.
  Keep static. Tests: three gates, reject empty refs, no DB on suspend.

Brand Intelligence
  input: brandId / URL
  → crawl (edge fn) → profile → enrichment (nests social-discovery + visual-identity)
  → HITL approve → promoteBrandDraft / discardBrandDraft
  Writes: adminClient() service role; direct brands.intake_status updates; IPI-817 dropped operator JWT in workflow
  Port: step names, HITL, idempotent draft_ready error, boundDetail truncation.
  Rebuild: no service role; JWT or RPC; no unbounded edge bodies in snapshots.
```

---

## Step 8 — Post-MVP (do not start now)

Schedules (new jobs, not 6078 prod triggers), background tasks, MCP, dynamic workflows, observational memory, durable stream cache, `mastraWorkflows` lazy bind, public marketing.

---

## Step 9 — Agents migration order

1. **Production Planner** (+ `default` alias) — CORE  
2. Creative Director — MVP  
3. Brand Intelligence — MVP  
4. Visual Identity — later  
5. Social Discovery — later  
6. Model Match — later  
7. CRM Assistant — later  
8. Booking — later  
9. Public marketing — **out** of operator app  

---

## Step 10 — Hacks: DELETE / RETEST / KEEP

| Hack | Class |
|------|--------|
| `emitInterruptOutcome` clone patches | DELETE; RETEST on HITL |
| `runtime-v2-fetch` / custom SSE | DELETE (use starter CopilotKit) |
| ALS operator / resource / requestToken | DELETE; RETEST request-scoped auth |
| Hyperdrive + Workers PG ALS | DELETE |
| Body tee/clone | DELETE |
| URL thread parsing | DELETE; RETEST CopilotKit thread ids |
| Retry wrappers on storage exporter | DELETE |
| Worker `WebSocketPair` / `MASTRA_STORAGE_MODE` | DELETE |
| LibSQL `:memory:` | DELETE after Postgres |
| `createDurableAgent` | DELETE until product needs reconnect |
| Lazy Memory Proxy | DELETE |
| `@ts-expect-error` Memory types | DELETE; fix types on current pkgs |
| `makeMemoryResourceId` | KEEP |
| HITL three-gate **policy** | KEEP |
| `SensitiveDataFilter` idea | DEFER KEEP |
| Starter `workingMemory.scope = "resource"` | KEEP until gold; then RETEST thread |

---

## Step 11 — File-by-file map (new destinations)

| Old file | New destination | Decision | Why | Changes | Tests |
|----------|-----------------|----------|-----|---------|-------|
| `agents/index.ts` Planner | `src/mastra/agents/production-planner.ts` | PORT + ADAPT | First agent | Strip CF model, durable, extra tools | registry, instructions contain 3 gates |
| `agents/index.ts` CD | `src/mastra/agents/creative-director.ts` | DEFER | After wizard | Restrict tools | later |
| `memory.ts` IDs + schema | `src/mastra/memory.ts` | PORT + ADAPT | Tenant key | No Proxy | fail-closed resourceId |
| `storage.ts` | `src/mastra/storage.ts` | REBUILD CLEAN | Drop Workers | PostgresStore only | preview connect |
| `index.ts` Mastra | `src/mastra/index.ts` | REBUILD CLEAN | Starter shape | No observability exporter | boot |
| `tools/index.ts` | `src/mastra/tools/index.ts` | REBUILD CLEAN | Tiny registry | Core tools only | names |
| `recommendShootType.ts` | `src/mastra/tools/recommendShootType.ts` | PORT AS-IS | Pure | Import paths | unit |
| `planDeliverables.ts` | same pattern | PORT AS-IS | Pure | — | unit |
| `generateShotListDraft.ts` + `lib/shoot/shot-list-from-references` | tools + `src/lib/shoot/` | PORT AS-IS | Proven | Copy lib only | old vitest port |
| `lookupShotReferences.ts` | tools | PORT + ADAPT | After JWT | No service role | org isolation |
| `saveApprovedShootDraft.ts` | tools | DEFER | Writes | RPC | idempotency |
| `workflows/shoot-wizard.ts` | `src/mastra/workflows/shoot-wizard.ts` | DEFER PORT + ADAPT | HITL | Current suspend API | suspend/resume |
| `durable.ts` | — | DROP | Node starter | — | — |
| Starter weather `agents/index.ts` | — | REMOVE DEMO | — | — | no weather in registry |
| Starter `tools/index.ts` weather | — | REMOVE DEMO | — | — | — |

---

## Step 12 — Tests required before each port

| Before | Tests |
|--------|--------|
| Any code copy | Installed API smoke (Agent, Memory, Store) |
| Planner register | IDs `default` + `production-planner`; no weather |
| Any tool | Zod schemas; execute fail-closed without JWT if it touches DB |
| Memory | resourceId format; no cross-org key |
| Postgres | preview persist one thread; **no** prod |
| HITL | suspend/resume on **current** workflow API; no interrupt patches unless fail |
| Writes | RPC + idempotency; no admin client |
| After each agent | no CRM/booking tools on Planner |

Old tests to **treat as specs** (rewrite, don’t run in iPixai until files exist): `generateShotListDraft.test.ts`, `memory.test.ts` ID cases, `agents/index.test.ts` tool exclusion, shoot-wizard workflow tests, brand-intelligence-workflow tests.

---

## Step 13 — Missing pieces in new starter

- Auth → `resourceId` (still `"default"`)
- `@mastra/pg` + preview `DATABASE_URL`
- Org membership check
- Production Planner
- Domain tools / libs
- Workflows
- Working memory schema
- HITL
- Observability exporter
- Domain RPCs wired from tools

---

## Step 14 — P0 / P1 blockers

**P0**

- `@mastra/pg` pin + constructor vs live/preview catalog (IPI-V2-005B)
- Preview project/schema (no prod writes)
- Replace hardcoded `resourceId: "default"`
- Do not port service-role `lookupShotReferences` or admin `saveApprovedShootDraft`
- DEV-STAB-001 split-dev only

**P1**

- Provider: Gemini vs OpenAI (old default Gemini; starter OpenAI)
- CopilotKit working-memory thread vs resource
- HITL interrupt behavior on `@ag-ui/mastra` 1.1.2
- Page context / `navigateTo` frontend tools
- Shared `lib/shoot` without dragging CF app

---

## Step 15 — Work sequence (execute in order)

**CORE**

1. Step 1 pin APIs  
2. Step 2 drop weather / keep Mastra+CopilotKit shape  
3. Step 3 Memory + PostgresStore + `makeMemoryResourceId`  
4. Step 4 Production Planner  
5. Step 5 compute tools (+ JWT lookup only if RLS proven)  
6. Step 6 golden persistence  

**MVP**

7. Working memory schema  
8. Structured output / task tracking  
9. HITL (retest interrupts; no old patches by default)  
10. Shoot Wizard rewrite  
11. Brand Intelligence  
12. Creative Director  
13. Write tools via RPCs  

**POST-MVP**

14–18. Schedules, background tasks, MCP, dynamic workflows, advanced memory  

---

## Step 16 — Report card

1. **Verdict:** Reuse Planner + shoot **compute** tools + tenant `resourceId`. Rebuild boot/storage/CopilotKit. Leave Worker runtime behind.
2. **Reusable Mastra %:** ~40% (business). ~15% if counting files copied verbatim — do not do that.
3. **Runtime to delete %:** ~80% of storage/route/durable/observability/CF.
4. **Matrix:** KEEP contracts; PORT AS-IS compute tools; PORT + ADAPT Planner/memory IDs; REBUILD index/storage/route; DEFER other agents/workflows/writes; DROP weather, durable, public-marketing, edge, Hyperdrive, interrupt patches.
5. **Agents order:** Planner → (MVP) CD → Brand → visual/social → model-match → CRM → booking. Public-marketing out.
6. **Tools order:** compute shoot → JWT lookup → HITL save RPC → brand reads → CRM reads → CRM writes → talent/booking/assets.
7. **Workflows:** none in Core; Shoot Wizard then Brand Intelligence; both static; no old interrupt hacks.
8. **Leave behind:** emitInterruptOutcome, runtime-v2-fetch, ALS, Hyperdrive, body tee, URL thread hacks, DurableAgent, storage mode switch, service-role lookup, admin shoot commit, brand workflow adminClient.
9. **Starter gaps:** auth resourceId, `@mastra/pg`, Planner, domain tools, workflows, HITL, RPC writes.
10. **P0:** pg pin, preview only, resourceId, no service-role tools, split-dev. **P1:** provider, WM scope, HITL on current AG-UI, page context, lib/shoot extract.
11. **File map:** Step 11 table.
12. **Core → MVP → Post-MVP:** Step 15.
13. **Tests:** Step 12. Ran 32 old unit tests (shot list, memory, agent index).
14. **Score:** 78/100.
15. **Confidence:** 72%.
16. **Move first:** Production Planner + four compute tools + Memory/PostgresStore + `makeMemoryResourceId`.

---

## Final answer

**Move first:** `/home/sk/ipix/app/src/mastra/agents/index.ts` **Production Planner** (instructions + restricted tool list) into `/home/sk/ipixai/src/mastra`, together with **compute-only** shoot tools (`recommendShootType`, `planDeliverables`, `generateShotListDraft`, `estimateShootBudget`) and **Memory + PostgresStore + `makeMemoryResourceId`**. Nothing else from the old Mastra directory until the golden persistence test is green on preview.
