Yes. The deeper audit shows **more reusable value in Lumina than the current 17/24-task migration map captures**.

The biggest overlooked opportunities are **shared Intelligence/Evidence UI, pure domain libraries/tests, generic approval primitives, route/context adapters, error/SEO infrastructure, media/campaign UI for later milestones, and reusable server/data patterns**. The current `ipixai` is still deliberately thin: its `src/lib` has only auth, Cloudinary, Supabase, types and utilities, while Lumina contains mature domain helpers for Brand, Assets, Booking, Analytics and others.

## Deeper reuse map

|Priority|Lumina area|Reuse in iPix V2|Destination / task|Decision|
|--:|---|---|---|---|
|**1**|`components/intelligence-panel/*`|panel shell, route briefing, DNA scores, approvals, activity, evidence dialog, AI context card|**Gap: Intelligence Rail content** + BRAND/HOME/PLANNER|**ADAPT strongly**|
|**2**|`components/evidence-block/*`|universal evidence/citation display|BRAND-INTEL, BRAND-KNOWLEDGE, AI-EVIDENCE, Talent matching, later campaigns|**COPY+CLEAN**|
|**3**|`lib/*` domain helpers|filters, shaping, scoring presentation, analytics calculations, booking helpers|Every dashboard migration|**ADAPT before rebuilding**|
|**4**|`components/approval-card/*`|universal review chrome/states|APPROVAL, BRAND-INTEL, MEDIA-APPROVAL, Campaign publishing|**COPY+CLEAN once**|
|**5**|`useAgentContext` / current-page patterns|route/brand/shoot/CRM context|PLANNER-CONTEXT + Intelligence Rail|**Reuse trust concept**|
|**6**|`app/global-error.tsx`, `not-found.tsx`|polished failures/404|APP / public migration|**COPY+CLEAN**|
|**7**|`robots.ts`, `sitemap.ts` + tests|SEO infrastructure|MARKETING-SEO|**Adapt directly**|
|**8**|`styles/tokens.css`, design rules|design contract|DESIGN/individual migrations|**Already substantially reused — don't duplicate**|
|**9**|`components/media/*`|asset review/media UI|M3 MEDIA tasks|**Mine now, implement later**|
|**10**|`components/campaigns/*`|campaign workspace/UI|M4 campaigns|**Mine later; not M2 critical path**|
|**11**|Mastra secondary agents|CRM assistant, booking/model-match concepts|Later CRM/Talent AI|**Domain reference only**|
|**12**|legacy API routes|schemas, validation, error/test cases|matching V2 server handlers|**Pattern reference, not port**|

---

# 1. Biggest missing reuse: Intelligence Panel

This is the clearest gap I found.

Lumina contains a fairly complete shared Intelligence Panel family:

- `IntelligencePanel`
    
- `AIContextCard`
    
- route briefing resolver
    
- DNA score sections
    
- approvals
    
- AI insights
    
- recent activity
    
- portfolio section
    
- evidence dialog.
    

It isn't just decorative UI. For example, its evidence dialog already consumes the generic `EvidenceBlock`, and the DNA section uses typed intelligence contracts.

Meanwhile current `ipixai/src/components` mainly contains the new operator shell, Planner thread UI and generic primitives; those old domain component families have not yet been migrated.

### Recommendation

Do **not** rebuild an Intelligence Rail from scratch.

Use:

```text
Lumina IntelligencePanel
        ↓
COPY presentation structure
        ↓
DROP old data/AI plumbing
        ↓
current APP-001 rail slot
        ↓
server-trusted V2 context + real data
```

There are historical Linear issues specifically for this old implementation—`IPI-243 · INTEL-001`, `IPI-306 · Intelligence Panel Parity`, route-aware sections, Suggestion Rail, etc.

But I do **not** see a clean current V2 executable owner equivalent in the migration set.

### This is a genuine roadmap gap

I recommend either:

