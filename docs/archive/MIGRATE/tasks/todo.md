# MIGRATE · Ordered todo (implementation order)

**SSOT companions:** `plan-migrate.md` · `01-MIGRATE.md` · `02-adapt.md` · `03-linear-tasks-adapt.md` · batch READMEs  
**Source:** [amoai-tech/luminaai `app/`](https://github.com/amoai-tech/luminaai/tree/main/app) → target `amoai-tech/ipixai`  
**Rule:** COPY product UI + pure `lib` + tests · ADAPT to V2 auth/org/schema/runtime · DROP Worker / service-role / old CopilotKit-Mastra / browser-trusted tenant IDs  
**Authority:** current `ipixai` auth, trusted org, Supabase schema, Mastra/CopilotKit, `src/styles/tokens.css`

Legend: `[ ]` open · `[~]` in flight · `[x]` Done/certify · `∥` parallel OK · `EXT` external gate

**Architecture (do not confuse routes):**

```text
PUBLIC /          → IPI-1057 · MARKETING-HOME-001
AUTH /app         → IPI-1066 · DASH-MAIN-001 (Command Center)
AUTH /app/*       → APP-001 shell + domain workspaces
```

---

## Implementation order (start here)

**Product priority:** after APP certify, **DASH-MAIN-001 is first** — it reads Brand/Shoot/Planner canonical truth directly and does **not** wait for BRAND-001 or SHOOT-001 UI. Marketing remains an independent lane.

```text
0  CERTIFY GATES
   ├─ APP-001 (merged shell → certify Done)          [hard for all /app work]
   ├─ STREAM-001 (hosted SSE → Done)                 [hard for PLANNER only]
   └─ Next.js ≥16.3.3                                [production release; separate task]

1  START HERE — operator product (after APP certify)
   └─ DASH-MAIN-001 (/app Command Center)            [FIRST product screen]
        ↓
      BRAND-001
        ↓
      SHOOT-001
        ↓
      IPI-1140 Intelligence Rail
        ↓
      ASSETS → CRM → OPS → TALENT → PLANS → ANALYTICS

2  PARALLEL (does not block Dashboard)
   ├─ Lane A · First user / public: NAV ∥ LOGIN → ONBOARD → … → MEDIA → SEO
   └─ AI lane: STREAM → PLANNER → TOOL; BRAND-INTEL after Brand UI

3  M3 launch (hard serial; needs Brand + Shoot + Planner + Tool)
   └─ PLAN → APPROVAL → SAVE → WIZARD → PLANNER-CONTEXT
```

**Multi-agent tip:** after Dashboard starts, can run `DASH-MAIN ∥ BRAND ∥ SHOOT ∥ PLANNER`.  
**Solo tip:** `APP certify → DASH-MAIN → BRAND → SHOOT → Rail → …`

---

## 0 · Gates (certify; do not reimplement)

| Status | Task | Work now |
| --- | --- | --- |
| [~] | **IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App** | **Certification only** — shell merged (PR #43). Verify current `main`, tests, browser; attach hosted CI if available → Done. Spec: [`dash-backend/IPI-1065-APP-001.md`](./dash-backend/IPI-1065-APP-001.md) |
| [~] | **IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely** | Hosted auth SSE certify → Done |
| [ ] | **EXT** Next.js **16.1.2 → ≥16.3.3** | Separate security/dependency task — production release blocker |
| [x] | AUTH-002 / ACCESS / REPLAY / DESIGN-001 | Done — reference only |

---

## 1 · Lane A — public / first-user (∥ Dashboard; not a start gate for /app)

| # | Status | Task | Notes |
| --: | --- | --- | --- |
| 1.1 | [~] | **IPI-1053 · MARKETING-NAV-001** | Layout + header/footer + **5-route** registry; merge gate for HOME/SERVICES |
| 1.2 | [ ] | **IPI-1058 · MARKETING-LOGIN-001** | ∥ NAV (no hard NAV start block); safe-redirect + submit-lock; hard for ONBOARD |
| 1.3 | [ ] | **IPI-1089 · ONBOARD-001** | **Min tenancy first** (not 13-screen Lumina); RPC → `/app` |
| 1.4 | [ ] | **IPI-1060 · MARKETING-SERVICES-001** | Route-local composition; scrub unsupported claims |
| 1.5 | [ ] | **IPI-1057 · MARKETING-HOME-001** | Public `/` only after **Planner relocated** |
| 1.6 | [ ] | **IPI-1064 · MARKETING-MEDIA-001** | Hard: HOME + SERVICES |
| 1.7 | [ ] | **IPI-1063 · MARKETING-SEO-001** | Hard: LOGIN + HOME + SERVICES; redirects + canonical host |

---

## 2 · Lane B — operator product (Dashboard first)

| # | Status | Task | Notes |
| --: | --- | --- | --- |
| 2.1 | [ ] | **IPI-1066 · DASH-MAIN-001** | **START HERE** after APP certify. Reads brands/shoots/planner **directly** — no BRAND/SHOOT UI hard dep. Nav → **Dashboard**. Spec: [`dash-backend/IPI-1066-Dash-main.md`](./dash-backend/IPI-1066-Dash-main.md) |
| 2.2 | [ ] | **IPI-1068 · BRAND-001** | Full Brand workspace · `/app/brands` · data contract first |
| 2.3 | [ ] | **IPI-1067 · SHOOT-001** | Full Shoot workspace · detail direct-query first · `/app/shoots` |
| 2.4 | [x] | **IPI-1140 · INTELLIGENCE-RAIL-001** | Soft after Dashboard + Brand/Shoot loaders; fill APP rail slot |
| 2.5 | [ ] | **IPI-1069 · ASSETS-001** | Brand-ID scope; placeholder OK until IPI-1112 |

Per-task audit block (before code):

> Inspect route + components + `lib` helpers + schemas + focused tests + empty/error/loading. Classify **COPY / ADAPT / DROP**. V2 auth/org/tokens remain authoritative. Data contract + cross-org proof **before** Lumina UI.

---

## 3 · Wave B / C workspaces (∥)

| # | Status | Soft solo | Task |
| --: | --- | --: | --- |
| 3.1 | [ ] | 1 | **IPI-1070 · CRM-001** |
| 3.2 | [ ] | 2 | **IPI-1072 · OPERATIONS-001** |
| 3.3 | [ ] | 3 | **IPI-1071 · TALENT-BOOKING-001** |
| 3.4 | [ ] | 4 | **IPI-1074 · PLANS-001** |
| 3.5 | [ ] | 5 | **IPI-1073 · ANALYTICS-001** |

---

## 4 · AI lane (after STREAM; ∥ Wave A if capacity)

| # | Status | Task | Notes |
| --: | --- | --- | --- |
| 4.1 | [ ] | **IPI-1048 · PLANNER-001** | Behavior reuse — **not** old runtime |
| 4.2 | [ ] | **IPI-1049 · TOOL-001** | Compute-only shoot tools + tests |
| 4.3 | [ ] | **IPI-1093 · BRAND-INTEL-001** | Hard: APP + AUTH-002 only; no BRAND hard block |
| 4.4 | [ ] | **IPI-172 · AI-EVIDENCE-001** | External infra |
| 4.5 | [ ] | **IPI-1128 · BRAND-KNOWLEDGE-001** | External |

---

## 5 · M3 launch chain (hard serial)

Requires **Brand + Shoot + Planner + Tool** Done.

| # | Status | Task |
| --: | --- | --- |
| 5.1 | [ ] | **IPI-1081 · PLAN-001** |
| 5.2 | [ ] | **IPI-1084 · APPROVAL-001** |
| 5.3 | [ ] | **IPI-1083 · SHOOT-SAVE-001** |
| 5.4 | [ ] | **IPI-1085 · SHOOT-WIZARD-001** |
| 5.5 | [ ] | **IPI-1087 · PLANNER-CONTEXT-001** — also Brand/Shoot context for rail; drop SAVE hard block if live |

---

## 6 · Mine later (not MIGRATEv2 executables now)

| When | Lumina | V2 owner |
| --- | --- | --- |
| M3 media | `components/media/*` | MEDIA-001 / MEDIA-APPROVAL / MEDIA-DELIVERY / SHOOT-ASSETS |
| M4 | campaigns / CHANNEL-PREVIEW | Campaign epic |
| Post-MVP AI | CRM assistant, booking-agent | BOOKING-AI etc. |
| Never as authority | `app/api/*`, Worker, service-role clients | Extract contracts only |

---

## Linear hygiene

- [x] MIGRATEv2 label hygiene + **CREATE IPI-1140 · INTELLIGENCE-RAIL-001** (2026-09-03)
- [x] Batch 1 BRAND / SHOOT / ASSETS Linear addenda (2026-09-03)
- [x] IPI-1066 renamed **DASH-MAIN-001** (2026-09-03)
- [ ] Soften live NAV→LOGIN hard block if still present
- [ ] Remove SAVE→CONTEXT hard block if still present
- [ ] Apply marketing-batch Linear addenda from [`marketing/`](../../../MIGRATE/tasks/marketing)
- [ ] APP-001 post-merge certification addendum + Done when evidence attached
- [ ] Separate Next.js ≥16.3.3 security task

Do **not** create: `LIB-MIGRATION` · `EVIDENCE-UI` · `APPROVAL-COMPONENT` · `ERROR-PAGES` · `STYLE-MIGRATION`.

---

## Next three actions

1. **Certify APP-001** on current `main` → Done (do not redesign shell).  
2. **Start DASH-MAIN-001** (`Home` → `Dashboard`; provenance-first `/app` reads — **do not wait for Brand/Shoot UI**).  
3. Then **BRAND-001 → SHOOT-001** (and keep LOGIN→ONBOARD on the marketing lane if capacity).
