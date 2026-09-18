Verified. Your attached change plan is **substantially correct**, and I would keep the core decision: **create exactly one new MIGRATEv2 executable task, strengthen existing task bodies, and do not create module-level migration tickets.**

After re-checking live Linear and current `ipixai`/Lumina, I would make **3 corrections** and add a few task-specific acceptance details.

## Corrections before applying

### 1. LOGIN ∥ NAV is not currently true in Linear

Live **IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup** is explicitly **blocked by**:

**IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout**.

So choose one of two models:

**Recommended faster model:** remove the hard blocker and make NAV related/soft. LOGIN can implement auth/signup/routing now and integrate final marketing chrome when NAV lands.

```text
MARKETING-NAV ─────────┐
                       ├→ polished LOGIN
LOGIN auth work ───────┘
        ↓
     ONBOARD
```

If you retain the current blocker, then the roadmap must say:

```text
NAV → LOGIN → ONBOARD
```

not `LOGIN ∥ NAV`.

I recommend **removing the hard NAV → LOGIN dependency** because NAV is visual shell work, not an auth-contract prerequisite.

---

### 2. BRAND-INTEL should not wait for BRAND-001

The current **IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile** explicitly says:

> APP-001 + AUTH-002 are its gates; **do not block on BRAND-001**.

So use:

```text
APP + AUTH
   ├→ BRAND-001
   └→ BRAND-INTEL-001
```

Then BRAND-001 displays approved DNA whenever it exists.

This is faster than:

```text
BRAND → BRAND-INTEL
```

Treat that as a product soft order only.

---

### 3. Do not globally paste `never npm run dev` as timeless architecture

It is **currently correct**: `package.json` deliberately makes `npm run dev` fail and instructs separate `dev:ui` and `dev:agent` processes.

But don't hard-code that forever into every long-lived task.

Better wording:

> At task start inspect current `package.json` scripts. As of 2026-09-03, `npm run dev` is intentionally disabled; use `npm run dev:ui` and `npm run dev:agent` separately.

That avoids stale task instructions after DEV-STAB is fixed.

---

# Per-task additions

These are the **extra details I would add**, beyond what your current document already has.

|Linear task|Additional detail to add|
|---|---|
|**NEW · INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace**|Add explicit **data-source contract per panel section**: every card must identify canonical V2 source; no fixture/fallback may masquerade as live intelligence. Add route-change stale-data test. Rail must clear foreign Brand/Shoot context immediately when route/org changes.|
|**IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles**|Already very strong. Add Lumina `brand-detail-greeting`, list-filter helpers/tests and active-brand behavior to audit. Explicitly **do not port `CommandCenterBrandSync`-style client tenant mutation**. Live task already correctly requires explicit trusted-org filtering.|
|**IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records**|Add old shoot filter/helper audit plus loading/error UX. Preserve lifecycle tab IA, but every downstream tab without data must be clearly disabled/empty—not fake. Current task already correctly identifies `shoot.shoots` as SSOT and old membership-union detail as insufficient.|
|**IPI-1066 · HOME-001 — Reuse the Proven iPix Command Center in the New App**|Add `derive-view-state`, `greeting`, recent-work fallback tests, types. Explicitly **DROP sample-images/dev fixtures** from production. Require independent query failures to degrade one card rather than blank the page when feasible. Current task already has the correct deterministic/server-first architecture.|
|**IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records**|Add asset list filtering/sorting/selection helpers and honest thumbnail-state tests. Separate `asset record exists` from `private media preview authorized`. No direct Cloudinary URL construction if the asset requires authenticated delivery.|
|**IPI-1070 · CRM-001 — Bring the Proven iPix CRM Workspace Into the New App**|Add forms/filter/table/detail helpers and CRM state-machine/status constants where pure. Explicitly drop AI scores unless backed by canonical truth. Mine follow-up generative UI only as presentation reference.|
|**IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings**|Add three-source audit: **Talent route + Matching route + Bookings route**. Import canonical status/FSM definitions instead of duplicated strings. Treat old `booking-tools`/`talent-match-tools` as contract/test oracles, not necessarily current Mastra tools.|
|**IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App**|Add unread/read/status derivation tests; prevent notifications/inbox from becoming a second durable workflow truth. Links must resolve to current supported V2 entity routes and fail safely on deleted targets.|
|**IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics**|Add **metric provenance table** to implementation evidence: metric → source table/query → definition → freshness. Unsupported old metric = `N/A/empty`, never synthetic zero.|
|**IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans**|Explicitly define distinction from `ShootPlanSchema`: `/app/plans` is persisted planning workspace/view; PLAN-001 is conversational structured artifact. Avoid duplicate plan types.|
|**IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant**|Add hard AC: no production registry, persistence, replay or runtime path imports `weatherAgent`; `default` and `production-planner` aliases must reference the **same Agent instance**. Do not preserve old Lumina multi-agent routing.|
|**IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely**|Keep exactly four tools. Add static dependency test preventing imports from Supabase, fetch/network, Cloudinary, payments or write clients. Current live task already captures this architecture well.|
|**IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning**|Add `contextVersion`/entity identity semantics so stale context can be invalidated. Route hint changes must not silently keep previous verified Brand/Shoot. Share the server-verified result with Rail; don't create two resolvers.|
|**IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan**|Add schema versioning field or explicit compatibility policy. APPROVAL and SAVE must import the canonical type directly. Unknown facts must remain `needs_input/assumed`, not become model-generated truth.|
|**IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved**|Add immutable **reviewed revision identity/hash/version**. Approval must refer to the exact plan snapshot shown to the human; subsequent AI regeneration invalidates old approval.|
|**IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile**|Add Visual Identity + Social Discovery audit explicitly. Add SSRF/domain/redirect protection, bounded crawl size/time, evidence dedupe, stale-draft detection and exact approved revision. Current task already has draft-only → atomic promotion as a strong invariant.|
|**IPI-172 · AI-EVIDENCE-001 — Persist Provider-Neutral Evidence and Citations for iPix AI Decisions**|Add provider-neutral evidence identity: source URL/document, retrieved-at, excerpt/location, provider-independent citation ID, entity/org linkage. UI EvidenceBlock should consume this contract without knowing model/provider.|
|**IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup**|Add legacy auth UX as visual/test oracle only. Current task already contains signup, OAuth, open-redirect prevention, generic errors and noindex. I would **soften NAV from hard blocker** as noted above.|
|**IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace**|Add legacy `navigation`, `idempotency-key`, session-draft/error tests explicitly. Keep AI kickoff out of tenancy. Add final proof that refresh immediately after materialization resolves the new membership without forcing logout/login. Current task already correctly reuses the atomic RPC.|
|**IPI-1051 · UI-001 — Let an iPix Operator Use the Planner in One Simple Authenticated Screen**|Add centralized generative UI registry as a **reuse pattern**, not scope expansion. Require internal tools hidden from normal user-facing chat while debug visibility remains possible. Keep this task external/non-MIGRATE.|