**A. Best option:** add one V2 task for populating the existing Intelligence Rail from proven Lumina components.

Or:

**B. Smaller option:** explicitly distribute those components into existing tasks:

- BRAND owns Brand/DNA section;
    
- ASSETS owns asset context;
    
- HOME owns activity/attention;
    
- PLANNER owns conversational/action integration.
    

I prefer **A**, because otherwise four tasks will modify the same rail.

---

# 2. EvidenceBlock should become a shared V2 primitive

This is more important than it looks.

Lumina already used `EvidenceBlock` across different domains. Search evidence even shows it being reused for talent/model matching explanations.

That maps directly to iPix's future:

```text
Brand claim
→ evidence

Talent match
→ evidence

Asset DNA finding
→ evidence

Campaign recommendation
→ evidence

Brand Brain improvement
→ evidence
```

So instead of BRAND-INTEL, Talent, Asset DNA, and Campaigns each inventing citation UI, migrate **one generic EvidenceBlock**.

### Best ownership

Pair:

**IPI-172 · AI-EVIDENCE-001 — Persist Provider-Neutral Evidence and Citations for iPix AI Decisions**

with the old `EvidenceBlock` as its **presentation reference**, while persistence remains current V2 design.

Then:

**IPI-1128 · BRAND-KNOWLEDGE-001 — Give AI Decisions Approved Brand Evidence With Citations**

can consume it instead of inventing another display.

This does **not** need to block current dashboards.

---

# 3. We should migrate domain libraries, not only React components

This is probably the biggest engineering-efficiency improvement.

Current `ipixai/src/lib` is still tiny.

Lumina's `app/src/lib` includes mature domain code such as:

- analytics + tests;
    
- assets;
    
- booking;
    
- Brand Hub;
    
- Brand filters;
    
- Brand greeting/presentation;
    
- API helpers;
    
- AI helpers;
    
- active-brand logic;
    
- many domain-specific utilities.
    

So every page migration should follow:

```text
old page
+ old components
+ old lib helpers
+ old focused tests
        ↓
COPY / ADAPT / DROP audit
        ↓
V2 page
```

Not merely:

```text
copy JSX
→ rewrite all underlying logic
```

## Example

For **IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics**:

Reuse both:

```text
components/analytics/*
lib/analytics.ts
lib/analytics.test.ts
```

The latter two are explicitly present in Lumina.

That gives us deterministic metric computation/tests, not just a chart layout.

Do this for:

- BRAND
    
- ASSETS
    
- CRM
    
- Talent/Booking
    
- Analytics
    
- Operations
    
- Plans.
    

---

# 4. Generic approval primitives should be migrated once

We already identified the Shoot approval cards, but the deeper audit shows the generic `approval-card` family should be treated as **shared infrastructure**, not only APPROVAL-001.

Lumina's Intelligence Panel and Brand workflow already reuse approval concepts, while the generic approval component family exists independently.

Use one V2 visual primitive for:

```text
Shoot plan approval
Brand DNA approval
Asset approval
Campaign publishing approval
potential Brand Brain learning approval
```

Important distinction:

```text
ApprovalCard UI = reusable

approval transport/runtime = domain-specific/current V2
```

This reduces future duplication significantly.

---

# 5. Route-aware context should serve both Planner and Intelligence Rail

Lumina has more than `currentPageContext`.

The repository shows multiple context surfaces:

- shoot-detail context;
    
- shoot-wizard context;
    
- brand context;
    
- CRM context;
    
- booking context;
    
- `useAgentContext` patterns.
    

And `currentPageContext.ts` explicitly documents UI context feeding the agent run.

The improvement for V2 is **not** to recreate all those providers separately.

Create one small concept:

```text
CurrentOperatorContext
{
  route,
  brandId?,
  shootId?,
  assetId?,
  dealId?,
  bookingId?
}
```

Browser fields remain **hints**.

Then:

```text
browser hint
→ server authorization
→ trusted entity
→ Planner
→ Intelligence Rail
```

