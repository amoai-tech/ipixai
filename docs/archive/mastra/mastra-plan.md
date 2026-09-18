# Mastra plan for new iPix (Core → MVP → Advanced)

**Depends on:** [supabase-mastra.md](./supabase-mastra.md) (live 34 tables) · [copilotkit-plan.md](../../mastra/copilotkit-plan.md) (starter) · Wave 0 preview ([../data/supa-fix-plan.md](../data/supa-fix-plan.md) 0.10–0.11).

Like Production Planner on a new season: same vault layout (`mastra` schema), new studio (preview), one lead (Planner), then the rest of the crew.

**Do not** merge Worker shims, `InMemoryStore` as prod memory, or `__mastra_notification_dispatcher` into v2.

Installed types win: `@mastra/pg` `schemaName` + `disableInit` (this repo: `1.12.0`). Pin a **compatible set** on the starter; then IPI-V2-005B.

---

## Target architecture

```text
Next.js (Vercel Node)
  CopilotKit v2 route  ← Supabase Auth cookie
       ↓
  AG-UI MastraAgent.getLocalAgents({ resourceId })
       ↓
  Mastra (in-process)
       ↓
  Memory + PostgresStore
       schemaName: "mastra"   // installed @mastra/pg; some docs still say schema
       disableInit: true on prod; init only on preview if contract requires
       ↓
  Supabase Postgres (preview → later prod)
```

**AuthZ:** `org_members` → `resourceId = org:{orgId}::user:{userId}` (keep existing double-colon). Storage RLS does **not** isolate orgs.

**Tools that mutate shoots/planner:** existing **SECURITY DEFINER RPCs** with user JWT — not Mastra writing `shoot.*` as postgres.

---

## CORE

**Purpose:** One Production Planner chat that survives refresh/restart and cannot be read by Org B.

**Real example:** Operator plans SS26 lookbook. Thread `TEST-<uuid>`. Refresh browser → same shot list talk. Restart Node → still there. Org B → denied.

**Tables:** `mastra_threads`, `mastra_messages`, `mastra_resources` (may stay empty until working memory), `mastra_workflow_snapshot` only if a Core workflow suspends (prefer **no** Studio dispatcher). Optional `mastra_ai_spans` (few rows).

**Dependencies:** CopilotKit starter + OpenAI + Supabase Auth + preview seed Org A/B + PostgresStore.

**Tests:** Gold TEST-\<uuid\> persist / SQL / refresh / restart / Org B 403. Anon no EXECUTE on domain RPCs (Wave 0.1).

**Success:** Preview gold green. Prod `mastra` untouched.

---

## MVP

**Purpose:** Planner feels like a producer, not a chatbot: structured state, GenUI, HITL, second agents, evals.

**Examples:**

- Working memory: brand, shoot type, budget on the thread (`mastra_resources`).
- GenUI: shot-list card from `canvas/mastra-pm` **patterns only**.
- HITL: approve planner gate → `planner_approve_gate` RPC.
- Shoot Wizard / Brand Intelligence / Creative Director as **code-registered** agents (not `mastra_agents` rows).
- Datasets/scorers: score “did Planner stay on-brand?”

**Tables:** Core + `mastra_resources` writes; later `mastra_datasets*`, `mastra_experiments*`, `mastra_scorers*`. Staging spans OK.

**Dependencies:** Core gold test. Domain RPCs already live.

**Tests:** Working memory round-trip; HITL RPC; one eval fixture on preview.

**Success:** Operator can run a shoot wizard + planner without losing state; Org isolation holds.

---

## POST-MVP

**Purpose:** Ops around the crew: reminders, shared shoot thread, prompt pins, MCP.

**Examples:** Schedule call-sheet reminder (`mastra_schedules` — **new** jobs, not 6078 prod triggers). Shared shoot: `org:{org}:shoot:{id}` resourceId (app-enforced). MCP Cloudinary/Linear. Agent/prompt versions in Studio tables if we adopt Studio.

**Tables:** schedules, background_tasks, agents/versions, prompts, skills, MCP, workspaces, favorites.

**Dependencies:** MVP. Prune/ignore prod dispatcher data.

**Tests:** One schedule on preview; MCP tool scoped to org.

**Success:** Reminders and tools without touching prod snapshot pile.

---

## ADVANCED

**Purpose:** Cross-thread brand memory, WhatsApp, multi-agent, coworker UX.

**Examples:** Observational memory (“this label never shoots glossy”). Channels. OpenBot-style coworker. A2A only if a proven vendor need.

**Tables:** `mastra_observational_memory`, `mastra_channel_*`.

**Keep disabled in Core/MVP.**

---

## Feature → table map

| Feature | Tables | Phase |
|---------|--------|-------|
| Restore Planner chat | threads, messages | Core |
| Org isolation key | threads.resourceId | Core |
| Working memory | resources | MVP |
| Workflow resume | workflow_snapshot | Core if used |
| Studio graphs | workflow_definitions | Post-MVP |
| Tracing | ai_spans | Core light / MVP staging |
| Evals | datasets, experiments, scorers | MVP |
| Reminders | schedules, schedule_triggers | Post-MVP |
| OM | observational_memory | Advanced |
| WhatsApp | channel_* | Advanced |

---

## Task sequence (Mastra-only)

1. After Wave 0.11 seed: boot starter with PostgresStore → preview.
2. IPI-V2-005B: diff installed store vs preview catalog.
3. Planner agent + Memory lastMessages.
4. Gold TEST-\<uuid\>.
5. Working memory schema (port `PlannerWorkingMemory`).
6. Extra agents + HITL RPCs.
7. Evals tables when we score Planner.
8. Never enable OM/channels until Advanced ticket.

---

## Golden test

```text
Org A operator → Production Planner → TEST-<uuid>
  stream → row in mastra.mastra_threads + mastra_messages
  refresh → history
  restart server → history
Org B → same threadId → DENIED
```

Do **not** use production threads (`dev-unauthenticated`).

---

## Reuse vs migrate

| Asset | Action |
|-------|--------|
| 34-table `mastra` schema | **Reuse design** on preview; prod later after gold |
| Prod rows | **Do not copy** |
| `makeMemoryResourceId` | **PORT** |
| Worker noop storage | **REMOVE** |
| Notification dispatcher snapshots | **Do not port** |

---

## Production-ready checklist

- [ ] Preview-only writes until gold
- [ ] `disableInit: true` on prod
- [ ] Compatible package pin
- [ ] resourceId fail-closed
- [ ] Tools → RLS RPCs
- [ ] Empty platform tables retained (DEFER, not DROP)

**Plan grade:** **88/100** if preview-first. **Confidence:** **80%** until 005B + gold test.
