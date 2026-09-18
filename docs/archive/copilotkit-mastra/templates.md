# iPix V2 — Reference architecture and template reuse

Think of this like a **parts catalog for a kitchen remodel**. The cabinets (operator pages) already exist in the old house. The new house already has plumbing for the stove (CopilotKit + Mastra). You do not order a new kitchen from a chatbot demo. You move the cabinets, then plug the stove into the existing hood.

**Product rule:** dashboard pages stay **iPix-first**. CopilotKit/Mastra power the **Intelligence Rail** (and later Launch/Wizard), not Brand Hub, CRM, or Analytics.

**Milestones:** M1 Foundation · M2 Product · M3 Launch · M4 Expansion. **IPI-1041 · CORE-001** is the Foundation certification exam (stable ID). Not Core → MVP → Post-MVP → Advanced.

| Authority | What it owns |
| --- | --- |
| Live Linear project [v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2) | Status, blockers, titles |
| This repo `package.json` / `node_modules` | API names and versions |
| `/home/sk/ipix` (lumina-studio) | Proven operator React |
| Official GitHub examples | Patterns only — installed types win |

**Stop searching** at the first compatible proven implementation. Ask on every task: *is there a faster path by adapting proven code?*

---

## Installed pins (this worktree, 2026-08-29)

| Package | Version | Role |
| --- | --- | --- |
| `@copilotkit/react-core` / `@copilotkit/runtime` | **1.68.1** | CopilotKit v2 runtime + React |
| `@ag-ui/mastra` | **1.1.2** | AG-UI adapter (`MastraAgent.getLocalAgents`) |
| `@mastra/core` | **1.41.0** | Agents, tools, workflows |
| `@mastra/memory` | **1.26.1** | Working / conversation memory |
| `@mastra/pg` | **1.12.1** | `PostgresStore` — **not** local pack 1.13.0 |
| Next.js | **16.1.2** | Operator UI |

`docs/mastra/10-mastra-convert.md` still says “no `@mastra/pg`” in places — **that sentence is stale**. Trust `package.json` and `src/mastra/pg-store.ts`.

**Local clones (gitignored):** `/home/sk/ipixai/github/copilotkit` (full CopilotKit tree), `/home/sk/ipixai/github/mastra/clones`. Companion notes: `github/mastra/copilot-mastra-repos.md`.

---

## Reuse ladder (every task)

```text
1. Existing /home/sk/ipixai (origin/main, not a stale checkout)
2. Proven /home/sk/ipix / lumina-studio React + tests
3. Installed package source + types
4. Official CopilotKit example (one primary) — **pattern**, not a second app
5. Official Mastra template/example — **pattern**; verify against installed 1.41 / Memory 1.26.1 / pg 1.12.1
6. Official Supabase SSR / RLS docs
7. Community starter patterns only (never their versions/migrations)
8. Custom code only for iPix business logic
```

### Classification key

| Label | Meaning |
| --- | --- |
| **COPY** | Paste the working file; swap domain names |
| **COPY+CLEAN** | Port lumina React; drop CF/Worker/`?skip=`/service-role |
| **ADAPT** | Keep example control flow; swap schemas/prompts/auth |
| **CUSTOM DOMAIN** | Only iPix rules (org membership, shoot RPCs, Cloudinary signing) |
| **REFERENCE ONLY** | Read APIs/UX; do not copy chrome or `package.json` |
| **DO NOT USE** | Wrong family, v1 runtime, or rebuilds a proven page |

---

## 1. Architecture

```text
Browser (Next.js App Router)
  Operator pages     = lumina COPY+CLEAN
  Intelligence Rail  = CopilotKit headless UI (useAgent)
        ↓ HTTPS /api/copilotkit
CopilotKit runtime (Node, this process)
  → AG-UI (@ag-ui/mastra)
  → Mastra agents / tools / workflows / Memory
        ↓
Supabase Auth (cookies, JWT)
  + Postgres (domain tables + RLS)
  + mastra schema (threads) via PostgresStore
  + pgvector later (RAG) — not dashboard pages
```

**Frontend:** Next.js routes under `/app/*`, OperatorPanel, rail chat. No Mastra in the browser except CopilotKit hooks.

