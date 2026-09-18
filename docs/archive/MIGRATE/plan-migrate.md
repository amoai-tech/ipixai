# MIGRATE · Plan & roadmap (Lumina → ipixai V2)

**Updated:** 2026-09-03 (corrections: LOGIN/NAV, BRAND-INTEL parallel, scripts wording)  
**Purpose:** Reuse/adapt Lumina into `amoai-tech/ipixai` without rebuilding domain UI/lib or porting obsolete runtime.  
**Task patch specs:** [`tasks/`](../../MIGRATE/tasks) · Linear change index: [`04-linear-changes.md`](./04-linear-changes.md) · Checklist: [`todo.md`](../../MIGRATE/MIGRATE/tasks/todo.md)

**Pinned source:** [luminaai/app](https://github.com/amoai-tech/luminaai/tree/main/app) · local mirror `/home/sk/ipix/app/src`  
**Target:** current `ipixai` `origin/main` (auth/org/schema/runtime/`tokens.css` authoritative)

---

## 1. Core decision

| Decision | Detail |
| --- | --- |
| **Create now** | Exactly **one** new MIGRATEv2 task: **INTELLIGENCE-RAIL-001** |
| **Do not create** | Module tickets (`LIB-MIGRATION`, `GENERATIVE-UI-001`, `ERROR-PAGES-001`, …) |
| **Strengthen** | Existing Linear bodies via **atomic addendum** patches (see `tasks/*.md`) |
| **MIGRATEv2 size** | **25 clean executables** (remove 5 clutter / add 5 missing) |

---

## 2. Three corrections (must apply before Linear mutation)

### 2.1 LOGIN ∥ NAV is **not** live Linear today

**Verified:** **IPI-1058 · MARKETING-LOGIN** `blockedBy` **IPI-1053 · MARKETING-NAV**.

| Model | Graph | Recommendation |
| --- | --- | --- |
| **Preferred (faster)** | Soften/remove hard NAV→LOGIN; auth work ∥ NAV; polish chrome before Done | **Use this** |
| If blocker retained | `NAV → LOGIN → ONBOARD` | Do not claim LOGIN ∥ NAV |

```text
MARKETING-NAV ─────────┐
                       ├→ polished LOGIN Done
LOGIN auth work ───────┘
        ↓
     ONBOARD   (hard: LOGIN → ONBOARD — keep)
```

### 2.2 BRAND-INTEL ∥ BRAND-001

**Verified:** **IPI-1093** gates = APP-001 + AUTH-002; body says **do not block on BRAND-001**. Live `blockedBy` = APP-001, AUTH-002 only.

```text
APP + AUTH
   ├→ BRAND-001          (display)
   └→ BRAND-INTEL-001    (generate → draft → approve → persist)
Then BRAND-001 shows approved DNA when present.
```

`BRAND → BRAND-INTEL` is **product soft order only**, not a Linear hard edge.

### 2.3 Dev scripts — date-stamped, not timeless

Do **not** paste “never `npm run dev`” as eternal architecture into every issue.

> At task start inspect current `package.json` scripts. As of **2026-09-03**, `npm run dev` is intentionally disabled (**DEV-STAB-001**); use `npm run dev:ui` and `npm run dev:agent` separately.

---

## 3. Dependency-driven lane graph

```text
EXTERNAL GATES
  APP certify · STREAM certify

PUBLIC
  MARKETING-NAV ─┐
  MARKETING-LOGIN (auth) ─┴→ polished LOGIN → ONBOARD
  HOME ∥ SERVICES ∥ MEDIA ∥ SEO   (mostly parallel)

OPERATOR (after APP — parallel allowed)
  BRAND ∥ SHOOT ∥ HOME ∥ ASSETS ∥ CRM ∥ OPS ∥ TALENT ∥ PLANS ∥ ANALYTICS
  BRAND + SHOOT (useful) → INTELLIGENCE-RAIL   [soft]

AI
  STREAM → PLANNER → TOOL
  APP+AUTH → BRAND-INTEL → BRAND-KNOWLEDGE [external]
  AI-EVIDENCE [external]

M3 (hard serial)
  Brand+Shoot+Planner+Tool → PLAN → APPROVAL → SAVE → WIZARD → CONTEXT
  Remove redundant SAVE → CONTEXT if WIZARD already blocks CONTEXT
```

**Capacity soft order (solo):** Brand → Shoot → Home → Rail → Assets → CRM → Ops → Talent → Plans → Analytics.  
**Wave B does not wait for Rail.** HOME does not hard-depend on Brand/Shoot UI.

---

## 4. MIGRATEv2 hygiene → 25 executables

**Remove label:** epics 1076/1077/1079 · Done DESIGN-001 · M4 CHANNEL-PREVIEW.  
**Add label:** LOGIN · MEDIA · SEO · BRAND-INTEL · **INTELLIGENCE-RAIL-001**.  
**Outside:** APP, STREAM, CORE, UI-001, AI-EVIDENCE, BRAND-KNOWLEDGE, Cloudinary.

---

## 5. INTELLIGENCE-RAIL-001 (create)

**Succeeds when** an authenticated operator moves Home ↔ Brand ↔ Shoot and sees a compact **read-only** rail from **server-authorized current-org data only**; stale route/entity context clears; loading/empty/error honest; evidence via shared EvidenceBlock; **no** new agent, write path, fixture intelligence, or duplicate tenant resolver.

**v1 sections** (only when real data exists): Context · Brand DNA health · Shoot/production status · Approvals needing attention · Recent activity · Evidence. Missing data → absent/empty, never fixtures.

**COPY:** `intelligence-panel/*`, `evidence-block/*`, `brand-context-panel/*`  
**ADAPT:** `lib/intelligence/*` → trusted context  
**DROP:** `dev-panel-fixture`, old `/api/intelligence/*`, write paths, separate agent, browser tenant authority  
**Do not repurpose** **IPI-1024 · PROACTIVE-INTEL-001**.

---

## 6. Relation decisions

| Relation | Decision |
| --- | --- |
| NAV → LOGIN | **Soften/remove hard blocker** (preferred) |
| LOGIN → ONBOARD | **Keep hard** |
| APP → operator dashboards | Keep where modeled |
| BRAND → BRAND-INTEL | **Do not add hard blocker** |
| Brand+Shoot → Rail | Soft usefulness |
| STREAM → PLANNER → TOOL | Keep |
| Brand+Shoot+Planner+Tool → PLAN → … → CONTEXT | Keep |
| SAVE → CONTEXT direct | **Remove** if still present |

---

## 7. How to patch Linear (faster/better)

Do **not** rewrite entire issue bodies. Prepend:

```text
AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03
```

with only: new Lumina files · COPY/ADAPT/DROP deltas · new ACs · dependency fixes · version-at-start rule.

Per-task specs: **`docs/MIGRATE/tasks/<TASK>.md`**.

Every migrated **PR** also carries:

```text
Legacy source / V2 target / COPY / ADAPT / DROP / SoT / Tests reused / Tests added / Behavior verified
```

---

## 8. Non-negotiables

| Do | Don't |
| --- | --- |
| Route → components → lib → domain Mastra only → tests → API contracts | Recursively reread all of Lumina |
| V2 auth/org/schema/runtime/tokens | Worker, service-role browser, old SSE, browser tenant IDs |
| Honest empty/N/A metrics | Fake zeros / fixture intelligence |
| One Planner + specialized tools | Multi-agent registry clone |

---

## 9. Confidence

| Category | Score |
| --- | --- |
| Task ownership / reuse | **99** |
| Dependency correctness (after §2) | **95→98** when NAV→LOGIN softened |
| Overall plan | **98/100** |
| Linear hygiene before mutation | **88** until labels applied |

**Next:** apply `tasks/` addenda + MIGRATEv2 hygiene + create Rail · then execute LOGIN auth ∥ NAV and BRAND ∥ SHOOT ∥ BRAND-INTEL.