---

# Marketing tasks also deserve task-specific reuse details

Your document says “strengthen MARKETING-NAV / HOME / SERVICES / MEDIA / SEO,” but I would make those explicit.

### IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout

Add:

- responsive/mobile navigation behavior;
    
- active link/focus states;
    
- footer/shared CTA components;
    
- shared marketing layout;
    
- accessibility keyboard/menu tests;
    
- **no duplicate auth/session logic in navigation**.
    

Do not let this become a hard architectural dependency for unrelated auth code.

### IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App

Add:

- section composition;
    
- hero/CTA semantics;
    
- testimonials/social-proof only if real/current;
    
- public image optimization;
    
- responsive tests;
    
- metadata/OG composition.
    

No fake customer metrics/logos.

### IPI-1060 · MARKETING-SERVICES-001 — Reuse the Existing iPix Photography Service Pages

Add:

- shared service-page template before duplicating pages;
    
- reusable content sections;
    
- canonical URLs;
    
- metadata per service;
    
- real CTA destination.
    

**Faster/better approach:** one reusable service page structure + content data, not N independent copies if Lumina pages share the same layout.

### IPI-1064 · MARKETING-MEDIA-001 — Reuse and Optimize the Existing iPix Marketing Images, Sliders, and Visual Content

Add:

- inventory every referenced public asset before copying;
    
- remove dead/duplicate assets;
    
- preserve meaningful alt text;
    
- map public/provider-safe imagery to current Next/Image or verified Cloudinary approach;
    
- slider keyboard/touch behavior;
    
- CLS/LCP check.
    

### IPI-1063 · MARKETING-SEO-001 — Keep the New iPix Marketing Site Searchable and Correctly Indexed

Add:

- reuse/adapt `robots.ts`, `sitemap.ts` **and their tests**;
    
- ensure `/login`, auth callbacks, onboarding and `/app/*` are excluded/noindexed as intended;
    
- canonical tags;
    
- OG metadata;
    
- no stale Lumina domains/URLs;
    
- sitemap only includes actually shipped public routes.
    

---

# Launch tasks: additional details

Your current Launch definitions are mostly excellent.

### IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization

Add one more important invariant:

> **Approval revision + idempotency key must be bound together.**