**Backend:** `src/app/api/copilotkit/[[...slug]]/route.ts` + `src/agent.ts` + `src/mastra/*`. Mastra must **not** connect as `postgres` to `shoot.*`. **Never treat `resourceId` as the only authorization check** — it is a Memory partition key. Membership and thread ownership live in **IPI-1046 · AUTH-002** and **IPI-1047 · ACCESS-001** (Mastra schema RLS is `USING true` for the runtime role).

**Domain writes:** default to **RLS-protected** table access or **`SECURITY INVOKER`** functions (caller's JWT). Use **`SECURITY DEFINER` only as a narrow exception** (e.g. a justified save-once path in **IPI-1083 · SHOOT-SAVE-001**): explicit auth/org checks, hardened `search_path`, restricted `EXECUTE`, tests. Supabase warns DEFINER bypasses RLS if you skip those controls.

**Postgres in production / CORE proof:** `src/mastra/index.ts` still uses **LibSQL `:memory:` when `MASTRA_DATABASE_URL` is unset**. Deployments and CORE-001 must **assert PostgresStore is active**. Do not silently treat a LibSQL boot as durable memory. CORE-001 env: **local first, then approved hosted synthetic namespace; never the live production corpus.**

**Today’s gap (starter leftovers — must not ship):**

- `src/agent.ts` still passes `resourceId: "default"`.
- CopilotKit route still has `identifyUser: () => ({ id: "demo-user" })` when Intelligence is on.

Those are **IPI-1037 · AUTH-001** / **IPI-1045 · STREAM-001** / **IPI-1047 · ACCESS-001**, not dashboard tickets.

```text
DESIGN-001 ─────────────┐
                         ├→ APP-001 → HOME / BRAND / SHOOT
AUTH-001 ───────────────┘
MARKETING-NAV ─┐
AUTH-001 ──────┴→ LOGIN (MARKETING-LOGIN-001) → ONBOARD
AUTH-001 ───────────────→ AUTH-002
AUTH-002 → STREAM → ACCESS → PLANNER
                         ├→ TOOL
                         └→ MEM
PG-001 → REPLAY
APP + MEM + REPLAY → UI-001 → CORE-001
```

**APP-001 does not wait for LOGIN/ONBOARD.** Live Linear: APP blocked only by **AUTH-001 + DESIGN-001**.

---

## 2. User journey (customer path vs build order)

Customer journey is **not** the same as implementation order. Implementation is in [§8](#8-fastest-implementation-plan).

### First-user (product) vs Planner (fail closed)

```text
Signed out → Login (MARKETING-LOGIN-001)
→ AUTH-001 verified session (getClaims / SSR cookies — not getSession() for authz)
→ membership in org_members?
  Yes → AUTH-002 → /app
  No  → ONBOARD-001 (create org + owner membership + first brand) → AUTH-002 → /app
```

```text
Zero-org user calls Planner / CopilotKit directly
→ 403 until membership exists
```

Product bootstrap must still reach ONBOARD. **Do not** change AUTH-002 so Planner is open without an org.

### Task owners (do not conflate)

| Journey | Owner |
| --- | --- |
| Marketing shared chrome | **IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout** |
| Marketing homepage | **IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App** |
| Login UX | **IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup** |
| Runtime authentication (CopilotKit `onRequest`, no `demo-user`) | **IPI-1037 · AUTH-001 — Let Real iPix Users Sign In Before Using the AI Planner** |
| First org + brand | **IPI-1089 · ONBOARD-001** |
| Tenant resolver | **IPI-1046 · AUTH-002** |
| Tokens / visual system | **IPI-1080 · DESIGN-001** (not marketing chrome) |
| Operator shell | **IPI-1065 · APP-001** |

| Step | Screen | Linear | Existing iPix | CopilotKit / Mastra | Backend | Supabase | AI | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Marketing chrome | Header/footer/layout | **IPI-1053 · MARKETING-NAV-001** | lumina marketing layout | **NONE** | Next RSC | none | none | layout tests |
| Marketing home | Public homepage | **IPI-1057 · MARKETING-HOME-001** | lumina marketing home | **NONE** | Next RSC | none | none | visual |
| Tokens | Design tokens | **IPI-1080 · DESIGN-001** | lumina tokens | shadcn **primitives only** | — | none | none | `test:design` |
| Login UX | Login page | **IPI-1058 · MARKETING-LOGIN-001** | lumina login | **NONE** for chrome | uses AUTH-001 session | Auth cookies | none | login journey |
| Runtime auth | CopilotKit gate | **IPI-1037 · AUTH-001** | `@supabase/ssr` + `getClaims()` | Showcase `onRequest` | 401 before agent | cookies/JWT | none until 200 | signed-out 401; zero writes on reject |
| Onboarding | First org / brand | **IPI-1089 · ONBOARD-001** | lumina onboarding | **NONE** | RLS / INVOKER (DEFINER only if justified) | `organizations`, `org_members` | none | bootstrap → ONBOARD; **Planner still 403** until membership |
| `/app` shell | OperatorPanel | **IPI-1065 · APP-001** | `operator-panel.tsx`, `nav-sidebar.tsx`, `(operator)/layout.tsx` | **PRIMARY:** [showcase/integrations/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/showcase/integrations/mastra) headless only | existing CopilotKit route | session + membership | rail only | `nav-sidebar`, layout, signed-out redirect |
| Home | Command Center | **IPI-1066 · HOME-001** | `command-center/*`, `lib/command-center/queries.ts` | **NONE** | RLS reads | brands, recent work | none | command-center tests; no `?skip=` |
| Brand | Brand list/detail | **IPI-1068 · BRAND-001** | `brand-list-workspace`, `brand-detail-workspace` | **NONE** | RLS | `brands` | later context only | brand-hub tests |
| Shoot browse | Shoot list/detail | **IPI-1067 · SHOOT-001** | `shoots-list-workspace`, `ShootCard`, `shoot-detail-workspace` | **NONE** (no canvas/HITL) | RLS | `shoot.shoots`, portfolio views | none | shoot list/detail tests |
| Intelligence Rail | Rail chat | **IPI-1065 · APP-001** + **IPI-1051 · UI-001** | lumina intelligence-panel chrome | showcase headless `useAgent`; [examples/shadcn](https://github.com/CopilotKit/CopilotKit/tree/main/examples/shadcn) primitives inherit iPix tokens | `/api/copilotkit` | `mastra_threads` via Memory | Production Planner | rail + authz |
| Generate ShootPlan | Planner output | **IPI-1081 · PLAN-001** | iPix Planner prompts + compute tools | integrations/mastra agent register; canvas **zod only** | tools compute-only until SAVE | none until save | structured plan | fixture ShootPlan |
| Review / HITL | Approval cards | **IPI-1084 · APPROVAL-001** | iPix approval-card | showcase `useHumanInTheLoop`; [generative-ui-playground](https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/generative-ui-playground) | interrupt tools | none until approve | HITL | HITL respond() tests |
| Save shoot | Persist once | **IPI-1083 · SHOOT-SAVE-001** | save RPC contracts | **NONE** as UI template | RLS/INVOKER first; **DEFINER only if justified** | `shoot.shoots` | none after approve | save-once; Org B denied |
| Wizard | Create shoot | **IPI-1085 · SHOOT-WIZARD-001** | wizard **step logic** | canvas/mastra UX/zod **pattern only** — **not** v1 `useCoAgent` | **installed** workflow APIs (verify 1.41 types) | same as save | staged HITL | wizard tests |
| Assets | Gallery / preview | **IPI-1069 · ASSETS-001** | `AssetsWorkspace`, `AssetDetailWorkspace`, `ChannelPreviewStudio` | **NONE** | signed upload APIs | assets + `image_specs` | none | assets tests; no Worker secrets |
| Operations | Inbox / campaigns | **IPI-1072 · OPERATIONS-001** | Inbox + Campaigns workspaces | **NONE now** ([mastra-triage](https://github.com/mastra-ai/mastra-triage) later) | `list_notifications` RPC | notifications, `campaigns` | none | inbox/campaign tests |
| Analytics | Analytics | **IPI-1073 · ANALYTICS-001** | analytics workspaces | **NONE** (no text-to-SQL) | real queries only | honest nulls | **no fake AI KPIs** | analytics tests |
| Plans workspace | `/app/plans` | **IPI-1074 · PLANS-001** | lumina `/app/planner` kanban/list | **NONE** — not AI Planner | existing planner instance queries | planner instances | none | planner UI tests |

**PLANS-001 ≠ PLANNER-001.** One is a Gantt/kanban workspace. The other is the AI Production Planner in the rail.

---

## 3. Screen-by-screen template map

| iPix screen / feature | Linear | Existing iPix code | Primary GitHub template | Exact feature to adapt | Frontend | Backend | AI | Custom needed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Marketing chrome | **IPI-1053 · MARKETING-NAV-001** | lumina header/footer/layout | **NONE** | — | COPY+CLEAN | — | none | none |
| Marketing homepage | **IPI-1057 · MARKETING-HOME-001** | lumina marketing home | **NONE** | — | COPY+CLEAN | — | none | none |
| Login UX | **IPI-1058 · MARKETING-LOGIN-001** | lumina login page | **NONE** for chrome | — | COPY+CLEAN | AUTH-001 session | none | none |
| Runtime Copilot auth | **IPI-1037 · AUTH-001** | `@supabase/ssr` | showcase `onRequest` | `getClaims()`, no `demo-user` | ADAPT | fail-closed | none | 401 |
| Onboarding | **IPI-1089 · ONBOARD-001** | lumina first-org / first-brand | **NONE** | — | COPY+CLEAN | RLS/INVOKER | none | Planner **403** until membership |
| Operator shell | APP-001 | `operator-panel`, `nav-sidebar`, `operator-shell.module.css` | [showcase/integrations/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/showcase/integrations/mastra) | headless demos, **not** CopilotSidebar | COPY+CLEAN + ADAPT rail | existing route | rail | layout + rail slot |
| Command Center | HOME-001 | `components/command-center/*` | **NONE** | — | COPY+CLEAN | queries.ts | none | drop `?skip=` |
| Brand list/detail | BRAND-001 | `brand-hub/*` | **NONE** | — | COPY+CLEAN | RLS | none | none |
| Shoot list/detail | SHOOT-001 | `components/shoot/*` list/detail | **NONE** | — | COPY+CLEAN | `shoot.*` | none | none |
| Intelligence Rail | APP-001, UI-001 | intelligence-panel (lumina) | **showcase/integrations/mastra** | `useAgent`, tool render, HITL later | ADAPT | STREAM-001 | Planner | resourceId **plus** membership/thread checks |
| Production Planner agent | PLANNER-001 | iPix `production-planner` prompts | [examples/integrations/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/examples/integrations/mastra) | agent register slot (already in ipixai) | — | ADAPT prompts | yes | prompts/tools |
| Structured ShootPlan | PLAN-001 | iPix plan types | canvas/mastra **zod**; v2 `useAgent.setState` | Zod plan shape | ADAPT | TOOL-001 | yes | fashion fields |
| Approval / HITL | APPROVAL-001 | approval-card | showcase HITL + generative-ui-playground | `useHumanInTheLoop` | ADAPT | interrupt tool | yes | iPix card chrome |
| Shoot Wizard | SHOOT-WIZARD-001 | wizard **steps** | canvas/mastra UX | cards/plans — **DO NOT** copy v1 route | ADAPT | workflows 1.41 | yes | HITL mapping |
| Assets | ASSETS-001 | assets + channel preview | **NONE** | — | COPY+CLEAN | signing | none | Cloudinary signing |
| CRM | CRM-001 | `components/crm/*` | **NONE** | — | COPY+CLEAN | CRM RPCs | later separate ticket | drop fake scores |
| Talent / booking | TALENT-BOOKING-001 | matching + booking | **NONE** | — | COPY+CLEAN | booking RPCs | none now | URL rebuild `/app/matching/talent/[id]` |
| Inbox / campaigns | OPERATIONS-001 | inbox + campaigns | **NONE** now | — | COPY+CLEAN | RPCs | none | drop CF unread hacks |
| Analytics | ANALYTICS-001 | analytics workspaces | **NONE** | — | COPY+CLEAN | real counts | **forbid fake KPIs** | honest empty |
| Plans workspace | PLANS-001 | `app/planner/*` → `/app/plans` | **NONE** | — | COPY+CLEAN | instances | none | rename routes |
| Auth on Copilot requests | AUTH-001 | — | showcase `hooks.onRequest` | session before agents | — | ADAPT | — | fail-closed |
| Org isolation | AUTH-002, ACCESS-001 | `org_members` | TheDistance **idea** only | `mapUserToResourceId` idea | — | CUSTOM DOMAIN | — | Org B 403 |
| Postgres persist | PG-001 (Done), MEM-001 | `src/mastra/pg-store.ts` | installed `@mastra/pg@1.12.1` | store + Memory | — | COPY types | yes | local / hosted **synthetic**; assert URL set in prod |
| Thread replay | COPILOT-REPLAY-001 | — | [examples/v2/react](https://github.com/CopilotKit/CopilotKit/tree/main/examples/v2/react) | thread restore via `useAgent` | ADAPT | Memory | yes | same threadId |
| Planner context | PLANNER-CONTEXT-001 | page context IDs | [canvas/mastra-pm](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra-pm) `state.ts` | Zod shared state | ADAPT | Memory | yes | brand/shoot IDs |
| Evals | PLANNER-QUALITY-001 | ShootPlan fixtures | [template-agent-harness](https://github.com/mastra-ai/template-agent-harness) **later** | eval/dataset **if** in node_modules | REFERENCE | QUALITY-001 | yes | iPix fixtures first |
| Observability | PLANNER-TRACE-001 | — | installed logger; [mastra-ai/mastra](https://github.com/mastra-ai/mastra) docs | do not add extra obs packages until depended | — | TRACE-001 | — | spans on this pin |
| Browser agent | later | — | [template-browser-agent](https://github.com/mastra-ai/template-browser-agent) | Playwright tools | REFERENCE | later | yes | gated crawl |
| MCP | later | — | showcase MCP / open-mcp-client | MCP UX | REFERENCE | later | yes | Cloudinary/Linear |
| Observational memory | M4 / later | — | [mastra-observational-memory-workshop](https://github.com/mastra-ai/mastra-observational-memory-workshop) | workshop only | DO NOT USE in Foundation exam | — | later | — |
| AG-UI protocol | STREAM-001 | `@ag-ui/mastra` | [ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui) | event shapes | REFERENCE | already wired | yes | none |
| UI dojo | debug rail | — | [mastra-ai/ui-dojo](https://github.com/mastra-ai/ui-dojo) | CopilotKit cell only | REFERENCE ONLY | — | — | don’t adopt second chat UI |
| Deep search | later | — | [template-deep-search](https://github.com/mastra-ai/template-deep-search) | research agent | DO NOT USE in 1076 | later | later | — |

---

## 4. CopilotKit / Mastra feature map

| Feature | Classification | Primary | Fallback | Notes |
| --- | --- | --- | --- | --- |
| Auth / `onRequest` | ADAPT | showcase/integrations/mastra CopilotKit auth route | [mastra-auth-examples](https://github.com/mastra-ai/mastra-auth-examples) `examples/supabase` | Paste into existing `createCopilotEndpoint` |
| `useAgent` | ADAPT | showcase headless demos; [examples/v2/react](https://github.com/CopilotKit/CopilotKit/tree/main/examples/v2/react) | installed `@copilotkit/react-core` | Verify 1.68.1 types |
| Headless UI | ADAPT | showcase `demos/headless-simple` | examples/shadcn `simple-chat` | Drop demo chrome |
| Frontend tools | ADAPT | showcase frontend tools | — | Render in rail, not new pages |
| Tool rendering | ADAPT | showcase custom tool UI | generative-ui-playground | iPix cards |
| HITL | ADAPT | showcase `useHumanInTheLoop` | generative-ui-playground TaskApprovalCard **pattern** | iPix approval-card chrome |
| Generative UI | ADAPT | generative-ui-playground Static GenUI | — | Not a new dashboard |
| Shared state | ADAPT | showcase `shared-state-read-write` | mastra-pm `state.ts` **schema only** | v2 `useAgent.setState`, **not** `useCoAgent` |
| Structured Zod state | ADAPT | canvas/mastra + mastra-pm zod | installed zod | Fashion fields |
| Multi-step plans | ADAPT | canvas/mastra plan tools | iPix wizard steps | Launch epic |
| Memory | ADAPT | installed `@mastra/memory@1.26.1` + `@mastra/pg@1.12.1` + PG-001 | TheDistance Vitest **pattern only** | Never pin 1.13.0 unless lockfile upgrades |
| Thread replay | ADAPT | v2/react thread restore | installed thread APIs | No localStorage history |
| Postgres persistence | COPY types | `src/mastra/pg-store.ts` + `@mastra/pg@1.12.1` | Mastra PG source in node_modules | `disableInit` on non-disposable DBs; **fail if URL unset in prod** |
| Resource / tenant | CUSTOM DOMAIN | ADR 003 + `org_members` | TheDistance **idea** only | `resourceId` scopes Memory; **AUTH-002 + ACCESS-001** own authorization |
| Workflows | ADAPT | **installed** `createWorkflow` types | canvas/mastra **pattern only** | Wizard in 1079 — do not assume canvas APIs match 1.41 |
| Evals | REFERENCE / later | installed evals **if present** | harness | QUALITY-001 |
| Observability | REFERENCE | installed tracing | mastra docs | TRACE-001; CORE blocks this today |
| Browser agent | REFERENCE / later | template-browser-agent | — | Not 1076 |
| MCP | REFERENCE / later | showcase MCP | open-mcp-client | After Foundation exam |
| Long-term / observational memory | DO NOT USE (Foundation) | observational-memory-workshop | — | M4 later |
| Skills docs | REFERENCE | [mastra-ai/skills](https://github.com/mastra-ai/skills) already in `.claude/skills/mastra` | — | Before cloning more starters |
| AG-UI Dojo | REFERENCE | [mastra-agui-dojo](https://github.com/mastra-ai/mastra-agui-dojo) | ui-dojo | Debug only |

**Already the runtime (do not copy again into dashboard pages):** [examples/integrations/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/examples/integrations/mastra).

---

## 5. Backend / Supabase map

| Concern | Pattern | Classification | Authority |
| --- | --- | --- | --- |
| Supabase SSR Auth | `@supabase/ssr` cookie trio (server, client, middleware) | ADAPT from lumina + mastra-auth-examples | Official Supabase SSR docs + lumina `lib/supabase/*` |
| organizations / org_members | Server `auth.uid()` → membership | COPY+CLEAN | `docs/data/08-auth-org.md`, ADR 003 |
| Server-derived tenant | `resourceId = org:{orgId}::user:{userId}` is **scope**, not a complete ACL | CUSTOM DOMAIN | Plus membership + thread ownership tests |
| RLS | Domain tables: keep policies. **mastra schema RLS does not isolate orgs** | CUSTOM DOMAIN | `docs/data/07-mastra-storage.md` — runtime role `USING true` |
| PostgresStore | `src/mastra/pg-store.ts`, local host allowlist | ADAPT | installed `PostgresStore` types |
| Mastra Memory | Memory + store on agent | ADAPT | `@mastra/memory@1.26.1` |
| Thread ownership | Server threadId + resourceId; Org B + Org A `?thread=` → 403 | CUSTOM DOMAIN | ACCESS-001 |
| pgvector | Later RAG | REFERENCE | TheDistance starter **pattern only** — never copy their migrations |
| Domain writes | RLS or SECURITY INVOKER default | CUSTOM DOMAIN | DEFINER only for justified SHOOT-SAVE-001 (hardened) |
| Save-once (exception) | Hardened RPC **if** INVOKER cannot meet the contract | CUSTOM DOMAIN | SHOOT-SAVE-001 |
| Signed uploads | Cloudinary signing on server | CUSTOM DOMAIN | ASSETS-001 — not Mastra |
| No service-role in browser | Fail closed | DO NOT USE service-role client in RSC/browser | ADR + PRD |

**Community:** [thedistance/mastra-supabase-starter](https://github.com/thedistance/mastra-supabase-starter) — **REFERENCE ONLY** (Auth + Memory + Vitest 401). Different Mastra versions; **do not** copy `package.json` or migrations.

---

## 6. Do-not-copy list

| Reject | Why |
| --- | --- |
| Custom SSE / old Copilot fetch shims | Starter already streams via official handler |
| Cloudflare Workers / OpenNext runtime | Node-first (ADR 001); DEV-STAB-001 |
| Hyperdrive | Old iPix DB path |
| DurableAgent / ALS | Not required until a current failure proves it |
| `resourceId: "default"` | Cross-tenant thread mixing — still in `src/agent.ts` |
| `demo-user` / `identifyUser` stub | Still in CopilotKit route |
| Service-role browser clients | Tenant leak |
| Mastra 0.x SaaS starters | Wrong generation |
| canvas **v1** `useCoAgent` as product runtime | Use v2 `useAgent` on 1.68.1 |
| Community package versions / migrations | TheDistance 1.54 / PG 1.18 ≠ our 1.41 / 1.12.1 |
| CopilotSidebar / CopilotPopup / weather demo as `/app` shell | Rebuilds proven iPix chrome |
| `shadcn init` / CopilotKit theme as operator SSOT | DESIGN-001: iPix tokens first |
| Combined `npm run dev` | Fork storm |
| Live production Mastra/thread corpus | CORE: local first, then **approved hosted synthetic**; never live corpus |
| Broad SECURITY DEFINER as the default write path | Bypass RLS — INVOKER/RLS first |
| localStorage transcript / client-only replay cache | REPLAY-001 must reload the PG/MEM thread |
| AI-invented analytics KPIs | ANALYTICS-001 |
| Merging PLANS-001 with PLANNER-001 | Different products |
| canvas/mastra or mastra-pm inside IPI-1076 page ports | Launch / Planner epics only |

---

## 7. Epics (live Linear)

| Epic | What it is | Templates |
| --- | --- | --- |
| **[IPI-1076 · DASHBOARD DESIGN](https://linear.app/amo100/issue/IPI-1076)** | Operator pages | lumina; showcase **only** for rail in APP-001; shadcn **reference** in DESIGN-001 |
| **[IPI-1078 · MASTRA COPILOTKIT](https://linear.app/amo100/issue/IPI-1078)** | Secure Planner runtime | integrations/mastra (already in app), showcase auth, installed PG/Memory, v2/react |
| **[IPI-1079 · LAUNCH](https://linear.app/amo100/issue/IPI-1079)** | Shoot plan → HITL → save → wizard | canvas/mastra, mastra-pm **schema**, HITL showcase |

Done on 1078 (do not reopen tickets): **IPI-1042 · RUNTIME-001**, **IPI-1043 · DB-001**, **IPI-1044 · PG-001**. Code still **warns and uses LibSQL `:memory:` if `MASTRA_DATABASE_URL` is unset** (`src/mastra/index.ts`). Treat that as a **deployment assertion** for MEM/REPLAY/CORE — not as “PG-001 unfinished.”

---

## 8. Fastest implementation plan

**Build order (live Linear), not the customer walk.** APP does **not** wait on onboarding.

```text
DESIGN-001 ─────────────┐
                         ├→ APP-001 → HOME / BRAND / SHOOT
AUTH-001 ───────────────┘
MARKETING-NAV-001 ─┐
AUTH-001 ──────────┴→ MARKETING-LOGIN-001 → ONBOARD-001
AUTH-001 ───────────────→ AUTH-002
AUTH-002 → STREAM-001 → ACCESS-001 → PLANNER-001
                           ├→ TOOL-001
                           └→ MEM-001
PG-001 → COPILOT-REPLAY-001
APP-001 + MEM-001 + REPLAY → UI-001 → CORE-001
→ PLAN-001 → APPROVAL-001 → SHOOT-SAVE-001 → SHOOT-WIZARD-001
→ CONTEXT → QUALITY → TRACE → RELEASE
```

Parallel start: **DESIGN-001 ∥ AUTH-001 ∥ MARKETING-NAV-001**.

ASSETS / CRM / TALENT / OPERATIONS / ANALYTICS wait on **APP-001** only. **PLANS-001** is later M4 UI, not the AI Planner.

---

## 9. Scorecard and close-out

### Top 10 templates / repos to actively use

1. lumina-studio / `/home/sk/ipix` operator React  
2. This repo (`src/mastra/pg-store.ts`, CopilotKit route, `src/agent.ts`)  
3. CopilotKit [examples/integrations/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/examples/integrations/mastra) — **already the app**  
4. CopilotKit [showcase/integrations/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/showcase/integrations/mastra) — **AUTH + rail + HITL**  
5. Installed `@mastra/pg@1.12.1` + `@mastra/memory@1.26.1`  
6. CopilotKit [examples/shadcn](https://github.com/CopilotKit/CopilotKit/tree/main/examples/shadcn) — **primitives only**  
7. CopilotKit [examples/v2/react](https://github.com/CopilotKit/CopilotKit/tree/main/examples/v2/react) — hook/thread check  
8. [mastra-ai/mastra-auth-examples](https://github.com/mastra-ai/mastra-auth-examples) — cookie SSR  
9. CopilotKit [examples/canvas/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra) — **Launch only**, zod/UX  
10. CopilotKit [examples/canvas/mastra-pm](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra-pm) — **Planner context schema only**

Honorable: [ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui), [mastra-ai/skills](https://github.com/mastra-ai/skills), TheDistance tests **pattern**, ui-dojo **debug**.

### Task → template (short)

| Spec | Template |
| --- | --- |
| DESIGN-001 | lumina tokens; shadcn **reference** |
| MARKETING-NAV / HOME / LOGIN | lumina **only** (1053 / 1057 / 1058) |
| AUTH-001 | showcase `onRequest` + auth-examples SSR |
| APP-001 | lumina OperatorPanel + showcase headless |
| HOME/BRAND/SHOOT/ASSETS/CRM/TALENT/OPS/ANALYTICS/PLANS | lumina **only** |
| STREAM / PLANNER | keep integrations/mastra |
| MEM / PG | installed pg + Memory |
| REPLAY | v2/react |
| UI-001 | showcase headless + iPix rail |
| PLAN / WIZARD / APPROVAL | canvas zod + HITL showcase + iPix cards |
| CORE / TRACE / RELEASE | proof + deploy; no new UI kit |

### Custom code that cannot be avoided

- Org membership → `resourceId`  
- Fashion shoot compute tools + justified save RPC (INVOKER first)  
- Cloudinary signing  
- Honest analytics empty states  
- iPix visual tokens (DESIGN-001)

### Unnecessary custom work to drop

- Rebuilding dashboard pages from CopilotKit demos  
- Second CopilotKit Next app  
- Custom SSE  
- Worker/Hyperdrive/DurableAgent copies  
- `shadcn init` as a new design system  
- Generic Mastra matching agent inside TALENT-001  
- text-to-SQL for ANALYTICS-001  

### Fastest development sequence

See [§8](#8-fastest-implementation-plan). **APP after AUTH+DESIGN**, in parallel with LOGIN/ONBOARD.

### Repo / template reuse score

**97 / 100** after APP-ordering, zero-org Planner 403, RLS/INVOKER-first writes, marketing vs AUTH ownership, and Postgres deploy assertion (architecture was already ~98). Historical `docs/07-repo-to-task-map.md` proposed IPI-1028 IDs are **not** live Linear.

### Estimated efficiency

Versus writing a new CopilotKit dashboard: **~40–60% less UI work** (COPY+CLEAN lumina). Versus inventing Copilot transport: **~70% less** (starter + showcase hooks). Versus treating canvas/mastra as the operator shell: **avoids a full rewrite** (the expensive mistake).

### Gaps / Linear follow-ups

| Gap | Action |
| --- | --- |
| `resourceId: "default"` and `demo-user` still in tree | AUTH-001 / STREAM-001 — not a new ticket |
| `10-mastra-convert.md` vs installed `@mastra/pg@1.12.1` | Amend convert doc in a **docs-only** follow-up |
| `docs/09-mastra-repos.md` ranks harness as #1 for everything | Dashboard contradicts that — **this file wins** for 1076 |
| `docs/12-task-roadmap.md` IPI-V2-* proposed IDs | Stale vs live 1076/1078/1079 |
| PG persist **runtime** with `MASTRA_DATABASE_URL` unset | Deploy must prove PostgresStore; LibSQL is not durable |
| CORE-001 still blocks TRACE/RELEASE/CONVERT | Keep — those are exams, not Brand Hub |

---

## Related docs

- Product: [prd.md](../../prd.md), [sitemap.md](../../sitemap.md)
- Tenancy: [adr/003-supabase-owns-tenancy.md](../../adr/003-supabase-owns-tenancy.md)
- Convert plan dump (ignore §5 pins): [../archive/copilotkit-mastra/tasks/10-mastra-convert.md](./tasks/10-mastra-convert.md)
- Clone ranking: `/home/sk/ipixai/github/mastra/copilot-mastra-repos.md`  
- Example catalog dump: [../archive/copilotkit-mastra/tasks/04-example-catalog.md](./tasks/04-example-catalog.md)
