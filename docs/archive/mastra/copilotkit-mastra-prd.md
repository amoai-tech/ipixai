---
title: CopilotKit × Mastra — layer PRD (ipixai)
status: Canonical for this folder
checked: 2026-09-01
parent: docs/prd.md
epic: IPI-1078
brand_notes: docs/copilotkit-mastra/brand.md
---

# CopilotKit × Mastra — product requirements

This is the **intercom + crew** spec for the new iPix app (`/home/sk/ipixai`). It deepens [docs/prd.md](../../prd.md). It does **not** replace it. It does **not** describe the old `app/` Operator shell.

**Analogy:** CopilotKit is the wall phone in the studio. Mastra is the crew (Planner today; Brand / Strategy / Media / Publish later). Supabase is the filing cabinet. Cloudinary is the photo rack. Postiz is the mailroom. Stripe is the till.

If this file disagrees with [live Linear](https://linear.app/amo100/issue/IPI-1078) or `package.json`, **Linear and the lockfile win**. Brand notes: **[brand.md](../../mastra/brand.md)** (dumps: [../archive/copilotkit-mastra/brand/](../copilotkit-mastra/brand)). CopilotKit notes are **archived** ([../archive/copilotkit-mastra/copilotkit/](../copilotkit-mastra/copilotkit)) — they do not mint tickets. **Mint / do-not-add:** [todo.md](../../mastra/todo.md). Host is **Vercel**, not Cloudflare Workers.

---

## 1. Problem

Fashion operators plan shoots in chat, then lose the thread on refresh, or see another brand’s plan because a URL leaked a `threadId`. Demo **weather** is not a planner. A blank chat every season is not a brand brain.

Without a **tenant-safe, persistent Production Planner**, Brand DNA, campaigns, Cloudinary, and Postiz are demos on a leaky intercom.

The second problem (after Core): every season starts from a **blank chat**. Approved voice, visuals, and assets live in PDFs and Slack. Operators shoot first instead of reusing the rack, then publish without a human lock, then cannot say which post made money.

---

## 2. Outcome (Core)

A signed-in operator in **Org A**:

1. Opens one Planner screen.
2. Asks for an SS26 shot list / deliverables / budget.
3. Sees a live stream (not a frozen blob).
4. Refreshes the browser and still has that conversation.
5. Survives a process restart (hosted Postgres, not RAM).
6. **Org B** using the same `threadId` gets **403** and **zero** Org A text.

**Done ≠ packages pinned.** Done = [**IPI-1041 · CORE-001**](https://linear.app/amo100/issue/IPI-1041) exam evidence on the **1.63.2** family.

---

## 3. Who owns what

| System | Owns | Must not own |
| --- | --- | --- |
| **CopilotKit** | Screen ↔ AI on **Vercel / Next.js**: auth gate, AG-UI stream, replay, cards, shared state, context, buttons | Database truth, RLS, money, publish |
| **Mastra** | Agents, tools, workflows, memory, suspend/resume HITL | Browser identity; Stripe/Postiz as chat buttons |
| **Supabase + RLS** | Users, orgs, brands, DNA, `mastra` schema | Model routing |
| **pgvector** | Retrieval **after** relational filters | Permission (a hit is not ACL) |
| **Cloudinary** | Binaries, named transforms, approved versions | App-owned custom uploader |
| **Postiz** | Social schedule/send of **approved** payloads | Invented Instagram adapters |
| **Stripe** | Money (deposit, talent, studio) | Charge from a frontend tool |
| **Firecrawl + Gemini URL** | Website/docs intake for Brand Brain drafts | Brand truth without HITL |

---

## 4. In scope for IPI-1078 (foundation)

Keep the epic **small**. See archived [02-mastra-copilotkit.md](../copilotkit-mastra/copilotkit/02-mastra-copilotkit.md). **Do not** register Brand/Campaign agents on the operator route until CORE-001 is proven.

| Must ship | Spec owners (Linear) |
| --- | --- |
| Compile/build on Mastra **1.63.2** family | **IPI-1042 · RUNTIME-001** |
| Safe `mastra` schema, no runtime DDL | **IPI-1043 · DB-001** (Done) |
| Local conversations survive restart | **IPI-1044 · PG-001** (Done, local store) |
| Hosted Postgres, fail-closed if URL missing | **IPI-1124 · MASTRA-HOST-PG-001** |
| Sign-in before Planner | **IPI-1037 · AUTH-001** (Done) |
| Server-derived org `resourceId` | **IPI-1046 · AUTH-002** (Done) |
| Authenticated AG-UI stream | **IPI-1045 · STREAM-001** |
| Org B denied | **IPI-1047 · ACCESS-001** (hosted proof remaining) |
| Production Planner is `default` | **IPI-1048 · PLANNER-001** |
| Compute-only shoot tools | **IPI-1049 · TOOL-001** |
| Memory + CopilotKit replay | **IPI-1050 · MEM-001**, **IPI-1088 · COPILOT-REPLAY-001** |
| One authenticated screen | **IPI-1051 · UI-001** |
| Core exam | **IPI-1041 · CORE-001** |

---

## 5. Out of IPI-1078 (still in this PRD as Next / Later)

Brand journey, campaigns, assets, publish, and analytics are **this product’s loop**. They are **not** Foundation exam work. Empty **[IPI-1105 · CAMPAIGNS & PUBLISHING](https://linear.app/amo100/issue/IPI-1105)** has **zero children** — do not mint the eleven until Core + duplicate search ([todo.md](../../mastra/todo.md) **Add later**).

| Topic | Where it lives |
| --- | --- |
| Operator dashboard / marketing site | **IPI-1076**, **IPI-1077** (parallel) |
| Old Mastra × CF OS / old Brand Lifecycle IPI-46… | **IPI-486**, **IPI-993**, [brand.md](../../mastra/brand.md) historical table — **do not implement** [19-brand-lifecycle.md](../copilotkit-mastra/brand/19-brand-lifecycle.md) |
| Cloudflare Workers / Hyperdrive | **Future only** — not this product path. Host is **Vercel**. Do not execute **IPI-1121 · HOST-CF-001** now. |
| Intelligence UX PRD (`docs/prd/prd-intelligence.md`) | Old `app/` 3-panel — **historical** |

---

## 5b. Brand journey (after Core) — what we are building

Working notes: **[brand.md](../../mastra/brand.md)**. Example brand: **Maison Solène** (jewellery) or **AURA** (womenswear) — website in → season that made money out.

**One loop (do not skip HITL):**

```text
Learn brand → Market → Opportunity → Strategy → Campaign plan
  → Reuse assets / shoot the gap → Create → Brand check → Approve
  → Publish → Measure → Optimize → Learn (DNA HITL) → next campaign
```

| Stage | Operator sees | System | Live Linear / mint later |
| --- | --- | --- | --- |
| Add brand | Org owns a brand row | Onboarding + Brand UI | **IPI-1089 · ONBOARD-001**, **IPI-1068**, epic **IPI-1099** |
| Brand Intelligence | Draft DNA: voice, visual, products, claims + sources | Firecrawl + Gemini URL → draft only | **IPI-1093 · BRAND-INTEL-001** (extend; not historical **IPI-656**) |
| Approve Brand Brain | Human edits; nothing auto-writes DNA | CopilotKit HITL | Same as **IPI-1084** pattern; DNA write is a trusted RPC |
| Brand knowledge | “Does this look fit AURA?” with citations | pgvector **after** org/brand RLS | **BRAND-KNOWLEDGE-001** after Core under **IPI-1099** |
| Market + opportunity | Ranked plays with evidence, not vibes | Research agent; scores are iPix | **BRAND-RESEARCH-001**, **BRAND-OPPORTUNITY-001** |
| Strategy | Objective, audience, message, channels, KPIs on a canvas | Shared state (CopilotKit) | **CAMPAIGN-STRATEGY-001** under **IPI-1105** |
| Campaign plan | Calendar, deliverables, asset need-list | mastra-pm-style board | **CAMPAIGN-PLAN-001** |
| Creative brief | Shot/content reqs from Brain + strategy | Feeds Production Planner | **IPI-1081** — not a second planner |
| Assets | “What do we already have?” then gap list | Cloudinary search + named transforms | **IPI-1108…1120** ∥ **MEDIA-AGENT-001** |
| Shoot the gap | Production Planner + typed ShootPlan | Existing Core Planner + **IPI-1081** / **1083** / **1085** | Do not invent a second planner |
| Create | Channel copy + crops from **approved** binaries | Ad-copy template / Cloudinary | **CAMPAIGN-COPY-001**, **CHANNEL-PREVIEW-001** |
| Brand check + approve | Voice/visual/claims flags; exact version lock | HITL; zero Postiz until Approve | **IPI-1084** / **IPI-998** — do not overload shoot HITL with publish |
| Publish | Schedule IG/web | Postiz only | **PUBLISH-001** / **POSTIZ-001** |
| Analytics | Real numbers or honest empty | Charts = **IPI-1073**; no invented metrics | Stripe + Postiz ids |
| Learn | Proposed DNA edits from what sold | HITL before DNA write | **LEARN-001** — not **IPI-1073** |

**Hard rule:** AI proposes → operator approves → trusted backend writes → Supabase records. Browser `brandId` is a hint. Session + RLS authorize.

**Brand product details (needed to build — full tables in [brand.md](../../mastra/brand.md)):**

- Teach the brand **once**. Shoot / assets / campaign agents share the **same approved Brain**.
- Intake = Firecrawl map/extract + Gemini URL **draft** only. Typical pages: home, about, products, collections, lookbooks.
- Brain includes messaging, collections, approved examples, logo spacing, lighting/composition — not name + one color.
- Opportunity ranks **trend / brand fit / audience / competitive gap** (iPix scores). Not permission.
- Creative brief (shot/content reqs) feeds **Production Planner**. Do not invent a campaign planner agent.
- Connect the Cloudinary rack **anytime**; **gap check is mandatory** before generate/shoot.
- Brand Check is an **advisory** match (voice, claims, imagery, channel). Lock exact copy + exact asset version on Approve.
- Postiz = social schedule of **approved** payloads. n8n optional glue later. No Webflow/IG adapter as Core.
- Analytics charts = **IPI-1073**. “Why it sold” + DNA diffs = **LEARN-001** after HITL. Stripe is money truth.

Paid products to **model**, not buy: Jasper IQ, Frontify, Adobe GenStudio (brand + product + persona + compliance + campaign loop).

### Agents (Mastra) — one crew, many hats

Register **after** CORE-001. Until then, `default` is Production Planner only (**IPI-1048**).

| Agent (product name) | Job | Must not |
| --- | --- | --- |
| **Production Planner** | Shoot type, deliverables, shot list, budget (compute) | Write `shoot.*` without HITL + RPC |
| **Brand Intelligence** | Draft DNA from site/docs | Auto-approve DNA |
| **Brand Knowledge** | Cite approved chunks | Treat vector hit as ACL |
| **Research** | Competitors/trends with sources | Write Brand Brain |
| **Opportunity** | Rank season bets | Publish or book |
| **Strategy / Campaign** | Canvas strategy + calendar | Bypass HITL |
| **Media** | Match need-list to Cloudinary; gap = shoot | Custom DAM |
| **Copy** | Channel variants from approved assets | Publish |
| **Publish** | Hand approved payload to Postiz | Call Postiz from chat without HITL |
| **Learn** | Propose DNA diffs from Stripe/Postiz | Invent revenue |

### Workflows (Mastra + CopilotKit)

| Workflow | Meaning | Linear |
| --- | --- | --- |
| Brand intake | Crawl → draft DNA → HITL persist | **IPI-1093** |
| Shoot save | Typed plan → HITL → **one** org-scoped write | **IPI-1084** → **IPI-1083** → wizard **IPI-1085** |
| Asset reuse | Need-list → search → gap → Planner | Cloudinary + **MEDIA-AGENT-001** |
| Publish | Approved versions only → Postiz | **IPI-1105** child |
| Learn | Metrics + asset ids → proposed DNA | **LEARN-001** |

Do **not** build one giant “Brand Intelligence feature.” One vertical loop, one HITL gate per write.

---

## 5c. CopilotKit — application layer (not a chatbot)

Notes: archived [108](../copilotkit-mastra/copilotkit/108-copilotkit.md) · [109](../copilotkit-mastra/copilotkit/109-copilotkit.md) · [110](../copilotkit-mastra/copilotkit/110.md). Living table is this section. Official URLs: [links.md](../../mastra/links.md).

iPix is a **fashion-production app**. CopilotKit sits between existing screens and Mastra. Chat is one control, not the product.

```text
Brand │ Campaign │ Shoot │ Assets │ Booking   (Next.js on Vercel)
                    ↓
         CopilotKit / AG-UI
         context · buttons · cards · shared drafts · HITL
                    ↓
                  Mastra
                    ↓
         Supabase · Cloudinary · Postiz · Stripe
```

**Rule:** CopilotKit owns the AI *experience*. Mastra owns thinking. Supabase owns truth. Browser `brandId` is a hint.

| # | Capability | iPix use | When | Linear |
| --: | --- | --- | --- | --- |
| 1 | **Agent app context** | Page, brand, shoot, campaign as hints | Next | **IPI-1087 · PLANNER-CONTEXT-001** — not `COPILOT-CONTEXT-001` |
| 2 | **Programmatic control** | `[Research]` / `[Plan Shoot]` without typing | Later if still a gap | **COPILOT-CONTROL-001** after **IPI-1051** |
| 3 | **Tool rendering / GenUI** | ShootPlan, budget, **draft DNA**, Brand Check, approval, evidence cards | Now UI / Next shoot | **IPI-1051**, **IPI-1081** — not `COPILOT-UI-001` |
| 4 | **Shared state** | Campaign/planner board stays in sync | Next / Later | canvas/mastra, mastra-pm |
| 5 | **State streaming** | Plan appears while Mastra writes | Now (stream) | **IPI-1045 · STREAM-001** |
| 6 | **Frontend tools** | Safe filters/nav only | Next | Never money/publish |
| 7 | **HITL / interrupts** | Approve exact version | Next | **IPI-1084**, **IPI-998** |
| 8 | **Threads / replay** | Refresh keeps the SS26 chat | Now | **IPI-1088 · COPILOT-REPLAY-001** |
| — | Background tasks, A2UI/MCP Apps | Long research, embedded apps | Later | Not Core |

Do not mint four generic CopilotKit tickets. Do not copy Strands/DeepAgents **backends**. Hosted CopilotKit + Mastra run on **Vercel** (`ipixai` preview = **IPI-1126**). **IPI-1117 · HOST-RUNNER-001** is Stop on the same Vercel isolate — not Workers.

---

## 6. Constraints

- Starter: CopilotKit [`examples/integrations/mastra`](https://github.com/CopilotKit/CopilotKit/tree/main/examples/integrations/mastra).
- Pins: CopilotKit **1.68.1**, `@mastra/core@1.63.2`, `@mastra/pg@1.22.2` (see `package.json`).
- Storage: `schemaName: "mastra"`, `disableInit: true`. Hosted: never silent LibSQL `:memory:`.
- Tools that write domain data: SECURITY DEFINER RPCs + user JWT — not Mastra as `postgres` on `shoot.*`.
- Host: **Vercel + Next.js** (`amoai-tech/ipixai`). Split `dev:ui` / `dev:agent` locally. Never combined `npm run dev`.
- No production Supabase writes from Core work.

### Storage contract (DB-001 recert, 2026-09-01)

Think of Mastra memory as a **labeled filing cabinet** (`schemaName: "mastra"`). Installed `@mastra/pg` uses **`public` unless you pass `schemaName`**.

| Fact | Contract |
| --- | --- |
| Pins | `@mastra/core@1.63.2`, `@mastra/pg@1.22.2` (`package.json`) |
| Wire | `src/mastra/pg-store.ts`: `schemaName: "mastra"`, `disableInit: true`, singleton `pg.Pool` |
| Load-bearing tables | `mastra_threads`, `mastra_messages`, `mastra_resources`, `mastra_workflow_snapshot` — required columns **MATCH** Core `TABLE_SCHEMAS` on fashionos |
| Hosted writes | **NO-GO** until **IPI-1124 · MASTRA-HOST-PG-001** (allowlist, pooler, fail-closed) |
| Do not | GRANT `mastra` to `anon`; point iPixai at staging `public.mastra_*` shadows; `npx mastra migrate` on hosted |

Evidence dump: [../archive/copilotkit-mastra/tasks/db-001-matrix.md](../copilotkit-mastra/tasks/db-001-matrix.md).

### Mint Linear (from the 05a audit)

Create **0** Foundation tickets. Spec bodies for Pass 2 + Pass 3 are already on Linear.

| Action | What |
| --- | --- |
| **KEEP / IMPROVE** | **IPI-1042 → 1009 → 1045 → 1124 ∥ 1125 → 1126 → 1047 → 1048–1051 → 1041**. Platform **IPI-993…1003**. Launch **1081 / 1084 / 1083 / 1085**. Brand **1093 / 1068**. Cloudinary **1108…1120**. |
| **ADD after Core** | [todo.md](../../mastra/todo.md) A1–A11 under **IPI-1099** / **IPI-1105** after duplicate search |
| **Hygiene only** | C12 (`relatedTo` 1078 on 1047/1125) · C13 (**IPI-656** historical; v2 DNA = **1093**) |
| **Do not add** | `MASTRA-UPGRADE-001`, `MASTRA-CORE-001`, four CopilotKit tickets, second DAM, second Mastra DB |

Candidates list: [../plan/04/06.1-new-tasks.md](../../plan/04/06.1-new-tasks.md) (**0** new IPIs 2026-09-01).

---

## 7. Acceptance (human-readable)

- [ ] Operator never talks to weather on the authenticated route.
- [ ] Signed-out Planner is **401** before the model runs.
- [ ] Refresh keeps the SS26 thread.
- [ ] Hosted restart keeps the same thread IDs.
- [ ] Org B 403 with empty body (hosted, not only local LibSQL).
- [ ] Stop/cancel reaches the streaming **Vercel** server (**IPI-1117 · HOST-RUNNER-001**; **IPI-1009** certifies stream/HITL on this family — ignore “Cloudflare” in that Linear title).

**After Core (brand loop — not CORE-001 ACs):**

- [ ] Operator can approve Brand DNA; unsigned draft is not truth.
- [ ] Planner can consume approved DNA as input (server-authorized), not a pasted PDF only.
- [ ] Asset search runs **before** a new shoot; gap list is the shoot brief.
- [ ] Creative brief does **not** spawn a second planner — it feeds **IPI-1081**.
- [ ] Brand Check never publishes; Approve locks exact version.
- [ ] Nothing reaches Postiz or Stripe from an unapproved chat tool.
- [ ] Analytics charts are empty or real — never fake “why it sold” until **LEARN-001**.

Execution: [plan.md](../../mastra/plan.md). Horizon: [roadmap.md](../../mastra/roadmap.md). Official URLs: [links.md](../../mastra/links.md). Check-off + mint: [todo.md](../../mastra/todo.md).