That means PLANNER-CONTEXT should be designed so the verified-context result can also feed the Intelligence Rail.

This avoids:

```text
Planner context system
+
Intelligence context system
+
page-specific context system
```

---

# 6. Error and empty-state infrastructure is worth migrating

Lumina's root app contains:

- `global-error.tsx`;
    
- `not-found.tsx`;
    
- root layout;
    
- global CSS.
    

Don't create separate tasks for these.

But every dashboard COPY+CLEAN task should mine:

- empty state;
    
- loading state;
    
- failure state;
    
- unauthorized state;
    
- not-found behavior.
    

This matters because the current migration approach needs **honest placeholders**, particularly Assets and Analytics.

---

# 7. SEO implementation is even more reusable than previously identified

Lumina has actual:

- `robots.ts`;
    
- `robots.test.ts`;
    
- `sitemap.ts`;
    
- `sitemap.test.ts`.
    

So **IPI-1063 · MARKETING-SEO-001 — Keep the New iPix Marketing Site Searchable and Correctly Indexed** should explicitly say:

> audit/adapt existing robots + sitemap implementation and tests before custom implementation.

This should be a very cheap migration.

---

# 8. Styles: mostly do NOT port again

Lumina has:

- `styles/tokens.css`;
    
- `styles/design-system-rules.md`.
    

Current `ipixai` already has a substantial `src/styles/tokens.css` of its own.

Therefore:

### Do

Use old tokens/design rules as visual parity/reference.

### Do not

Overwrite current V2 `tokens.css` every time a page is ported.

Rule:

```text
current V2 tokens = authority

old component CSS
→ translate onto those tokens
```

This prevents design-system regression.

---

# 9. Legacy API routes contain reusable contracts—but should almost never be copied

Lumina has a broad API surface:

- assets;
    
- auth;
    
- bookings;
    
- brands;
    
- CopilotKit;
    
- CRM;
    
- intelligence;
    
- media;
    
- notifications;
    
- org;
    
- shoots;
    
- AI routes and more.
    

This is valuable for:

- request schemas;
    
- response shapes;
    
- error cases;
    
- retry behavior;
    
- negative tests;
    
- business invariants.
    

But current V2 architecture is different enough that route code itself should generally be:

**AUDIT → extract contract → implement smallest current server path.**

Especially never blindly port:

- service-role clients;
    
- Worker-specific routing;
    
- old CopilotKit runtime;
    
- old tenant resolution;
    
- custom SSE.
    

---

# 10. Secondary Mastra agents: mine, but don't migrate yet

Lumina includes more domain agents than the current V2 plan uses—Brand Intelligence, Booking, CRM assistant, Model Match, etc. The agent folder contains focused tests as well.

These are useful **future behavior references**, but I would not make them current MIGRATEv2 tasks.

### Mine later

|Old capability|Future V2 destination|
|---|---|
|CRM Assistant|post-MVP CRM AI|
|Booking Agent|**IPI-1095 · BOOKING-AI-001 — Let the Booking Coordinator Coordinate Production Bookings**|
|Model Match|Talent/Booking advanced capability|
|Brand Intelligence|**IPI-1093 · BRAND-INTEL-001** now|
|Production Planner|**IPI-1048 · PLANNER-001** now|

The current decision to have **one main Production Planner first** remains correct.

---

# 11. Media UI should be reused for the Cloudinary lane

We previously kept Cloudinary tasks outside MIGRATEv2, correctly.

But Lumina has a `components/media` family.

So these tasks should explicitly audit old media UI before building:

- **IPI-1097 · MEDIA-001 — Upload, Review, Approve, and Deliver Shoot Assets**
    
- **IPI-1119 · MEDIA-APPROVAL-001 — Approve or Reject the Exact Cloudinary Asset Version**
    
- **IPI-1120 · MEDIA-DELIVERY-001 — Deliver Only Approved Named-Transform Asset Versions**
    