The same idempotency key cannot be reused to save a different plan revision.

Conceptually:

```text
(org/user, approvedPlanRevision, idempotencyKey)
→ exactly one shoot_id
```

The live issue already correctly rejects reusing the current unsafe `SECURITY DEFINER` RPC as-is.

### IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot

Add:

- deterministic wizard state derived from canonical PLAN/APPROVAL/SAVE contracts;
    
- browser refresh/back/forward behavior;
    
- duplicate-submit protection;
    
- invalidation when upstream plan changes;
    
- no second copy of plan state.
    

The wizard should be **composition**, not another domain system.

---

# Intelligence Rail definition should be slightly stronger

I agree with creating it, but I would write its AC roughly like this:

> **INTELLIGENCE-RAIL-001 succeeds when an authenticated operator can move between Home, Brand and Shoot routes and see a compact read-only rail whose content is derived only from server-authorized current-org data; stale route/entity context is cleared; loading/empty/error states are honest; evidence links render through the shared evidence presentation; and no new agent, write path, fixture intelligence or duplicate tenant resolver is introduced.**

### Suggested sections for v1

Only enable sections when real data exists:

```text
Context
Brand DNA health
Shoot / production status
Approvals requiring attention
Recent activity
Evidence
```

Do **not** require all six to display on every route.

A section without authoritative data should be absent/empty, not filled from dev fixtures.

---

# Relation fixes after verification

I would make these exact relation decisions:

|Relation|Decision|
|---|---|
|**IPI-1053 · MARKETING-NAV-001 → IPI-1058 · MARKETING-LOGIN-001**|**Recommend soften/remove hard blocker**; integrate shell before Done|
|**IPI-1058 · MARKETING-LOGIN-001 → IPI-1089 · ONBOARD-001**|**Keep hard blocker**|
|APP → BRAND/SHOOT/HOME/ASSETS/CRM/OPS/TALENT/PLANS/ANALYTICS|Keep where already modeled|
|BRAND → BRAND-INTEL|**Do not add hard blocker**|
|BRAND + SHOOT → INTELLIGENCE-RAIL|Soft/usefulness relation, not strict blocker unless implementation needs their loaders|
|STREAM → PLANNER → TOOL|Keep|
|BRAND + SHOOT + PLANNER + TOOL → PLAN|Keep|
|PLAN → APPROVAL → SAVE → WIZARD → CONTEXT|Keep|
|SAVE → CONTEXT direct|**Remove redundant edge** if still present; WIZARD already carries it|

The live CONTEXT task still describes the correct browser-hint → server verification model.

---

# One more program-wide improvement

Add a **reuse evidence block** to every migrated PR, not just the Linear issue:

```text
Legacy source:
Current V2 target:
COPY:
ADAPT:
DROP:
Current source of truth:
Tests reused:
Tests added:
Production behavior verified:
```

This turns COPY/ADAPT/DROP from planning prose into an auditable engineering artifact.

It also makes future cleanup easier: reviewers can immediately see why an old file wasn't copied.

---

# Verification grades

Your uploaded plan says 97/100 confidence. After this pass I would score it:

|Category|Score|
|---|--:|
|Task ownership|**99/100**|
|Reuse coverage|**99/100**|
|Dependency correctness|**95/100**|
|Security boundaries|**98/100**|
|AI/HITL architecture|**98/100**|
|Efficiency|**99/100**|
|Production verification design|**98/100**|
|Linear hygiene before mutation|**88/100**|
|**Overall plan quality**|**98/100**|

The main deductions are the **NAV → LOGIN mismatch with the proposed parallel plan**, the need to make **BRAND-INTEL explicitly parallel to BRAND**, and a handful of useful acceptance details around stale context, exact approved revisions, evidence provenance and analytics metric provenance.

## Faster/better approach:

Do **not** rewrite the full existing issue bodies. Many are already extremely detailed.

Use atomic Linear patches:

```text
prepend/insert:
AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03
```

with only:

- exact Lumina files newly discovered;
    
- COPY/ADAPT/DROP additions;
    
- new acceptance criteria;
    
- corrected dependencies;
    
- version-at-start rule.
    

That is safer than replacing long descriptions and avoids destroying useful existing audits.

### Summary:

- **Best decision:** your task list is correct; **one new task only: INTELLIGENCE-RAIL-001**.
    
- **Why:** every other newly discovered Lumina module has a clear existing V2 owner.
    
- **Next action:** patch the existing Linear tasks with the additions above, clean the 5-in/5-out MIGRATEv2 labels, soften **MARKETING-NAV → MARKETING-LOGIN** if you want true parallel execution, remove redundant **SAVE → CONTEXT**, and create the Rail task.