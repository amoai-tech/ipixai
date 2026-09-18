---
title: CopilotKit × Mastra — product roadmap
horizon: Now / Next / Later
checked: 2026-09-01
ssot_status: live Linear IPI-1078
---

# CopilotKit × Mastra — roadmap

This is a **season board**, not a calendar contract. Ticket status lives in [**IPI-1078**](https://linear.app/amo100/issue/IPI-1078). Whether to **create** tickets: [todo.md](./todo.md) (Linear **wins** on status). Whole-app order: [docs/roadmap.md](../../roadmap.md). Brand loop: [prd.md](./prd.md) §5b · **[brand.md](./brand.md)**. CopilotKit layer: [prd.md](./prd.md) §5c. Official URLs: [links.md](./links.md).

If this file disagrees with Linear, **Linear wins**.

**Mint:** create **0** Foundation tickets. **KEEP** order is the Now table below. **ADD after Core** only from [todo.md](./todo.md) A1–A11 after duplicate search. Do not create `MASTRA-UPGRADE-001`, four CopilotKit tickets, or **IPI-1121** on this board.

---

## Narrative

**Now** we certify a tenant-safe Planner on **Vercel** so operators talk to Production Planner (not weather), survive refresh and restart, and fail Org B. CopilotKit is the intercom (stream + one screen), not a chatbot product.

**Next** we hang **brand kitchen stations** and CopilotKit **context / GenUI / HITL** on that intercom.

**Later** canvases, buttons-without-chat, research UI, Postiz. Cloudflare Workers are **not** on this board.

---

## Now (until CORE-001 exam)

| Initiative | Why | Linear |
| --- | --- | --- |
| Mastra 1.63.2 family certified | Compile/build/stream must match hosted pg | **IPI-1042 · RUNTIME-001** In Progress (PR #25 on main; merge ≠ Done) |
| Hosted Postgres memory | Isolates recycle; RAM is not a filing cabinet | **IPI-1124 · MASTRA-HOST-PG-001** In Progress |
| Stream + Stop on that family | Fake Core if we certify 1.41 | **IPI-1045 · STREAM-001** In Progress · **IPI-1009 · MASTRA-UPG-004** · **IPI-1117 · HOST-RUNNER-001** |
| Hosted ACCESS | Local 403 ≠ production | **IPI-1125 · QA-ORG-001** → **IPI-1126 · HOST-PREVIEW-001** (Vercel **ipixai**, not ipix.co) → **IPI-1047 · ACCESS-001** |
| CopilotKit stream + one screen | Intercom works | **IPI-1045**, **IPI-1051**, **IPI-1088** replay |
| Planner path | Weather is not iPix | **IPI-1048** → **1049** → **1050** |
| Core exam | Refresh, restart, Org B 403 | **IPI-1041 · CORE-001** Backlog until owners Done |

Already **Done** (do not re-open): **IPI-1043 · DB-001**, **IPI-1044 · PG-001** (local), **IPI-1037 · AUTH-001**, **IPI-1046 · AUTH-002**.

**IPI-1127 · ACCESS-CLAIM-001** blocks **IPI-1091 · RELEASE-001**, not ACCESS merge.

No Brand / Campaign **agents** on the operator route in Now.

---

## Next (after Core exam) — brand + shoot + rack

Think **kitchen stations**, not a second AI app. Stage table: **[brand.md](./brand.md)**.

| Stage | Outcome | Agents / workflows | Linear |
| --- | --- | --- | --- |
| Brand UI + DNA | Website → draft Brain → HITL approved rules | Brand Intelligence agent | **IPI-1068**, **IPI-1093 · BRAND-INTEL-001** (not **IPI-656**) |
| Planner context | Active brand/shoot as **hints** | CopilotKit `useAgentContext` | **IPI-1087 · PLANNER-CONTEXT-001** |
| Typed shoot + GenUI | ShootPlan **card**, not a prose wall | Tool rendering | **IPI-1081 · PLAN-001** |
| HITL + save | Approve then one org write | `useInterrupt` | **IPI-1084** → **IPI-1083** → **IPI-1085**; reuse **IPI-998** |
| Booking / money | Deposit, talent, studio | Stripe Checkout — never a chat charge | **IPI-1071** |
| Asset library | Widget + signed org + approved transforms; connect **anytime** | Cloudinary native | **IPI-1108…1120** **parallel** (not Core blocker) |
| Brand knowledge | “Does this fit?” with sources | Retrieval agent + pgvector | **BRAND-KNOWLEDGE-001** — mint after Core under **IPI-1099** |

---

## Later — strategy, campaign, publish, analytics, learn

Empty **[IPI-1105](https://linear.app/amo100/issue/IPI-1105)**. Duplicate-search then mint ([todo.md](./todo.md) A2–A10). Journey: **[brand.md](./brand.md)**.

| Stage | Agent / workflow | Proposed spec | Adapt (links.md) |
| --- | --- | --- | --- |
| Market intelligence | Research agent | **BRAND-RESEARCH-001** | deep-search, Firecrawl, research-canvas |
| Opportunities | Opportunity agent + HITL | **BRAND-OPPORTUNITY-001** | iPix scores: trend / brand fit / audience / gap |
| Campaign strategy | Shared-state canvas | **CAMPAIGN-STRATEGY-001** | canvas/mastra |
| Campaign plan | Calendar / briefs | **CAMPAIGN-PLAN-001** | canvas/mastra-pm |
| Creative brief | Shot/content reqs → Planner | (no extra IPI) | Feeds **IPI-1081** — not a second planner |
| Buttons without chat | Same Mastra path as chat | **COPILOT-CONTROL-001** | frontend-tools — only if **IPI-1051** still requires typing |
| Workspace UX | Agent on Brand/Campaign pages | **IPI-1065 · APP-001** | strands-crm **UX only** |
| Reuse before shoot | Media agent | **MEDIA-AGENT-001** | Cloudinary search — gap feeds Planner |
| Channel create | Copy agent | **CAMPAIGN-COPY-001** | template-ad-copy-from-content |
| Brand Check | Voice/claims/visual flags | **BRAND-CHECK-001** **Add later** | Do not duplicate **1084** publish HITL |
| Preview | — | **CHANNEL-PREVIEW-001** | Cloudinary delivery URLs |
| Publish | Publish workflow | **PUBLISH-001** / **POSTIZ-001** | Postiz app + agent |
| Analytics charts | — | **IPI-1073 · ANALYTICS-001** | Honest empty; no fake “why” |
| Optimize | Next mix / variants HITL | (with campaign loop) | Not DNA write |
| Learn DNA | Learn agent | **LEARN-001** | Stripe + Postiz + asset ids → HITL |

**Advanced (after real catalog):** Tool/Skill Search, harness schedules (**IPI-996**), browser agent, OpenClaw/Hermes **ops only**. Reuse **IPI-1001**. **Cloudflare Workers / IPI-1121** stay off this roadmap until a future host decision — current host is **Vercel**.

---

## Sequencing (one crew)

```text
NOW     Secure Planner runtime  ★ 1041 CORE exam
        (no Brand agents)

NEXT    Brand DNA HITL  →  Planner consumes DNA
        HITL shoot save  ∥  Cloudinary rack
        pgvector knowledge (mint)

LATER   Research → Opportunity → Strategy → Campaign plan
        Creative brief → Media reuse → Copy → Brand Check → Preview → Postiz
        Charts (1073) → Optimize → Learn DNA (HITL)
        CopilotKit canvas / buttons-without-chat / APP-001 UX
```

Do not start Later while the Core exam is red. Do not mint Foundation tickets. Do not treat shoot **PLAN-001** as campaign strategy.

Check-off: [todo.md](./todo.md). Requirements: [prd.md](./prd.md). Execution: [plan.md](./plan.md).