- **IPI-1118 · SHOOT-ASSETS-001 — Attach Uploaded Assets to the Correct Saved Shoot**
    

Reuse UI/workflow ideas.

Do **not** reuse old Cloudinary/Worker persistence as authority.

---

# 12. Campaign UI should be pre-marked for M4 reuse

Lumina also has `components/campaigns`.

That means when M4 begins:

**IPI-1105 · IPI-EPIC · CAMPAIGNS & PUBLISHING — Campaigns, Preview, and Publish**

should not start from empty React screens.

Mine old:

- campaign cards;
    
- campaign workspace;
    
- status/presentation;
    
- content preview;
    
- relevant form states.
    

But keep this **Later**, not on today's critical path.

---

# What I would change in Linear

I would **not create 10 more tasks**.

Instead, update existing tasks with deeper reuse sources, plus address one real ownership gap.

|Change|Recommendation|
|---|---|
|Dashboard tasks|Add old `lib/*` helpers/tests to mandatory reuse audit|
|PLANNER/CONTEXT|Add route/context-provider audit|
|AI-EVIDENCE|Add `EvidenceBlock` UI reuse|
|BRAND-KNOWLEDGE|Consume shared EvidenceBlock|
|APPROVAL|Make generic ApprovalCard primitives reusable downstream|
|MARKETING-SEO|Explicit robots/sitemap + tests reuse|
|Cloudinary Media tasks|Add `components/media/*` audit|
|M4 Campaign tasks|Add `components/campaigns/*` audit|
|**Intelligence Rail**|**Resolve ownership — currently the clearest V2 migration gap**|

## Potential missing executable task

The one thing I would seriously consider adding is:

**`INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace`**

Purpose:

```text
APP-001 rail slot
+
Lumina IntelligencePanel presentation
+
shared EvidenceBlock
+
route-aware verified context
+
real Brand/Shoot/Asset/approval reads
=
useful proactive operator rail
```

Scope should initially be **deterministic/display-first**.

No new agent.

No autonomous writes.

Then later PLANNER/Brand/Asset capabilities feed it.

This aligns very closely with the old proven architecture without recreating the old runtime.

---

# Updated reuse score by source tree

|Lumina area|Reuse value|Recommendation|
|---|--:|---|
|`src/components`|**98/100**|Primary COPY+CLEAN source|
|`src/lib`|**95/100**|Underused today; mine aggressively|
|`src/mastra/tools`|**92/100**|Pure domain logic high value|
|`src/mastra/agents`|**80/100**|Prompts/behavior/tests, not runtime|
|`src/mastra/workflows`|**65/100**|schemas/fixtures/stage logic; avoid wholesale port|
|`src/app` page routes|**90/100**|IA/page composition strongly reusable|
|`src/app/api`|**45/100 code / 85/100 behavior**|contracts/tests only in most cases|
|`src/styles`|**70/100 reference**|current V2 tokens already authority|
|Root error/SEO files|**90/100**|cheap direct adaptation|

## Faster/better approach:

For every remaining migration, change the required audit from:

```text
old page + old components
```

to:

```text
old route
+ old components
+ old lib/domain helpers
+ old schemas
+ old focused tests
+ old empty/error/loading states
        ↓
COPY / ADAPT / DROP
        ↓
current V2 source of truth
```

That is the fastest safe migration path.

### Summary:

- **Best decision:** expand the reuse strategy beyond screens. The most valuable additional sources are **IntelligencePanel, EvidenceBlock, domain `lib/*`, generic ApprovalCard, context adapters, SEO/error infrastructure, media UI and later campaign UI**.
    
- **Why:** current ipixai has the secure foundation but still lacks most of Lumina's mature domain layer and UI families. Rebuilding those would waste proven work.
    
- **Next action:** keep the existing migration tasks, add deeper reuse references to them, and resolve **one probable missing V2 owner: the Intelligence Rail/Panel migration**.