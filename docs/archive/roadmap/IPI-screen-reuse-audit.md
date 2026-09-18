# iPix Screen + Feature Reuse Audit

**Date:** 2026-08-30  
**Status:** Audit + Linear aligned (no product code). Cleanup **2026-08-30d**: journey epics IPI-1098–1107 created; feature tasks reparented off **IPI-1076 · DASHBOARD DESIGN — Operator Workspace Migration Sequence**.  
**Verification:** Re-checked against `/home/sk/ipix` HEAD `b2d3de8e5` ([amoai-tech/luminaai](https://github.com/amoai-tech/luminaai) `main` — **reproducible SHA**). Live Linear in this file is a **2026-08-30 snapshot**; live Linear is the SSOT and may have drifted — **NOT VERIFIED** after that date.

**Independent review of the correction notes: 90/100 — PASS** is **author judgment**, not a checked-in scoring script — **NOT VERIFIED** as an independent grade. Reuse working React; re-prove queries/RPCs/auth/agents. Catalog **69/100** is a **migration-effort estimate** (same caveat).

| Score | Meaning |
|-------|---------|
| **90/100** | Audit strategy |
| **96/100** | Linear consistency after 2026-08-30d journey epics |
| **69/100** | luminaai catalog **estimated** UI coverage only |

**Organize as:** Milestone (when) → journey epic (what) → feature task → screen. [IPI-1076 · DASHBOARD DESIGN — Operator Workspace Migration Sequence](https://linear.app/amo100/issue/IPI-1076) stays a **migration coordinator** (APP-001 / DESIGN-001). Domain journeys (full Linear names; also §7):

| Epic | Linear title |
|------|-------------|
| [IPI-1098 · HOME — Give Operators One Command Center for the Org](https://linear.app/amo100/issue/IPI-1098) | Command Center |
| [IPI-1099 · BRAND — Browse Brands and Approve Brand DNA](https://linear.app/amo100/issue/IPI-1099) | Brands + DNA |
| [IPI-1100 · SHOOT PLANNING — Keep Shoot Records Browsable and Complete](https://linear.app/amo100/issue/IPI-1100) | Shoot list/detail |
| [IPI-1101 · TALENT & BOOKING — Book Talent Against a Saved Shoot](https://linear.app/amo100/issue/IPI-1101) | Talent + booking |
| [IPI-1102 · PRODUCTION & MEDIA — Browse Assets and Deliver Shoot Files](https://linear.app/amo100/issue/IPI-1102) | Assets + delivery |
| [IPI-1103 · CRM — Run the Relationship Hub in the New App](https://linear.app/amo100/issue/IPI-1103) | Relationship Hub |
| [IPI-1104 · OPERATIONS — Operator Inbox and Coordination](https://linear.app/amo100/issue/IPI-1104) | Inbox |
| [IPI-1105 · CAMPAIGNS & PUBLISHING — Campaigns, Preview, and Publish](https://linear.app/amo100/issue/IPI-1105) | Campaigns (tickets later) |
| [IPI-1106 · ANALYTICS — Show Real Metrics Without Invented Numbers](https://linear.app/amo100/issue/IPI-1106) | Honest metrics |
| [IPI-1107 · PLANS — Saved Production Plans, Not a Second Planner](https://linear.app/amo100/issue/IPI-1107) | Saved plans workspace |

**Primary implementation gate:** [IPI-1037 · AUTH-001](https://linear.app/amo100/issue/IPI-1037) → [IPI-1065 · APP-001](https://linear.app/amo100/issue/IPI-1065) → BRAND-001 ∥ SHOOT-001 → HOME-001.

Think of the old app as a **furnished studio that already works**, and the new roadmap as **the same rooms plus a production kitchen**. Most rooms should be moved, not rebuilt. The kitchen (Smart Booking, Stripe, Cloudinary delivery, Postiz) is new capability — not a reason to knock down the talent wall.

## Sources (what was actually checked)

| Source | What it is | What we used |
|--------|------------|--------------|
| `/home/sk/ipix/app/src/app/(operator)` | Proven operator React (31 `page.tsx` routes) | Screen, route, CopilotKit/Mastra wiring |
| `/home/sk/ipix/app/src/app/(marketing)` | Public site + login | Marketing pages (photography-service SEO set) |
| `/home/sk/ipix/app/src/mastra/agents` | Old Mastra agents | Planner, Brand Intelligence, Booking, Creative Director, CRM, Visual Identity, Model Match, Public Marketing |
| `Universal-design-prompt-4/docs/handoff/SCREEN-REGISTRY.md` | SCR-01…SCR-35 map | HTML/design IDs, intended agents |
| `Universal-design-prompt-4/Pages/` | **38** HTML files (screens + 5 mobile galleries + INDEX + Component Library + DEMO) | Visual SSOT — not 31 files |
| `ipixai` `src/` | New CopilotKit + Mastra starter + DESIGN-001 tokens | Almost no operator screens yet (`src/app/page.tsx` only) |
| Linear project **v2-ipix** | Live issues | Phase / “Mastra NONE” mismatches |

**GitHub vs local:** [amoai-tech/luminaai](https://github.com/amoai-tech/luminaai) `main` HEAD is `b2d3de8e5` — same SHA as `/home/sk/ipix` (origin still named `amo-tech-ai/lumina-studio`). This audit is the live working tree, not a different fork.

**NOT VERIFIED:** pixel-perfect HTML vs React in a browser; production deploy UX. Stripe/Postiz: **zero** TypeScript matches under `/home/sk/ipix/app`.

## Reuse ladder (hard rule)

For every screen: reuse proven React **UI and pure view logic** first, then design HTML, then ipixai tokens, then new Mastra/Supabase/Stripe. Rebuild last.

**Do not copy old queries/RPCs blindly.** Re-verify each one against v2 org membership, RLS, and trusted org context. Example: Command Center `brands.user_id = current user` must become org-owned brands.

```text
COPY:  working React UI + view-only helpers
ADAPT: queries, RPCs, auth, org ownership, CopilotKit agentId
DROP:  skip fixtures, service-role browser, CF/OpenNext/DurableAgent/Hyperdrive, resourceId "default", fake metrics, HTML as source
```

```text
luminaai React  →  Universal-design-prompt-4  →  ipixai design system  →  new backend/AI  →  custom rebuild
```

Separate **screen migration** from **new product capability**. Example: Talent UI already exists; Smart Booking coordination does not — add Booking Coordinator + data/Stripe, do not rebuild Talent cards.

## AI-native rule (every important screen)

| Layer | Meaning |
|-------|---------|
| L1 | Context (active brand / shoot / booking) |
| L2 | Proactive intelligence rail (“what needs attention”) |
| L3 | Copilot chat (usually **one** Planner, not a new agent per page) |
| L4 | Generative artifact when useful (plan, DNA draft, booking draft) |
| L5 | Human-in-the-loop before sensitive writes |

Not every screen needs its own agent.

## Old Mastra agents that already exist (do not invent duplicates)

| Agent id | Used on (old) | Port to v2 when |
|----------|---------------|-----------------|
| `production-planner` | Command Center, shoots, wizard, planner workspace | Core/MVP — already the v2 foundation agent |
| `brand-intelligence` | Brand list/detail, onboarding, URL intake | MVP — **reuse**, do not rewrite as a new brand chat |
| `booking` | `/app/matching/talent/[id]/book`, `/app/bookings/[id]` — **RPCs are wired** (`create_booking_request`, `get_booking`, `transition_booking`) | MVP — expand as Booking Coordinator |
| `creative-director` | `/app/campaigns` **and** `/app/assets` (route map) | Post-MVP campaigns; MVP assets keep this agent, not a new Assets Agent |
| `visual-identity` | `/app/preview` (+ Cloudinary in agent) | Channel preview / media transforms |
| `model-match` | `/app/matching`, `/app/talent` | MVP talent search |
| `crm-assistant` | `/app/crm/*` | Post-MVP |
| `public-marketing` | Marketing chatbot | Post-MVP, not Core |
| `social-discovery` | **Not** Matching. Used inside **brand-intelligence workflow** (`discoverSocialChannels`) | Port with Brand Intel, not as Matching agent |

**No Photography Expert or Video Expert agent files** in old `mastra/agents/`. Those are **new specialists** if the roadmap needs them — initially fold photo/video **requirements into the Planner structured plan**, not two extra runtimes.

---

## Master table

Reuse % below is **estimated UI coverage**, not a verified query/auth score. Re-prove every RPC against v2 org/RLS.

| Order | Screen / Capability | Existing React? | What already works | Missing for new roadmap | Agent/AI needed? | Phase | Recommendation |
| ----- | ------------------- | --------------- | ------------------ | ----------------------- | ---------------- | ----- | -------------- |
| 1 | Marketing homepage | Yes — `(marketing)/page.tsx` | Studio photography homepage, nav, media | Product story: brand → plan → book → deliver | Marketing Concierge **later** | MVP (copy) / Post-MVP (chat) | Reuse layout; rewrite positioning (IPI-1057) |
| 2 | Marketing services (9 SEO pages) | Yes — amazon, video, jewellery, shopify, location, instagram, fashion, ecommerce, clothing | Legacy photography SEO | Product story vs studio SKUs; indexed URLs | No | MVP | **Classify** KEEP/MERGE/REPOSITION/301/DROP first (IPI-1060); SEO owns redirects (IPI-1063). Do not blindly collapse to five. |
| 3 | Marketing login | Yes — `(marketing)/login` | Login UX | Wire to new AUTH-001/002 | No | Core | Reuse UI (IPI-1058) |
| 4 | Onboarding | Yes — `(onboarding)` + `/app/onboarding` | First brand, skip-to-CC | URL → Brand Intelligence draft → HITL | Brand Intelligence | Core/MVP | Reuse shell; add intel handoff (IPI-1089 + BRAND-INTEL-001) |
| 5 | App shell / nav / Copilot provider | Yes — `(operator)/layout.tsx` + operator-panel | Intelligence rail, CopilotKit, org chrome | Route + brand/shoot/booking context slot for v2 | Provider only, not a new agent | Core | COPY+CLEAN into APP-001; no domain logic |
| 6 | Command Center `/app` | Yes — `command-center` + live KPIs | Brands, shoots, approvals fixtures | Attention rail: at-risk shoot, unconfirmed call times, pending bookings | **Planner + dashboard context** — no Home Agent | MVP | Reuse screen; make AI-native (IPI-1066) |
| 7 | Brand list `/app/brand` | Yes | Browse brands | URL intake as first-class journey | Brand Intelligence on profile, not list spam | MVP | Keep BRAND-001 as list+profile only |
| 8 | Brand profile `/app/brand/[id]` | Yes | Profile, DNA-related UI in old product | Approved Brand DNA from URL/web research as **the** intake | Brand Intelligence | MVP | Extend profile; split intel into BRAND-INTEL-001 |
| 9 | Brand Intelligence (URL → DNA) | Yes — agent + `/api/workflows/brand-intelligence/*` HITL | Analyze URL, draft, approve | Port to ipixai | Brand Intelligence (reuse tools) | MVP M2 | **IPI-1093** BRAND-INTEL-001 created; port workflow, do not rebuild UI from scratch |
| 10 | Shoots list `/app/shoots` | Yes | List + filters | Lifecycle tabs visible on detail | Planner context | MVP | SHOOT-001 list+detail only |
| 11 | Shoot detail `/app/shoots/[id]` | Yes | Record, inline crew booking row | Tabs: Overview, Plan, Deliverables, Shot List, Crew, Bookings, Location, Equipment, Assets, Delivery | Planner; Booking later | MVP | Extend tabs; do not stuff wizard |
| 12 | Shoot wizard `/app/shoots/new` | Yes | Deliverables → shot list → budget HITL | Purpose, channels, photo/video reqs, production requirements, booking handoff | Production Planner | MVP | Extend wizard; handoff only to booking |
| 13 | Structured shoot plan (contract) | Partial — planner tools | Shoot type, deliverables, shots, budget | Purpose, indoor/outdoor, lighting, background, talent/crew/studio/equipment, risks, schedule | Planner tools | MVP | Expand PLAN-001 contract for Smart Booking |
| 14 | Production Planner chat | Yes old; **starter** in ipixai | Old: full HITL sequence; new: foundation tickets | Photo/video experts as extra agents; full launch journey | Production Planner | Core then MVP | Keep foundation tickets unchanged; extend tools not screens |
| 15 | Planner hub `/app/planner` | Yes | Instance list (reskin of shoots) | Competing with Copilot Planner | Same Planner — workspace not second brain | Post-MVP | IPI-1074 stays M4; clarify vs chat |
| 16 | Planner workspace `/app/planner/[id]` | Yes proto | Timeline/kanban | Must not fork a second planner agent | Production Planner | Post-MVP | Reuse UI; bind to saved plan records |
| 17 | Talent list `/app/talent` | Yes | Find talent | Smart Booking coordination | Model-match + Booking Coordinator | **MVP M3** | Reuse screens (IPI-1071); **keep Mastra NONE** on the port; Booking AI is IPI-1095 |
| 18 | Talent profile / matching | Yes — matching, profile, onboarding | Cards, Cloudinary avatars | Availability + studio/location in one coordinator | model-match, booking | MVP | Reuse; extend BOOKING-AI-001 |
| 19 | Booking wizard `/app/matching/talent/[id]/book` | Yes UI; **`shoot_id: null`** (“real shoot picker not wired yet”) | Availability + create request | Shared contract, shoot linkage, Stripe | Booking Coordinator | MVP | IPI-1094 BOOKING-DATA (`booking.shoot_id`) + IPI-1095 AI; IPI-1071 is screens only |
| 20 | Booking detail `/app/bookings/[id]` | Yes UI | Status display | Call times, conflicts, deposit state | Booking Coordinator | MVP | Extend, don’t rebuild |
| 21 | Studio / location booking | Partial (shoot location fields; no dedicated studio marketplace) | Location on shoot | Indoor/outdoor, light, power, load-in, price, availability | Booking Coordinator | MVP M3 **gated · NOT VERIFIED** | **Do not create STUDIO-001** until both proofs exist (saved booking `shoot_id` not null **and** linked talent readable). Neither proof is in this audit. |
| 22 | Availability / call times | Partial — SCR-23 proto, batch RPC 🔴 | Talent available/blocked UI | Shared contract across talent, studio, crew | Deterministic + AI compare | MVP | BOOKING-DATA-001 |
| 23 | Stripe deposit | **No** | — | Checkout, webhook, confirm booking | No agent for charge; HITL confirm | MVP M3 | **IPI-1096** PAYMENT-001 created |
| 24 | Production-day coordination | Partial — inbox, shoot detail | Notifications proto | Call sheets, who hasn’t confirmed | Planner + Booking (no Supervisor yet) | MVP thin / Advanced Supervisor | Inbox stays OPERATIONS; don’t wait for Production Supervisor |
| 25 | Assets list/detail | Yes + Cloudinary URLs | Browse, DNA tools on Creative Director | Upload → Cloudinary → Supabase → approve → deliver as MVP end | **Creative Director** (preview = visual-identity) | **Late MVP** | Move IPI-1069 to M3; add MEDIA-001 |
| 26 | Channel preview `/app/preview` | Yes — `channel-preview-studio` | IG/TikTok-style crops via Cloudinary | Formal channel matrix + Postiz | visual-identity | Post-MVP | CHANNEL-PREVIEW-001; don’t block MVP delivery |
| 27 | Content calendar / Postiz | **No** | — | Schedule, captions, publish | Publishing Agent | Post-MVP | PUBLISH-001 + POSTIZ-001 |
| 28 | Operations inbox `/app/inbox` | Yes | Notification center proto | Split from campaigns | Optional later | Post-MVP | Keep IPI-1072 as inbox/coordination |
| 29 | Campaigns `/app/campaigns` | Yes | Creative Director briefs | Campaign → brief → shoots → assets → publish | Creative Director | Post-MVP | **New** CAMPAIGN-001 split from 1072 |
| 30 | CRM | Yes — companies, contacts, pipeline | Full Relationship Hub UI | Not on MVP critical path | crm-assistant | Post-MVP | IPI-1070 stay M4 |
| 31 | Analytics `/app/analytics` | Yes | Overview + campaign perf | AI Q&A without inventing metrics | Analytics Agent **later** | Post-MVP | Port first (NONE OK); then ANALYTICS-AI-001 |
| 32 | Photography Expert | **No dedicated agent** | Planner covers photo-ish shot lists | Explicit photo requirements block | Optional specialist **or** Planner fields | MVP fields / Advanced agent | Prefer Planner structured fields first |
| 33 | Video Expert | **No** | Video marketing page only | Video deliverables, Reels, crew | Same as photo | MVP fields / Advanced | Same |
| 34 | Creative Director (product role) | Yes agent | Campaigns + asset DNA | Don’t make a third planner | CD agent | Post-MVP primary; MVP assets tools OK | Reuse agent; Advanced for “CD as owner” |
| 35 | Cloudflare AI Gateway / Workers | Old ipix used CF models | — | Not in v2-ipix | Infra, not a screen | Post-MVP / Advanced | CF-HOST-001, AI-GATEWAY-001 after Node journey works |
| 36 | Design tokens / atoms | ipixai DESIGN-001 **Done** | tokens.css, empty/error/entity-list | Shell not migrated | No | Core | Already landed; APP-001 consumes |

---

## 1. Screens to reuse unchanged (COPY+CLEAN UI)

Move as-is except tokens/auth/org context:

- Operator **shell** (nav, rail chrome, Copilot provider pattern)
- **Login** visual
- **Brand list** (not the intel workflow)
- **Shoots list**
- **CRM** suite (when M4)
- **Analytics** charts (deterministic only)
- **DESIGN-001** atoms already in ipixai

Foundation Linear (do **not** expand into product screens): **IPI-1037, 1046, 1045, 1047–1050, 1088, 1041**.

## 2. Screens to reuse + extend

| Screen | Extend with |
|--------|-------------|
| Command Center | Attention rail; Planner with dashboard context |
| Brand profile | Approved DNA, URL provenance |
| Shoot detail | Lifecycle tabs; later bookings/assets/delivery |
| Shoot wizard | Purpose, channels, photo/video, production reqs, **Continue to booking** |
| Talent + booking UI | Availability, studios, costs — **screens stay**; AI/data is separate tickets |
| Assets | Cloudinary upload/delivery pipeline (capability ticket) |
| Marketing home/services | New value proposition; fewer service pages |
| Onboarding | Brand URL → intel draft |

## 3. Screens that are obsolete or duplicated

| Item | Why |
|------|-----|
| Nine photography SEO pages as-is | Wrong product story; **classify** then 301 — do not drop indexed URLs blindly |
| `/app/plans` as a **second Planner** | Chat Planner is SSOT; plans = saved artifacts |
| Role dashboards SCR-25 as separate product | Fold into Command Center + later model/agency if needed |
| Duplicate marketing Linear (IPI-1054–1062 etc. already Duplicate) | Ignore duplicates |
| Home Agent / Dashboard Agent | Duplicate of Production Planner |
| Rebuilding Talent to “add AI” | Capability belongs in BOOKING-AI-001 |
| Cloudflare Workers Mastra rewrite | Out of Core; old architecture, not a screen |

## 4. New screens / capabilities missing

| Capability | Suggested id | Phase |
|------------|--------------|-------|
| Brand URL → approved DNA | BRAND-INTEL-001 | MVP M2 |
| Booking data contract | BOOKING-DATA-001 | MVP M3 |
| Booking Coordinator | BOOKING-AI-001 | MVP M3 |
| Studio/location | STUDIO-001 (**do not create yet**) | MVP M3 **gated · NOT VERIFIED**: unlock only after (1) a saved booking with **non-null `shoot_id`** and (2) that booking’s linked talent can be **read back**. This audit has neither proof. |
| Stripe deposit | PAYMENT-001 ([IPI-1096](https://linear.app/amo100/issue/IPI-1096); no PAYMENT-002) | MVP M3 |
| Cloudinary delivery layer | MEDIA-CLOUDINARY-001 | Late MVP |
| Upload/review/deliver | MEDIA-001 | Late MVP |
| Channel preview product | CHANNEL-PREVIEW-001 | Post-MVP |
| Publishing + Postiz | PUBLISH-001, POSTIZ-001 | Post-MVP |
| Campaign workspace | CAMPAIGN-001 | Post-MVP |
| Analytics Q&A | ANALYTICS-AI-001 | Post-MVP |
| CF host + AI Gateway | CF-HOST-001, AI-GATEWAY-001 | Post-MVP |
| Photo/Video specialists | only if Planner fields fail | Advanced |
| Production Supervisor | Advanced | Advanced |
| Stripe Connect payouts | Advanced | Advanced |

## 5. Agents actually needed vs screens

| Agent | Screens | When |
|-------|---------|------|
| **Production Planner** | Shell, Home, Shoots, Wizard, Launch, later dashboard questions | Core + entire MVP |
| **Brand Intelligence** | Onboarding, Brand profile, URL intake | MVP M2 |
| **Booking Coordinator** (evolve old `booking`) | Talent, bookings, studio, calendar | MVP M3 |
| **model-match** | Matching / talent search | MVP with talent screens |
| **Creative Director** | `/app/assets` (screen owner) + campaigns | MVP assets keep this agent; campaigns Post-MVP |
| **visual-identity** | `/app/preview` + Cloudinary transforms | Late MVP / Post-MVP preview — not the Assets screen agent |
| **Publishing Agent** | Calendar / Postiz | Post-MVP |
| **Analytics Agent** | Analytics | After metrics port |
| **Marketing Concierge** | Public site | Post-MVP |
| **crm-assistant** | CRM | Post-MVP |
| Photography / Video / Supervisor / Talent-matching IQ | — | Advanced unless Planner contract is insufficient |

**Do not** add: Home Agent, Assets Agent, Operations Agent, Plans Agent.

## 6. Recommended development order (matches IPI-1076)

**Correct build order.** Do not add extra Linear `blockedBy` just because items are related.

```text
CORE
  AUTH-001 → org (AUTH-002) → APP-001 shell + rail + L1–L5 slots → Planner foundation
  [IPI-1041 · CORE-001](https://linear.app/amo100/issue/IPI-1041) = Planner **exam** (refresh/restart/Org A vs Org B). Live Linear: it does **not** block starting M2 pages. `docs/todo.md` still saying “no dashboard until CORE-001” is **stale** vs that issue.

MVP PRODUCT (M2)
  Marketing classify/reposition (1057/1060/1063)
  → Onboarding
  → BRAND-001 display → BRAND-INTEL-001 (IPI-1093)
  → SHOOT-001 list/detail + tab shell
  → HOME-001 (org-scoped KPIs; no Home Agent)

M3A SHOOT LAUNCH (IPI-1079 — do not swallow fulfillment)
  PLAN-001 (IPI-1081) → APPROVAL → SAVE → WIZARD (IPI-1085 handoff only)

M3B FULFILLMENT (same milestone, separate tickets)
  BOOKING-DATA-001 (IPI-1094, fix shoot_id:null)
  → Talent/Booking screens (IPI-1071) may already be in flight after APP
  → BOOKING-AI-001 (IPI-1095, blocked by 1094)
  → PAYMENT-001 (IPI-1096)
  → ASSETS-001 list/detail (IPI-1069) → MEDIA-001 upload/review/approve/deliver (IPI-1097)
  STUDIO-001 not created — gate **NOT VERIFIED** (needs saved booking with non-null shoot_id + talent readable)

POST-MVP M4
  Inbox (IPI-1072) · CRM · Analytics · Plans workspace
  Channel Preview · Campaigns · Postiz · Analytics AI — not created yet

ADVANCED
  CF Workers / AI Gateway / specialist agents — not created yet
```

## 7. Linear correction checklist (live v2-ipix)

Foundation **unchanged:** IPI-1037, 1046, 1045, 1047, 1048, 1049, 1050, 1088, 1041.

### Corrected / improved (scope locks + titles + milestones)

| Issue | Status |
|-------|--------|
| [IPI-1076 · DASHBOARD DESIGN — Operator Workspace Migration Sequence](https://linear.app/amo100/issue/IPI-1076) **single journey map**; D-tables/historical peer-port **removed**; migration coordinator; journey epics IPI-1098–1107 | ✅ |
| [IPI-1065](https://linear.app/amo100/issue/IPI-1065) shell + rail + route-context slots | ✅ |
| [IPI-1066](https://linear.app/amo100/issue/IPI-1066) COPY UI; adapt org queries; no Home Agent | ✅ |
| [IPI-1068](https://linear.app/amo100/issue/IPI-1068) display approved DNA only | ✅ |
| [IPI-1067](https://linear.app/amo100/issue/IPI-1067) tab shell; not every tab | ✅ |
| [IPI-1081](https://linear.app/amo100/issue/IPI-1081) expanded ShootPlan fields | ✅ |
| [IPI-1085](https://linear.app/amo100/issue/IPI-1085) expanded stages + booking **handoff**; **title updated** | ✅ |
| [IPI-1071](https://linear.app/amo100/issue/IPI-1071) M3; APP-001 only; Mastra NONE kept; **phase:4-launch-shoot** | ✅ |
| [IPI-1069](https://linear.app/amo100/issue/IPI-1069) **ASSETS = list/detail**; preview attachment **deleted** | ✅ |
| [IPI-1072](https://linear.app/amo100/issue/IPI-1072) inbox/coordination; campaigns attachment **deleted** | ✅ |
| [IPI-1073](https://linear.app/amo100/issue/IPI-1073) deterministic metrics | ✅ |
| [IPI-1074](https://linear.app/amo100/issue/IPI-1074) saved plans, not Planner | ✅ |
| [IPI-1079](https://linear.app/amo100/issue/IPI-1079) M3A vs M3B; not one giant epic | ✅ |
| [IPI-1077](https://linear.app/amo100/issue/IPI-1077) / [1057](https://linear.app/amo100/issue/IPI-1057) / [1060](https://linear.app/amo100/issue/IPI-1060) / [1063](https://linear.app/amo100/issue/IPI-1063) Brand→Plan→Book→Produce→Deliver; SEO owns 301s | ✅ |
| **M3** description Launch + Fulfillment | ✅ |
| **M4** renamed **CRM, Operations, Analytics & Plans** (no Assets/Talent in the name) | ✅ |
| [IPI-1097](https://linear.app/amo100/issue/IPI-1097) **MEDIA = upload/review/approve/deliver** on every AC | ✅ |

### New tasks created

| Issue | Status |
|-------|--------|
| [IPI-1093 · BRAND-INTEL-001](https://linear.app/amo100/issue/IPI-1093) | ✅ created M2 |
| [IPI-1094 · BOOKING-DATA-001](https://linear.app/amo100/issue/IPI-1094) | ✅ created M3; documents `shoot_id: null` |
| [IPI-1095 · BOOKING-AI-001](https://linear.app/amo100/issue/IPI-1095) | ✅ created M3; blocked by 1094 |
| [IPI-1096 · PAYMENT-001](https://linear.app/amo100/issue/IPI-1096) | ✅ created M3 |
| [IPI-1097 · MEDIA-001](https://linear.app/amo100/issue/IPI-1097) | ✅ M3; upload/review/approve/deliver (not list/detail) |

### Journey epics created (2026-08-30d)

| Epic | Children (reparented) |
|------|------------------------|
| [IPI-1098 · HOME — Give Operators One Command Center for the Org](https://linear.app/amo100/issue/IPI-1098) | IPI-1066 |
| [IPI-1099 · BRAND — Browse Brands and Approve Brand DNA](https://linear.app/amo100/issue/IPI-1099) | IPI-1068, IPI-1093 |
| [IPI-1100 · SHOOT PLANNING — Keep Shoot Records Browsable and Complete](https://linear.app/amo100/issue/IPI-1100) | IPI-1067 (wizard stays [IPI-1079](https://linear.app/amo100/issue/IPI-1079)) |
| [IPI-1101 · TALENT & BOOKING — Book Talent Against a Saved Shoot](https://linear.app/amo100/issue/IPI-1101) | IPI-1094, IPI-1071, IPI-1095, IPI-1096 |
| [IPI-1102 · PRODUCTION & MEDIA — Browse Assets and Deliver Shoot Files](https://linear.app/amo100/issue/IPI-1102) | IPI-1069, IPI-1097 |
| [IPI-1103 · CRM — Run the Relationship Hub in the New App](https://linear.app/amo100/issue/IPI-1103) | IPI-1070 |
| [IPI-1104 · OPERATIONS — Operator Inbox and Coordination](https://linear.app/amo100/issue/IPI-1104) | IPI-1072 |
| [IPI-1105 · CAMPAIGNS & PUBLISHING — Campaigns, Preview, and Publish](https://linear.app/amo100/issue/IPI-1105) | none yet (CAMPAIGN / CHANNEL-PREVIEW / PUBLISH / POSTIZ still uncreated) |
| [IPI-1106 · ANALYTICS — Show Real Metrics Without Invented Numbers](https://linear.app/amo100/issue/IPI-1106) | IPI-1073 |
| [IPI-1107 · PLANS — Saved Production Plans, Not a Second Planner](https://linear.app/amo100/issue/IPI-1107) | IPI-1074 |

Already existed: [IPI-1092 · AUTH](https://linear.app/amo100/issue/IPI-1092), [IPI-1079 · LAUNCH](https://linear.app/amo100/issue/IPI-1079), [IPI-1076 · DASHBOARD DESIGN — Operator Workspace Migration Sequence](https://linear.app/amo100/issue/IPI-1076) shell coordinator, [IPI-1077](https://linear.app/amo100/issue/IPI-1077) marketing, [IPI-1078](https://linear.app/amo100/issue/IPI-1078) Mastra/CopilotKit.

### Remaining (do not create yet)

STUDIO-001 (**NOT VERIFIED** unlock: saved booking with non-null `shoot_id` **and** linked talent readable; do not create until both are proven) · MEDIA-CLOUDINARY-001 (Node signing / delivery layer — **do not create yet**; until then treat as scope on [IPI-1097 · MEDIA-001](https://linear.app/amo100/issue/IPI-1097), not a missing owner) · CHANNEL-PREVIEW-001 · CAMPAIGN-001 · PUBLISH-001 · POSTIZ-001 · ANALYTICS-AI-001 · CF-HOST-001 · AI-GATEWAY-001 · Photography/Video Expert · Production Supervisor.

### Build next (implementation, not more Linear cleanup)

```text
AUTH-001 → APP-001 → (BRAND-001 ∥ SHOOT-001) → HOME-001
→ BRAND-INTEL-001
→ PLAN-001 → APPROVAL-001 → SHOOT-SAVE-001 → SHOOT-WIZARD-001
→ BOOKING-DATA-001 (shoot_id) · TALENT screens · BOOKING-AI · PAYMENT
→ ASSETS list/detail → MEDIA upload/review/deliver
```

---

## ipixai today vs old React

| Layer | Old `/home/sk/ipix` | New ipixai |
|-------|---------------------|------------|
| Operator routes | 31 pages | Effectively **none** (starter `src/app/page.tsx`) |
| CopilotKit/Mastra | Full agent registry | Foundation Planner path (tickets) |
| Design tokens | Old app + UDP4 | DESIGN-001 **Done** |
| Cloudinary | URLs, upload agent, channel studio | Not in v2 Linear |
| Stripe / Postiz | Absent | Absent |

**Faster path:** COPY+CLEAN operator screens from the permitted GitHub source [amoai-tech/luminaai](https://github.com/amoai-tech/luminaai) at SHA `b2d3de8e5` (same tree as a local `/home/sk/ipix` checkout). **Do not implement from a private `/home/sk/ipix` path** (`AGENTS.md`). Drop Worker/secrets/fixtures as listed below. Do not re-implement Command Center from HTML.

## Caveats

- `Universal-design-prompt-4/progress-tracker.md` (2026-07-12) is **stale** — it still calls Campaigns/Assets/Planner “placeholders.” Current React has real workspaces. Trust [amoai-tech/luminaai](https://github.com/amoai-tech/luminaai) SHA `b2d3de8e5` and live Linear, not that tracker and not “whatever is dated 2026-08-30.”
- Booking **RPCs** (`check_talent_availability`, `create_booking_request`, `get_booking`, `transition_booking`) **are wired** in current React. Design registry “RPC 🔴” is outdated. Stripe deposit is still missing.
- HTML `.dc.html` is a clickable prototype with `support.js`, not production. Matching it 100% was never the bar; **production-usable React** is.
- Do not copy old Cloudflare Workers Mastra into Core.
- Never combined `npm run dev`; never production Supabase writes for this audit.

## Verification (errors, failed ports, Linear + luminaai changes)

Re-checked **2026-08-30**. Scores stay file-evidence grades, not a browser pixel audit.

### Audit errors (corrected in this file)

| Claim that was wrong | Evidence | Fix |
|----------------------|----------|-----|
| `Pages/` has 31 `.dc.html` files | Glob = **38** HTML files | Count updated |
| `visual-identity` owns Assets | `resolveAgentId`: `/app/assets` → **`creative-director`**; `/app/preview` → `visual-identity` | Agent table updated |
| `social-discovery` owns Matching | Matching → **`model-match`**. `social-discovery` runs inside brand-intelligence workflow | Agent table updated |
| Booking RPCs still incomplete | Linear IPI-1071 + live routes: create/get/transition RPCs exist. **Stripe still absent** | Do not treat booking UI as unwired |
| HOME-001 must load Planner architecture | Linear IPI-1066 **Mastra NONE** means: do not rebuild Command Center from CopilotKit **examples**. Rail already belongs to **APP-001** | HOME = COPY+CLEAN page; dashboard questions = shell context, not a Home Agent ticket |
| IPI-1076 tracker “DESIGN-001 In Progress” | Live Linear: **IPI-1080 · DESIGN-001 is Done** | Epic body is stale |
| Talent profile is a first-class `[id]` route | Only `/app/matching/talent/[id]/book` + `/app/talent/profile?talentId=` | Linear IPI-1071 already requires URL rebuild |

**Confirmed true:** 31 operator `page.tsx`; no `/app/model`, `/app/roster`, `/app/activity`; wizard **6** HITL steps; analytics `reach: null`; **zero** Stripe/Postiz in `app/src`; GitHub `amoai-tech/luminaai` SHA matches local `/home/sk/ipix`; origin remote is still `amo-tech-ai/lumina-studio` (Linear file links use that tree).

### Failed ports (will break ipixai if copied blindly)

These are **not** screen rebuilds. They are runtime/secrets/fixtures that must be stripped or replaced.

| Do not copy from luminaai | Why it fails in ipixai | Owner ticket |
|---------------------------|------------------------|--------------|
| `?skip=1` / `?skip=approval` Command Center fixtures | Fake dashboard in production | HOME-001 (already: do not port) |
| Cloudflare Worker image signing / Worker secrets | Different host; leak risk | MEDIA-CLOUDINARY-001 — Node signing |
| DurableAgent, ALS, Hyperdrive, OpenNext, custom SSE | Old Worker Mastra path | Keep Node Mastra in ipixai |
| `resourceId: "default"` | Cross-org thread leak | AUTH / STREAM tickets |
| Service-role in the browser | RLS bypass | APP-001 / data tickets |
| Disabled Matching tabs as live | No backend | [IPI-1071 · TALENT-BOOKING-001](https://linear.app/amo100/issue/IPI-1071) (already: leave off) |
| HTML `.dc.html` as implementation source | Rebuild tax | IPI-1076 reuse rule (keep) |
| `/app/planner*` as the Core AI Planner | Second brain | PLANS-001 stays M4 workspace |
| Invented analytics KPIs | Linear already forbids | ANALYTICS-001 |
| Talent self-serve onboarding inside [IPI-1071 · TALENT-BOOKING-001](https://linear.app/amo100/issue/IPI-1071) | Ticket correctly excludes it | Post-MVP / ONBOARD split |

### What to change on **luminaai** screens (`amoai-tech/luminaai` / `/home/sk/ipix`)

Do **not** restyle 90/100 lists. Change only if the old app must stay in production **or** the port needs a cleaner source.

| Screen | Change in luminaai? | Why |
|--------|---------------------|-----|
| Brand List, Shoots List, CRM lists | **No** functional rewrite | 90/80 scores; COPY+CLEAN to ipixai |
| Command Center | Optional: delete `?skip=*` from **product** paths now | Stops fixture leaking into ports |
| Talent profile | **Yes if still shipping old app:** add `/app/matching/talent/[id]` (querystring today) | IPI-1071 AC; cleaner port |
| Matching | **No** — keep extra tabs disabled | Correct |
| Shoot Wizard | **No** 10-step HTML restore in luminaai | Extra steps belong in **IPI-1085** on ipixai |
| Shoot Detail | Optional later: lifecycle tabs | SHOOT-001 / Launch, not a luminaai emergency |
| Assets | Keep slim detail; don’t fake delivery | MEDIA-001 is new capability |
| Planner settings | Keep Coming soon tabs | Honest |
| Availability / Role dashboards / `/app/activity` | **Don’t invent in luminaai** unless product still ships there | New v2 tickets |
| Cloudinary Worker signing | Replace only when ipixai media ticket lands | Don’t dual-write secrets |

Default: **freeze luminaai UI**, port COPY+CLEAN into ipixai, extend there.

### Linear tasks — applied (see §7)

The “not mutated yet” table is **obsolete**. Live v2-ipix now has scope locks, M3A/M3B, created IPI-1093–1097, journey Gantt on IPI-1076, and Mastra NONE kept on IPI-1071.

**IPI-1076 vs child milestones (resolved):** IPI-1071 and IPI-1069 are **M3**. Inbox/CRM/Analytics/Plans remain **M4**. Talent UI may start after APP; `booking.shoot_id` waits on IPI-1094.

### Suggested improvements (priority) — remaining only

1. Do **not** create STUDIO-001 until both are proven: a saved booking with **non-null `shoot_id`**, and the linked talent readable. That gate is **NOT VERIFIED** here. CHANNEL-PREVIEW-001 / CAMPAIGN-001 / PUBLISH-001 / POSTIZ-001 only when the preceding journey needs them (parent: [IPI-1105 · CAMPAIGNS & PUBLISHING](https://linear.app/amo100/issue/IPI-1105) only).  
2. In luminaai, only **talent profile URL** is a justified source-repo change before port.  
3. Port Command Center **without** skip fixtures.  
4. Do not restore 13-step onboarding or 10-step wizard HTML unless IPI-1085 still wants those extra HTML rooms.

## Related canvas

**Local-only** (not in this repository; not a shared SSOT). An interactive table/phase map may exist as a Cursor canvas on the author’s machine. Do not link machine paths here; this markdown file is the checked-in audit.

---

## HTML design vs luminaai React — are screens 100% complete and correct?

**Short answer: no.** Zero operator screens are 100% complete **and** 100% faithful to Universal-design-prompt-4. Several are **production-usable** (real routes, Supabase, CopilotKit agent map, tests). The HTML pack is the **lookbook**; React is the **working apartment** — same address, fewer rooms, some rooms half-furnished.

Think of the HTML as a **show-home brochure**: every room is staged. React is the **house people live in**: kitchen and bedrooms work; the wine cellar (13-step onboarding, 10-step wizard, Postiz, Stripe, role dashboards) was never built.

### What was counted

| Pack | Count | Notes |
|------|------:|-------|
| `Pages/*.dc.html` + INDEX + Component Library | 38 HTML files | 5 are mobile galleries / bottom sheet, 1 is DEMO-360, 1 is component gallery |
| Shared `components/*.dc.html` | 20 | Shell + cards + HITL + mobile |
| Operator `page.tsx` in luminaai | 31 | Includes CRM hub redirect |

### Verdict legend

| Grade | Meaning |
|-------|---------|
| **Usable** | Real route + real data (or honest empty) + CopilotKit agent on path. Safe to COPY+CLEAN. |
| **Scoped** | Works but smaller than HTML (fewer steps/tabs). |
| **Partial** | Route exists; major HTML sections missing or “Coming soon”. |
| **Missing** | HTML exists; no dedicated React route (or agent map only). |
| **Prototype-only** | HTML / gallery; not a product screen. |

**100% complete + correct vs HTML: none.** Closest usable: Brand List and Shoots List (**9/10** complete, **90/100**).

### Scoring rubric (file evidence, not a browser pixel audit)

Think of **complete** as “how much of the brochure room was built” and **correct** as “does the built room actually work (real data, honest empty, right agent).”

| Score | Complete /10 | Correct /10 |
|-------|----------------|-------------|
| 9–10 | Almost all HTML sections exist | Real Supabase/RPC, fail-closed, no fake KPIs |
| 7–8 | Main journey works; extras missing | Wired; small stubs or unmapped agent |
| 4–6 | Clearly scoped down vs HTML | Partial data or “Coming soon” on purpose |
| 1–3 | Stub / other screen only | Logic exists elsewhere (e.g. RPC without page) |
| 0 | No React surface | Nothing to judge |

**Formulas**

- **Estimated migration coverage** (`% complete` in the table) = Complete × 10  
- **Static confidence** (`% correct`) = Correct × 10  
- **Portfolio estimate /100** = (Complete × 5) + (Correct × 5)  
- **Estimated migration gap** (`Still to do %`) = 100 − Score/100. Not “delete and rebuild.”

**Catalog average (31 product screens, excluding galleries/DEMO):** **69/100 composite** ((Complete+Correct)/2). Mean **% complete** (UI coverage) is **~64%**; mean **% correct** is **74.84% (rounded to ~75%)**. Do not use 69 as UI-coverage. **Composite gap vs 100:** **31%**; **UI-coverage gap:** **~36%**. These are **planning estimates**, not verified implementation completeness. A browser + DB + user-flow audit would be required for true readiness.

**NOT VERIFIED:** live click-through of every HITL gate; visual pixel match.

### Scores — each screen

**Already in React** = what to reuse (do not rebuild). **Remaining work** = the next honest gap. **Still to do %** = size of that gap.

**Design-registry IDs not scored here (no dedicated luminaai product route):** SCR-12 Product Catalog (`/app/catalog`), SCR-13 Collections/Seasons (`/app/collections`), SCR-14 Asset→PDP crops (`/app/assets/pdp`), SCR-19 Event Management (`/app/events`). Treat as **out of scope for this port** — do not invent tickets from the HTML registry alone.

| SCR | Screen | Complete /10 | Correct /10 | Score /100 | % complete | % correct | Still to do % | Already in React (reuse) | Remaining work |
|-----|--------|:---:|:---:|:---:|:---:|:---:|:---:|---|---|
| 01 | Command Center | 8 | 8 | 80 | 80 | 80 | 20 | Live KPIs, 3-panel shell, Planner chat | Attention rail; fill “Coming soon” intel sections; dashboard-context prompts |
| 02 | Brand List | 9 | 9 | 90 | 90 | 90 | 10 | List + scores, brand-intelligence agent | Pixel/a11y polish only — do not rebuild |
| 03 | Brand Detail | 8 | 9 | 85 | 80 | 90 | 15 | Profile, DNA, reanalyze + intel HITL APIs | URL → approved DNA as first-class journey (BRAND-INTEL-001) |
| 04 | Shoots List | 9 | 9 | 90 | 90 | 90 | 10 | Portfolio view, Planner agent | Filters/empty polish only |
| 05 | Shoot Detail | 7 | 8 | 75 | 70 | 80 | 25 | Record + RPC, some tabs, page context | Lifecycle tabs (bookings, location, equipment, delivery); enable disabled actions |
| 06 | Shoot Wizard | 6 | 8 | 70 | 60 | 80 | 30 | 6-step HITL (deliverables/shots/budget) + commit | Purpose, photo/video, production reqs, booking handoff; HTML moodboard/call sheet only if roadmap still wants them |
| 07 | Campaigns | 6 | 7 | 65 | 60 | 70 | 35 | Live list/cards, Creative Director, draft brief | Campaign→shoot→assets workspace; replace rail placeholders; no silent saves |
| 08 | Assets | 5 | 7 | 60 | 50 | 70 | 40 | Library + slim Cloudinary detail, DNA tools | Upload→approve→deliver; channel variants; Postiz is later |
| 09 | Matching | 6 | 8 | 70 | 60 | 80 | 30 | Talent search/shortlist RPCs, model-match | Enable Creator/Asset/Product only if needed; keep talent as COPY+CLEAN |
| 10 | Channel Preview | 7 | 8 | 75 | 70 | 80 | 25 | Spec frames + Cloudinary crops | Formal channel matrix; schedule/publish (Post-MVP) |
| 11 | Brand Onboarding | 4 | 7 | 55 | 40 | 70 | 45 | Short form, org/brand insert, crawl | Do not copy 13 HTML screens; add URL intel + HITL draft |
| 15 | Notification Center | 7 | 8 | 75 | 70 | 80 | 25 | Inbox list + `list_notifications` | Bell/slide-over; map a dedicated agent only if inbox needs one |
| 16 | Analytics | 5 | 9 | 70 | 50 | 90 | 30 | Honest counts; social KPIs **null** (not fake) | Keep null until real metrics; Analytics Agent later |
| 17 | Campaign Performance | 5 | 8 | 65 | 50 | 80 | 35 | Campaign picker + real rows | Channel/performance facts from data, never invented |
| 18 | Collaboration / Activity | 2 | 4 | 30 | 20 | 40 | 70 | CRM/shoot activity tabs only | New `/app/activity` hub or keep tabs — don’t fake a feed |
| 20 | Talent Profile | 7 | 7 | 70 | 70 | 70 | 30 | Profile workspace + Cloudinary | Availability on profile; operator vs model modes |
| 21 | Booking Wizard | 8 | 8 | 80 | 80 | 80 | 20 | Availability check + create request + booking agent | Studio/location, conflicts, Stripe deposit — new capability, not a UI rewrite |
| 22 | Booking Detail | 9 | 8 | 85 | 90 | 80 | 15 | Get/transition/confirm RPCs | Call times, deposit status, production coordination |
| 23 | Availability Editor | 2 | 6 | 40 | 20 | 60 | 60 | RPC inside booking wizard | Dedicated month editor + shared availability contract |
| 24 | Talent Onboarding | 6 | 7 | 65 | 60 | 70 | 35 | Wizard + role gate | URL-context fields; HITL on AI-extracted data |
| 25 | Role Dashboards | 0 | 0 | 0 | 0 | 0 | 100 | Agent map only (`/app/model`, `/app/roster`) | Build only if model/agency product is in MVP; else defer |
| 26 | CRM Companies List | 8 | 8 | 80 | 80 | 80 | 20 | List RPCs, crm-assistant | Restore dropped chips if operators still need them |
| 27 | CRM Company Detail | 8 | 8 | 80 | 80 | 80 | 20 | 360° + timeline | AI relationship-summary only with a real RPC |
| 28 | CRM Contacts List | 8 | 8 | 80 | 80 | 80 | 20 | jsonb contact arrays | Same chip/filter polish as companies |
| 29 | CRM Contact Detail | 8 | 8 | 80 | 80 | 80 | 20 | Person 360° | Linked-deal completeness |
| 30 | CRM Pipeline | 8 | 8 | 80 | 80 | 80 | 20 | 6-stage kanban | Replace 14-day “at risk” heuristic with a real score when data exists |
| 31 | CRM Deal Detail | 7 | 7 | 70 | 70 | 70 | 30 | `getDealDetail` workspace (July stub is stale) | Verify won/lost HITL in browser; EvidenceBlock |
| 32 | Planner Workspace | 7 | 7 | 70 | 70 | 70 | 30 | Timeline/Kanban/Calendar/List reads | Finish mutations; don’t make this a second Planner brain |
| 33 | Planner Dashboard | 6 | 7 | 65 | 60 | 70 | 35 | Route + queries | Role KPIs; keep Command Center as operator home |
| 34 | Planner Settings | 4 | 8 | 60 | 40 | 80 | 40 | Members tab; other tabs honestly disabled | Notifications/Workflow/Danger when there is a real backend |
| 35 | Planner Hub | 8 | 8 | 80 | 80 | 80 | 20 | Server list + filters | Clarify vs Copilot Planner: this is saved plans, not chat |

### Scores — HTML-only / not product routes

| Item | Complete /10 | Correct /10 | /100 | Still to do % | Already in React | Remaining work |
|------|:---:|:---:|:---:|:---:|---|---|
| DEMO-360 Agency | 0 | n/a | 0 | — | Nothing (template HTML) | Do not port; CRM 360 covers the pattern |
| SCR-MOBILE Gallery (5 files) | 1 | 3 | 20 | 80 | Incidental `sm:`/`md:` | Shared mobile shell (nav + sheet) once, not 5 galleries |
| INDEX.html / Component Library.dc.html | n/a | n/a | — | — | Design index only | Use as visual reference, not a route |

### Scores — shared HTML components vs React

| Component | Complete /10 | Correct /10 | /100 | Still to do % | Already in React | Remaining work |
|-----------|:---:|:---:|:---:|:---:|:---:|---|
| OperatorShell | 8 | 8 | 80 | 20 | 3-panel + CopilotKit provider | Route context slot (brand/shoot/booking) for APP-001 |
| NavSidebar | 8 | 8 | 80 | 20 | Icon nav, brand switcher | Align labels to new journey, not extra apps |
| IntelligencePanel | 6 | 7 | 65 | 35 | Briefing + approvals | Replace campaign “Coming soon”; L2 attention questions |
| PersistentChatDock | 8 | 8 | 80 | 20 | CopilotKit v2 dock | Keep one Planner; don’t add a Home Agent |
| PageHeader | 7 | 7 | 70 | 30 | Per-page headers | Optional shared primitive — not a rebuild |
| BrandCard | 8 | 8 | 80 | 20 | Brand list/CC cards | Token pass onto ipixai |
| ShootCard | 8 | 8 | 80 | 20 | Shoots list cards | Same |
| CampaignCard | 7 | 7 | 70 | 30 | Campaigns workspace | Deliverable snippets if missing vs HTML |
| AssetCard | 6 | 7 | 65 | 35 | Library thumbs | DNA badges + channel crop hint |
| ApprovalCard | 8 | 8 | 80 | 20 | Shoot HITL + planner gates | Reuse for booking/DNA writes |
| EvidenceBlock | 6 | 7 | 65 | 35 | Exists | Use on brand/assets/matching where HTML specified |
| SearchBar / FilterBar | 7 | 7 | 70 | 30 | Inline per list | Shared FilterBar only if lists drift |
| WizardStep | 6 | 8 | 70 | 30 | 6-step rail | Extra steps = wizard ticket, not a new stepper library |
| StatusChip | 9 | 9 | 90 | 10 | `ui/status-chip` + DESIGN-001 | Copy into ipixai; done |
| SkeletonLoader | 9 | 9 | 90 | 10 | `ui/skeleton` | Copy; done |
| EmptyState | 9 | 9 | 90 | 10 | `ui/empty-state` | Copy; done |
| AgentStatusIndicator | 4 | 6 | 50 | 50 | Copilot streaming chrome | Optional idle/busy dot — low priority |
| BottomNavigation | 2 | 3 | 25 | 75 | Mobile sign-out / rail hide | One mobile tab bar when operator is phone-first |
| BottomSheet | 3 | 4 | 35 | 65 | shadcn sheet in places | One sheet primitive for intel/filters on small screens |

### How to read **Still to do %**

| Still to do % | Meaning |
|---------------|---------|
| 10–20 | COPY+CLEAN the React; light polish |
| 25–40 | **Extend** the same React (tabs, steps, delivery) |
| 60–100 | **New screen or capability** (not a rebuild of a 80+ screen) |

Do **not** spend remaining work on rebuilding Brand List from HTML to chase 100. Spend it on 0–40 scores and on Stripe / Cloudinary delivery / Brand Intelligence.

### Screen-by-screen (HTML → React)

| SCR | HTML file | React | FE vs HTML | Backend / data | Agent (CopilotKit `resolveAgentId`) | Workflows | Grade | 100%? |
|-----|-----------|-------|------------|----------------|-------------------------------------|-----------|-------|-------|
| 01 | `Command Center.v2.image-first.dc.html` | `/app` + `fetchCommandCenterKpis` | 3-panel shell matches; some rail sections “Coming soon” | Supabase brands + KPIs | `production-planner` (default) | — | Usable | **No** |
| 02 | `Brand List.v2.image-first.dc.html` | `/app/brand` | High | `brands` + `brand_scores` | `brand-intelligence` | Brand intel HITL APIs exist | Usable | **No** (parity not pixel-audited) |
| 03 | `Brand Detail.v2.image-first.dc.html` | `/app/brand/[id]` | High; DNA/health | Parallel queries + reanalyze action | `brand-intelligence` | `brand-intelligence` start/resume/approve | Usable | **No** |
| 04 | `Shoots List.v2.image-first.dc.html` | `/app/shoots` | High | `shoot_portfolio_view` | `production-planner` | — | Usable | **No** |
| 05 | `Shoot Detail.v2.image-first.dc.html` | `/app/shoots/[shootId]` | Tabs exist; not full HTML tab set / some actions disabled | `get_shoot_detail` RPC | `production-planner` | Page context tools | Scoped | **No** |
| 06 | `Shoot Wizard.v2.image-first.dc.html` | `/app/shoots/new` | **6 steps** (Basics→Brief→Deliverables→Shots→Budget→Confirm) vs HTML **~10** (no moodboard/timeline/call sheet) | Mastra shoot-wizard + `/api/shoots/commit` | `production-planner` | `shoot-wizard` HITL 3 gates | Scoped | **No** |
| 07 | `Campaigns.v2.image-first.dc.html` | `/app/campaigns` | List/filter/cards; intel rail campaign subsections placeholder | `campaigns` + `campaign_deliverables` | `creative-director` | `draftCampaignBrief` (draft only) | Scoped | **No** |
| 08 | `Assets.v2.image-first.dc.html` | `/app/assets` + `[id]` | Library + **slim** detail (comment: Supabase mirror only) | `listAssets` / `getAssetDetail` + Cloudinary URLs | `creative-director` | DNA tools; no full delivery/Postiz | Partial | **No** |
| 09 | `Matching.v2` + `SCR-09-Matching-Talent.dc.html` | `/app/matching` | Talent tab live; Creator/Asset/Product **disabled** | `search_talent` / shortlist RPCs | `model-match` | — | Scoped | **No** |
| 10 | `Channel Preview.v2.image-first.dc.html` | `/app/preview` | Spec-driven frames | `getAllChannelSpecs` + Cloudinary | `visual-identity` | No Postiz publish | Usable (preview only) | **No** |
| 11 | `Onboarding.v2.zeely.dc.html` | `/app/onboarding` + standalone | Light form vs HTML **13-screen** wizard | Org/brand insert + crawl/intel | `brand-intelligence` | start-brand-crawl / intel | Scoped | **No** |
| 15 | `SCR-15-Notification-Center.dc.html` | `/app/inbox` | Workspace list | `list_notifications` RPC | default Planner (not mapped) | — | Usable | **No** (not full bell+slide-over HTML) |
| 16 | `Analytics.v2.image-first.dc.html` | `/app/analytics` | KPI cards; **reach/CTR/etc. explicitly null** (honest, not fake) | campaigns/assets/`brand_scores` counts | default Planner | No Analytics Agent | Scoped | **No** |
| 17 | `Campaign Performance.v2.image-first.dc.html` | `/app/analytics/campaigns` | Campaign picker + payload | `campaigns` rows | default Planner | — | Scoped | **No** |
| 18 | `Activity & Audit` / `SCR-18-Collaboration-Audit.dc.html` | **No `/app/activity`** | CRM + shoot activity tabs only | CRM `logActivity` | — | — | Missing as screen | **No** |
| 20 | `SCR-20-Talent-Profile.dc.html` | `/app/talent/profile` | Workspace exists | talent profile + Cloudinary | `model-match` | — | Usable | **No** |
| 21 | Booking = wizard `flow=booking` | `/app/matching/talent/[id]/book` | Real wizard | availability + `create_booking_request` | `booking` | booking agent | Usable | **No** (no Stripe) |
| 22 | Shoot Detail `flow=booking` | `/app/bookings/[id]` | Real detail | `get_booking` / `transition_booking` / `confirm_booking` | `booking` | — | Usable | **No** |
| 23 | `SCR-23-Availability-Editor.dc.html` | **No dedicated page** | — | RPC used inside booking wizard | — | — | Missing screen | **No** |
| 24 | `SCR-24-Talent-Onboarding.dc.html` | `/app/talent/onboarding` | Wizard + role gate | `get_own_talent_profile` | `model-match` | URL-context in design; verify depth NOT pixel-checked | Scoped | **No** |
| 25 | `SCR-25-Role-Dashboards.dc.html` | **No `/app/model` or `/app/roster` pages** | Agent map lists them | — | `booking` if those URLs existed | — | Missing | **No** |
| 26–30 | SCR-26…30 CRM lists/details/pipeline | `/app/crm/*` | Strong; some chips/AI cards dropped | list/get RPCs | `crm-assistant` | CRM tools | Usable / Scoped | **No** |
| 31 | `SCR-31-CRM-Deal-Detail.dc.html` | `/app/crm/pipeline/[id]` | **Now real** `getDealDetail` (July tracker 🔴 is wrong) | deal detail query | `crm-assistant` | won/lost HITL in design — confirm full gate NOT VERIFIED in browser | Usable | **No** |
| 32 | `SCR-32-Planner-Workspace.dc.html` | `/app/planner/[instanceId]` | Timeline/Kanban/Calendar/List **shipped** | planner schema + queries + gates overlay | `production-planner` | Mutations still called out as later tickets in file comments | Partial | **No** |
| 33 | `SCR-33-Planner-Dashboard.dc.html` | `/app/planner/dashboard` | Route exists | planner queries | `production-planner` | — | Scoped | **No** |
| 34 | `SCR-34-Planner-Instance-Settings.dc.html` | `.../settings` | **Members only**; Notifications/Workflow/Danger **Coming soon** | members | `production-planner` | — | Partial | **No** |
| 35 | `SCR-35-Planner-Hub.dc.html` | `/app/planner` | Server list + filters | `listPlannerInstances` | `production-planner` | — | Usable | **No** |
| — | `DEMO-360-Agency.dc.html` | none | Template demo | — | — | — | Prototype | n/a |
| — | 5× `SCR-MOBILE-*` | no dedicated mobile gallery / BottomNavigation as designed | incidental `sm:`/`md:` | — | — | — | Missing | **No** |

### Shared HTML components → React

| HTML component | React equivalent | Complete vs HTML? |
|----------------|------------------|-------------------|
| OperatorShell | `operator-panel.tsx` 3-panel + CopilotKit | **Usable**, not identical CSS |
| NavSidebar | `nav-sidebar.tsx` | Usable |
| IntelligencePanel | `intelligence-panel/` | Partial — `PanelSectionComingSoon` for campaign health/deliverables/approvals |
| PersistentChatDock | `operator-chat-dock` + CopilotKit v2 | Usable (experimental in design docs) |
| PageHeader / SearchBar / FilterBar | Inline per workspace | Pattern reused, not 1:1 DC imports |
| BrandCard / ShootCard / CampaignCard / AssetCard | Feature folders | Usable |
| ApprovalCard | `approval-card` + shoot HITL cards | Usable on planner/shoot |
| EvidenceBlock | `evidence-block` | Present; not on every HTML-listed screen |
| StatusChip / Skeleton / EmptyState | `components/ui/*` | Usable — also in ipixai DESIGN-001 |
| WizardStep | Shoot wizard `StepRail` | Scoped to 6 steps |
| AgentStatusIndicator | Copilot streaming UI | Partial |
| BottomNavigation / BottomSheet | `mobile-sign-out-bar`, CSS rail hide — **not** the HTML mobile shell | **No** |
| Component Library.dc.html | n/a | Design gallery only |

### Frontend state / CopilotKit

- Shell always sets `CopilotChatConfigurationProvider agentId={resolveAgentId(pathname)}`.
- Brand/shoot inject page context (`brand-list-context`, `shoot-detail-context`).
- Threads drawer exists. Inbox/analytics/preview fall through to **Production Planner** unless path is in the map.
- **No** Photography Expert / Video Expert agents.

### Backend / agents / workflows (luminaai)

| Exists and used | Gap vs HTML / new roadmap |
|-----------------|---------------------------|
| Supabase tables + RPCs for brands, shoots, CRM, bookings, notifications, planner, assets | Stripe, Postiz, studio marketplace, availability **editor** screen |
| Mastra: planner, brand-intelligence, booking, creative-director, visual-identity, model-match, crm-assistant, public-marketing | Public chatbot not MVP; social-discovery unused on matching |
| Workflows: shoot-wizard HITL, brand-intelligence HITL | Wizard missing HTML production-plan steps; booking has no payment webhook |

### What to reuse for ipixai

Reuse **React**, not HTML, for every **Usable/Scoped** row. Use HTML only where React is **Missing** (availability editor, role dashboards, collaboration hub, mobile galleries) or to fill **scoped-down** wizard/onboarding steps **if** the new roadmap still wants those steps.

HTML is **not** a second implementation to “finish to 100%” before porting. Port the working React, then extend capabilities.
