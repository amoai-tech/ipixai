  ---
  title: Brand journey — consolidated spec (iPixai)
  status: Canonical living spec (dumps archived)
  checked: 2026-09-01
  parent: docs/copilotkit-mastra/prd.md §5b
  horizon: After IPI-1041 · CORE-001
  ---

  # Brand journey (one loop)

  **Read this file.** Historical dumps: [../archive/copilotkit-mastra/brand/](./brand). Product requirements stay in [prd.md](./prd.md) §5b. Ticket **status** is live Linear. Ticket **minting** is [todo.md](./todo.md). Host is **Vercel**, not Cloudflare Workers.

  Think of Brand Intelligence as a **recipe card the whole kitchen uses**, not a binder on a shelf. A logo pack is ingredients in the fridge. The Brand Brain is the card: how it should look, sound, sell, and what is forbidden — then every agent cooks from that card.

  **Do not start this while [IPI-1041 · CORE-001](https://linear.app/amo100/issue/IPI-1041) is red.** Until then, `default` is Production Planner only ([IPI-1048 · PLANNER-001](https://linear.app/amo100/issue/IPI-1048)).

  **Do not implement** [19-brand-lifecycle.md](./brand/19-brand-lifecycle.md) (old **IPI-46** / edge-fn crawl). **Do not mint** a 12-agent Brand Profile fleet from [brand-profile-intelligence-platform.md](./brand/brand-profile-intelligence-platform.md). **Do not treat** [brand-journey-todo.md](./brand/brand-journey-todo.md) as Linear.

  Example operator: **Maison Solène** (jewellery) or **AURA** (womenswear). Website in → a season that made money out.

  ---

  ## Hard rules

  | Do | Don't |
  | --- | --- |
  | AI proposes → human approves → trusted RPC writes | Silent DNA or campaign writes |
  | Browser `brandId` is a **hint** | Authorize from the URL |
  | pgvector after org/brand RLS | Treat a vector hit as permission |
  | Ask “what do we already have?” in Cloudinary first | Generate a new shoot every campaign |
  | Charts empty or real ([IPI-1073 · ANALYTICS-001](https://linear.app/amo100/issue/IPI-1073)) | Fake “why it sold” until **LEARN-001** |
  | Postiz / Stripe only after HITL | Chat-button publish or charge |
  | One vertical loop | One giant “Brand Intelligence product” |

  ---

  ## The loop

  ```text
  Learn brand → Market → Opportunity → Strategy → Campaign plan
    → Reuse assets / shoot the gap → Create → Brand check → Approve
    → Publish → Measure → Optimize → Learn (DNA HITL) → next campaign
  ```

  ```mermaid
  flowchart LR
    Learn[Learn Brand Brain] --> Market[Market]
    Market --> Opp[Opportunity]
    Opp --> Strat[Strategy]
    Strat --> Plan[Campaign plan]
    Plan --> Assets[Reuse or shoot gap]
    Assets --> Create[Create]
    Create --> HITL[Brand check + approve]
    HITL --> Pub[Postiz]
    Pub --> Meas[Analytics]
    Meas --> Learn2[Learn DNA]
    Learn2 --> Learn
  ```

  Maison Solène: paste the site → draft “minimal, no discount language, gifts under $80” → operator **rejects** “luxury only” → later Instagram gift play scores highest → Cloudinary already has 3 heroes → gap list feeds **Production Planner** (not a second planner) → creative director Approves v3 → Postiz Thursday 10:00 ET → Stripe maps SKU to campaign → HITL to add “gift under $80” to DNA.

  ### Operator journey (20 steps — one loop, not 20 tickets)

  Teach the brand **once**. Every shoot, asset, and campaign agent uses the **same approved Brain**. Do not mint one Linear issue per row.

  | # | Operator | iPix |
  | --: | --- | --- |
  | 1 | Adds brand + website | Org-owned brand row (**IPI-1089**, **IPI-1068**) |
  | 2 | Connects site, guide, socials, catalog | Draft Brain: identity, voice, visual, products, audiences (**IPI-1093**) |
  | 3 | Corrects / approves | HITL persist + evidence URLs — never silent DNA |
  | 4 | Connects / uploads media (anytime) | Cloudinary + Supabase; approved versions only |
  | 5 | Adds competitors / markets | Research with sources — not vibes |
  | 6 | Reviews ranked plays | Opportunity scores are **iPix** (trend / brand fit / audience / gap) |
  | 7 | States the goal | Measurable objective |
  | 8 | Reviews strategy | Audience, message, channels, KPIs on shared state |
  | 9 | Approves campaign plan | Calendar, deliverables, need-list |
  | 10 | Reviews creative brief | Shot/content requirements from **Brain + strategy** — feeds Planner, **not** a second planner |
  | 11 | Picks existing vs gap | “What do we already have?” then missing close-ups / vertical video |
  | 12 | Requests the package | Channel copy + named-transform crops from **approved** binaries |
  | 13 | Reviews Brand Check | Voice, visual, claims, audience, channel — **advisory score**, not auto-publish |
  | 14 | Approves / rejects / edits | Exact copy + **exact Cloudinary version** locked |
  | 15 | Picks dates / channels | **Postiz** for social. Web/email/ecom later — iPix stays approval truth. No chat-button publish |
  | 16 | Watches the campaign | Real reach/CTR or honest empty (**IPI-1073**) |
  | 17 | Asks what worked | Winners by audience / creative / asset / channel — no invented revenue |
  | 18 | Approves optimize | Next variants / mix — still HITL |
  | 19 | Reviews DNA diffs | **LEARN-001** proposes; human writes Brain |
  | 20 | Plans the next season | Starts from approved Brain + rack, not a blank chat |

  ---

  ## Stages × Linear

  Empty **[IPI-1105 · CAMPAIGNS & PUBLISHING](https://linear.app/amo100/issue/IPI-1105)** has **zero children**. Duplicate-search, then mint ([todo.md](./todo.md) **Add later**). Do not invent `IPI-XXX` in chat.

  | Stage | Operator sees | System | Live / mint later |
  | --- | --- | --- | --- |
  | Add brand | Org owns a brand row | Onboarding + Brand UI | **IPI-1089 · ONBOARD-001**, **IPI-1068 · BRAND-001**, epic **IPI-1099** |
  | Brand Intelligence | Draft DNA + sources | Firecrawl + Gemini URL → draft only | **IPI-1093 · BRAND-INTEL-001** (not historical **IPI-656**) |
  | Approve Brand Brain | Human edits; nothing auto-writes | CopilotKit HITL + RPC | Same pattern as **IPI-1084**; DNA write is trusted RPC |
  | Brand knowledge | “Does this look fit AURA?” with citations | pgvector **after** RLS | **BRAND-KNOWLEDGE-001** after Core under **IPI-1099** |
  | Market + opportunity | Ranked plays with evidence | Research agent; scores are iPix | **BRAND-RESEARCH-001**, **BRAND-OPPORTUNITY-001** |
  | Strategy | Objective, audience, message, channels, KPIs | CopilotKit shared state | **CAMPAIGN-STRATEGY-001** under **IPI-1105** |
  | Campaign plan | Calendar, deliverables, asset need-list | canvas/mastra-pm style | **CAMPAIGN-PLAN-001** |
  | Assets | Existing vs gap | Cloudinary search + named transforms | **IPI-1108…1120** ∥ **MEDIA-AGENT-001** |
  | Shoot the gap | Typed ShootPlan | Core Planner + **IPI-1081 / 1083 / 1085** | Do not invent a second planner |
  | Create | Channel copy + crops from **approved** binaries | Ad-copy template / Cloudinary | **CAMPAIGN-COPY-001**, **CHANNEL-PREVIEW-001** |
  | Brand check + approve | Voice/visual/claims; exact version lock | HITL; zero Postiz until Approve | **IPI-1084** / **IPI-998** — do not overload shoot HITL with publish |
  | Publish | Schedule IG/web | Postiz only | **PUBLISH-001** / **POSTIZ-001** |
  | Analytics | Real numbers or honest empty | Charts = **IPI-1073** | Stripe + Postiz ids |
  | Learn | Proposed DNA edits from what sold | HITL before DNA write | **LEARN-001** — not **IPI-1073** |

  **KEEP** the production kitchen (auth, Planner, Cloudinary). **CHANGE** **IPI-1093** to full Brand Brain + HITL; **IPI-1081** stays *shoot* plan, not IG calendar. **DEFER** CRM / Inbox / public marketing site. **REMOVE** from this spine: duplicate marketing tickets **IPI-1054–1062**; OpenClaw/Hermes as a second runtime.

  ---

  ## Brand Brain (what “intelligence” means)

  Not: name + logo + one color.

  | Layer | Store | Sources |
  | --- | --- | --- |
  | Identity | name, tagline, story, mission, values, positioning, personality, differentiators | site, brand guide |
  | Voice | tone, vocabulary, editorial rules, prefer / forbidden terms, CTA style | site, past campaigns |
  | Visual | logos + spacing/variants, colors, type, photography, lighting, composition, mood, visual restrictions | guide + Cloudinary |
  | Products | facts, materials, benefits, SKUs, prices, **approved claims only** | catalog / site |
  | Collections | season, theme, products, campaign story | collection pages |
  | Messaging | value props, differentiators, claims with evidence | website / docs |
  | Audiences | personas, markets, needs, objections, desired messaging | brand + research |
  | Channel rules | IG vs TikTok vs email vs ecommerce vs ads (length, visual-first, accuracy) | past content + HITL |
  | Approved examples | best copy, heroes, ads, past campaigns | Cloudinary + campaigns |
  | Restrictions | prohibited words, claims, logo treatments, image treatments | legal / guide |
  | Evidence | URL/file per important fact; confidence | Supabase + pgvector |
  | Competitors / market | positioning, pricing, launches, trends | Firecrawl + Gemini Search |
  | Performance | CTR, conversion, asset winners | Postiz / PostHog / Stripe — never invented |

  A **logo pack** is ingredients. The Brain is the **recipe every agent cooks from**.

  Supabase is the filing cabinet. An exported `BRAND.md` / `VOICE.md` is a **view for agents**, not the database.

  ### Intake (draft only)

  Operator gives a **brand URL** (plus optional PDF guide, catalog, Cloudinary library). **Firecrawl** maps/scrapes/extracts — do not write a crawler. Typical map: home, about, products, collections, lookbooks, journal, sustainability, press. **Gemini URL Context** (+ Search grounding for research) fills a **draft**. Nothing is DNA until HITL.

  ```text
  URL + PDFs + catalog + approved assets
    → extract / classify
    → structured draft + embed evidence
    → human review
    → publish Brand Brain
  ```

  Then “Create SS27 Instagram” is **Brain + collection + persona + approved photos + channel rules** — not an empty prompt.

  ### Brand Check (before any publish)

  Advisory score, then a human. Example: *Brand Match 96/100* — voice ✓, claims ✓, imagery ✓, colors ✓, IG rules ✓, CTA ⚠ more promotional than this brand. Flag “24k gold” if the Brain has no evidence. **Zero Postiz** until Approve locks **exact** copy and **exact** asset version.

  ### Opportunity scores (iPix, not a vendor)

  Ranked play, e.g. metallic accessories / holiday gift IG: **trend · brand fit · audience fit · competitive gap**. Operator still HITL-picks. Scores are not permission.

  Paid products to **model**, not buy: Jasper IQ (voice / knowledge / audience / product as shared context), Frontify (living guidelines + assets), Adobe GenStudio (brand + product + persona + compliance + campaign loop).

  ---

  ## Agents and workflows (after Core)

  Register extra agents **off** the operator route until CORE-001. Aliases must not diverge (**IPI-1048**).

  | Agent | Job | Must not |
  | --- | --- | --- |
  | Production Planner | Shoot type, deliverables, shot list, budget | Write `shoot.*` without HITL + RPC |
  | Brand Intelligence | Draft DNA from site/docs | Auto-approve DNA |
  | Brand Knowledge | Cite approved chunks | Treat vector hit as ACL |
  | Research | Competitors/trends with sources | Write Brand Brain |
  | Opportunity | Rank season bets | Publish or book |
  | Strategy / Campaign | Canvas + calendar | Bypass HITL |
  | Media | Need-list → Cloudinary; gap → Planner | Custom DAM |
  | Copy | Channel variants from approved assets | Publish |
  | Publish | Hand approved payload to Postiz | Call Postiz from chat |
  | Learn | Propose DNA diffs from Stripe/Postiz | Invent revenue |

  | Workflow | Meaning | Linear |
  | --- | --- | --- |
  | Brand intake | Crawl → draft DNA → HITL persist | **IPI-1093** |
  | Shoot save | Typed plan → HITL → one org-scoped write | **IPI-1084** → **IPI-1083** → **IPI-1085** |
  | Asset reuse | Need-list → search → gap → Planner | Cloudinary + **MEDIA-AGENT-001** |
  | Brand Check | Advisory match → HITL lock versions | **BRAND-CHECK-001** later; reuse **1084** / **998** pattern |
  | Publish | Approved versions → Postiz | **IPI-1105** child |
  | Learn | Metrics + asset ids → proposed DNA | **LEARN-001** |

  Minimum useful set is this crew — not twelve parallel “profile” agents on day one.

  ---

  ## Screens (mental model, not a mint list)

  Match the operator’s day, not vendor modules. Existing sitemap: [docs/SITEMAP.md](../../SITEMAP.md). Brand detail is **IPI-1068** / SCR-03. Do not ship ten empty Brand Intelligence tabs before the loop works.

  ```text
  BRAND (Brain, products, audiences, sources)
    → INTELLIGENCE (competitors, trends, opportunities)
    → STRATEGY → CAMPAIGN (plan, calendar, brief)
    → CREATIVE BRIEF (shot/content reqs → Production Planner)
    → ASSETS (existing / missing / Cloudinary)
    → CREATE (copy, crops, variants)
    → REVIEW (Brand Check + claims + versions)
    → PUBLISH (Postiz social)
    → ANALYTICS (honest empty or real)
    → OPTIMIZE → LEARN → next campaign
  ```

  CopilotKit: context (which brand), cards (draft DNA, opportunity, Brand Check, approval), shared state (strategy canvas), HITL. See [prd.md](./prd.md) §5c.

  ---

  ## Reuse before custom

  **Faster path:** Firecrawl + Gemini URL Context + HITL DNA on **IPI-1093**. Do not write a crawler or a Brand Hub clone.

  | Use | Official | Job |
  | --- | --- | --- |
  | Site ingest | [Firecrawl](https://github.com/firecrawl/firecrawl) | Map / scrape / extract. Fallback [Crawlee](https://github.com/apify/crawlee) only if Firecrawl cannot. |
  | URL / search analysis | [Gemini URL Context](https://ai.google.dev/gemini-api/docs/url-context) · [Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search) | Analyze a given URL; current research with citations |
  | Brand-as-rules (adapt schema) | [SCTY brand.md](https://github.com/SCTY-Inc/brand.md) · [VOICE.md](https://github.com/efeoncepro/voice.md) · [brand-book](https://github.com/ordinarynerds/brand-book) | Agent contract, voice lint, `brand.json` — store in Postgres |
  | Visual tokens (optional) | [Style Dictionary](https://github.com/style-dictionary/style-dictionary) | Exact color/type tokens |
  | Competitor watch (later) | [changedetection.io](https://github.com/dgtlmoon/changedetection.io) | Site diffs, not vibes |
  | Knowledge | [pgvector](https://supabase.com/docs/guides/database/extensions/pgvector) · [template-company-knowledge](https://github.com/mastra-ai/template-company-knowledge) | Evidence retrieval after RLS |
  | Strategy / plan UI | [canvas/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra) · [mastra-pm](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra-pm) | Shared state |
  | Copy from assets | [template-ad-copy-from-content](https://github.com/mastra-ai/template-ad-copy-from-content) | Channel variants |
  | Media | Cloudinary Widget / named transforms · [product-launch-agent](https://github.com/cloudinary-devs/product-launch-agent) patterns | Reuse before generate |
  | Publish | [Postiz](https://github.com/gitroomhq/postiz-app) | Social only |
  | First-party product analytics | [PostHog](https://github.com/PostHog/posthog) | Funnels — not paid-social reach |

  There is **no** one OSS repo that is already Brand Brain + competitors + trends + compliance + publish. Assemble. Scores in the dumps are **iPix-fit opinions**, not vendor ratings.

  n8n is optional glue later — iPix remains campaign/approval truth. SearXNG / Brandwatch / Semrush are later, not Core.

  ---

  ## Build order (after CORE-001)

  ```text
  IPI-1068 Brand UI  +  IPI-1093 DNA HITL (+ evidence)
    → Planner consumes approved DNA (IPI-1087 hints; server authorizes)
    → ShootPlan HITL save (1081 / 1084 / 1083 / 1085)
    ∥ Cloudinary library (1108…1120)
    → BRAND-KNOWLEDGE-001 (pgvector, mint under IPI-1099)

  Then IPI-1105 children (after duplicate search):
    Research → Opportunity → Strategy canvas → Campaign plan
    → Media reuse → Copy → Preview → Postiz
    → Charts (1073) → LEARN-001
  ```

  ---

  ## Historical dumps (do not execute)

  | File | What it was | Use now |
  | --- | --- | --- |
  | [04-brand-journey.md](./brand/04-brand-journey.md) | 20-step story + nav | **Folded** — operator journey table above |
  | [03-marketing-loop.md](./brand/03-marketing-loop.md) | Same loop + Adobe model + repo table | Folded; official URLs above (no blog UTM) |
  | [02-brand-journey-plan.md](./brand/02-brand-journey-plan.md) | 13 stages + invented `IPI-XXX` | Stages folded; **do not mint from this file** |
  | [brand-journey-todo.md](./brand/brand-journey-todo.md) | KEEP/CHANGE/ADD proposal 2026-08-31 | Audit ideas only; Linear wins; Foundation statuses are stale |
  | [05](./brand/05-brand-intelligence.md)–[08](./brand/08-brand-intel.md), [11](./brand/11-brand-intel.md) | DNA fields, tools, “killer workflow” | Schema + tools folded |
  | [06-brand-intel.md](./brand/06-brand-intel.md), [10-github-repos-brand.md](./brand/10-github-repos-brand.md) | Tool/repo essays | Shortlist above |
  | [07-brand-intel.md](./brand/07-brand-intel.md) | Social/search/trend collection | Later research agent; not Core |
  | [brand-profile-intelligence-platform.md](./brand/brand-profile-intelligence-platform.md) | 12 agents, edge fns, Graphify-as-product-KG | **Reject** as v2 build plan (old Mastra 1.41 / CopilotKit 1.61 / `app/src`) |
  | [19-brand-lifecycle.md](./brand/19-brand-lifecycle.md) | Epic 1 IPI-46…33 | **Historical.** Wrong runtime. |

  Also: [docs/plan/02/brand-intel/](../../plan/02/brand-intel) working notes; master product [docs/prd.md](../../prd.md).

  ---

  ## Pointers

  | Job | File |
  | --- | --- |
  | Layer PRD | [prd.md](./prd.md) §5b |
  | Now / Next / Later | [roadmap.md](./roadmap.md) |
  | Execution | [plan.md](./plan.md) Phase 2 |
  | Official URLs by task | [links.md](./links.md) |
  | Create tickets? | [todo.md](./todo.md) |
