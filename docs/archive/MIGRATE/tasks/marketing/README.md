# MIGRATE · Task patch specs (marketing + dash-backend)

**Do not mutate Linear until approved.**  
Companions: [`../README.md`](../README.md) · [`../../plan-migrate.md`](../../plan-migrate.md) · [`../../04-linear-changes.md`](../../04-linear-changes.md)

| Folder | Path | Role |
| --- | --- | --- |
| **Marketing / public + ONBOARD** | [`./`](../../../../MIGRATE/tasks/marketing) (`docs/MIGRATE/tasks/marketing/`) | Public site, login, onboarding |
| **Dash / backend / AI / launch** | [`../dash-backend/`](../../../../MIGRATE/tasks/dash-backend) | APP certify, DASH-MAIN `/app`, Brand/Shoot, rail, Wave B, Planner, M3 |

**Executable order:** [`../todo.md`](../todo.md) — dashboard lane does **not** wait for marketing pages.  
**Audit (marketing lane):** 2026-09-03 · ~**97–99/100** after corrections.

---

## Faster / better first steps — marketing lane

Do this **before** any per-task Linear patch or product PR in this folder:

```text
NOW (parallel)
├─ MARKETING-NAV — layout + header + footer + 5-route registry
├─ MARKETING-LOGIN — auth/routing work ∥ NAV (no hard NAV start block)
└─ SERVICES content audit/prep (claims scrub; 9→5 consolidation map)

LOGIN Done
└─ ONBOARD-001 — minimum tenancy first (2–3 screens → RPC → /app)
   (AI / DNA / marketing slides = Phase 2+; BRAND-INTEL downstream)

NAV merged (merge gate for HOME + SERVICES)
├─ LOGIN visual chrome integration
├─ SERVICES route integration
└─ HOME section components (prep only — do not take `/` yet)

Planner relocated off `/` (verified product route)
└─ MARKETING-HOME takes `/`

HOME + SERVICES final
└─ MARKETING-MEDIA (hard merge blockers)

HOME + SERVICES + LOGIN final
└─ MARKETING-SEO (hard finalization inputs)
```

Operator **DASH-MAIN-001** (`/app`) lives in [`../dash-backend/IPI-1066-Dash-main.md`](../dash-backend/IPI-1066-Dash-main.md) — not this folder.

### Out of marketing lane (do not bury)

| Issue | Owner |
| --- | --- |
| Next.js **16.1.2 → ≥16.3.3** | Dedicated dependency/security task — not a marketing PR |
| `ponytail` in Linear skills lists | Prefer **lean / cheapest-proof-first**; Cursor rule ≠ always `.claude/skills` |
| Stale `amo-tech-ai/lumina-studio` attachments | Prefer **`amoai-tech/luminaai`** |

---

## Faster / better first steps — dash-backend lane

```text
Wave A (operator screens) — after APP-001 certify
├─ DASH-MAIN-001 fills /app center FIRST (no Brand/Shoot UI gate)
├─ then BRAND-001 → SHOOT-001
└─ IPI-1140 · INTELLIGENCE-RAIL-001 (CREATE done) — soft after

AI capability
├─ PLANNER-001 → TOOL-001
└─ BRAND-INTEL-001 ∥ BRAND-001 (hard: APP + AUTH-002 only)

Wave B (parallel workspace COPY+CLEAN)
├─ ASSETS · CRM · OPERATIONS · TALENT-BOOKING · PLANS · ANALYTICS

M3 launch chain
├─ PLAN → APPROVAL → SAVE → WIZARD
├─ PLANNER-CONTEXT (remove SAVE hard block if still present)
└─ Soft shared context with Intelligence Rail

External (not MIGRATEv2 owners)
└─ AI-EVIDENCE-001 · UI-001
```

---

## Index · `marketing/`

| Task | File | Ready | Notes |
| --- | --- | --- | --- |
| IPI-1053 · MARKETING-NAV-001 | [`IPI-1053-MARKETING-NAV-001.md`](./IPI-1053-MARKETING-NAV-001.md) | YES | Soft NAV→LOGIN; NAV = merge gate HOME/SERVICES |
| IPI-1058 · MARKETING-LOGIN-001 | [`IPI-1058-MARKETING-LOGIN-001.md`](./IPI-1058-MARKETING-LOGIN-001.md) | YES | MIGRATEv2 already; remove NAV hard block |
| IPI-1089 · ONBOARD-001 | [`IPI-1089-ONBOARD-001.md`](./IPI-1089-ONBOARD-001.md) | YES | **Min tenancy first** — not 13-screen Lumina; AI out of path |
| IPI-1057 · MARKETING-HOME-001 | [`IPI-1057-MARKETING-HOME-001.md`](./IPI-1057-MARKETING-HOME-001.md) | YES | **Planner off `/` merge gate** |
| IPI-1060 · MARKETING-SERVICES-001 | [`IPI-1060-MARKETING-SERVICES-001.md`](./IPI-1060-MARKETING-SERVICES-001.md) | YES | Route-local composition — not mega-template |
| IPI-1064 · MARKETING-MEDIA-001 | [`IPI-1064-MARKETING-MEDIA-001.md`](./IPI-1064-MARKETING-MEDIA-001.md) | YES | HOME+SERVICES hard blockers; assets scanner |
| IPI-1063 · MARKETING-SEO-001 | [`IPI-1063-MARKETING-SEO-001.md`](./IPI-1063-MARKETING-SEO-001.md) | YES | Hard LOGIN+HOME+SERVICES; redirects + canonical host |

---

## Index · `dash-backend/`

| Task | File | Ready | Notes |
| --- | --- | --- | --- |
| IPI-1065 · APP-001 | [`../dash-backend/IPI-1065-APP-001.md`](../dash-backend/IPI-1065-APP-001.md) | YES | **Certify only** — shell merged |
| IPI-1066 · DASH-MAIN-001 | [`../dash-backend/IPI-1066-Dash-main.md`](../dash-backend/IPI-1066-Dash-main.md) | YES | **START after APP** · `/app` Command Center |
| IPI-1068 · BRAND-001 | [`../dash-backend/IPI-1068-BRAND-001.md`](../dash-backend/IPI-1068-BRAND-001.md) | YES | Wave A display |
| IPI-1067 · SHOOT-001 | [`../dash-backend/IPI-1067-SHOOT-001.md`](../dash-backend/IPI-1067-SHOOT-001.md) | YES | Wave A list/detail |
| INTELLIGENCE-RAIL-001 → **IPI-1140** | [`../dash-backend/INTELLIGENCE-RAIL-001.md`](../../../../MIGRATE/tasks/dash-backend/INTELLIGENCE-RAIL-001.md) | CREATE **DONE** | Soft Brand/Shoot; not IPI-1024 |
| IPI-1069 · ASSETS-001 | [`../dash-backend/IPI-1069-ASSETS-001.md`](../dash-backend/IPI-1069-ASSETS-001.md) | YES | Wave B |
| IPI-1070 · CRM-001 | [`../dash-backend/IPI-1070-CRM-001.md`](../dash-backend/IPI-1070-CRM-001.md) | YES | Wave B |
| IPI-1072 · OPERATIONS-001 | [`../dash-backend/IPI-1072-OPERATIONS-001.md`](../dash-backend/IPI-1072-OPERATIONS-001.md) | YES | Wave B |
| IPI-1071 · TALENT-BOOKING-001 | [`../dash-backend/IPI-1071-TALENT-BOOKING-001.md`](../dash-backend/IPI-1071-TALENT-BOOKING-001.md) | YES | Wave B screens |
| IPI-1074 · PLANS-001 | [`../dash-backend/IPI-1074-PLANS-001.md`](../dash-backend/IPI-1074-PLANS-001.md) | YES | Wave B workspace |
| IPI-1073 · ANALYTICS-001 | [`../dash-backend/IPI-1073-ANALYTICS-001.md`](../dash-backend/IPI-1073-ANALYTICS-001.md) | YES | Wave B honest shell |
| IPI-1048 · PLANNER-001 | [`../dash-backend/IPI-1048-PLANNER-001.md`](../dash-backend/IPI-1048-PLANNER-001.md) | YES | After STREAM |
| IPI-1049 · TOOL-001 | [`../dash-backend/IPI-1049-TOOL-001.md`](../dash-backend/IPI-1049-TOOL-001.md) | YES | After PLANNER |
| IPI-1093 · BRAND-INTEL-001 | [`../dash-backend/IPI-1093-BRAND-INTEL-001.md`](../dash-backend/IPI-1093-BRAND-INTEL-001.md) | YES | MIGRATEv2 already; no BRAND hard block |
| IPI-1081 · PLAN-001 | [`../dash-backend/IPI-1081-PLAN-001.md`](../dash-backend/IPI-1081-PLAN-001.md) | YES | M3; keep 4 upstream |
| IPI-1084 · APPROVAL-001 | [`../dash-backend/IPI-1084-APPROVAL-001.md`](../dash-backend/IPI-1084-APPROVAL-001.md) | YES | M3 HITL |
| IPI-1083 · SHOOT-SAVE-001 | [`../dash-backend/IPI-1083-SHOOT-SAVE-001.md`](../dash-backend/IPI-1083-SHOOT-SAVE-001.md) | YES | M3 save once |
| IPI-1085 · SHOOT-WIZARD-001 | [`../dash-backend/IPI-1085-SHOOT-WIZARD-001.md`](../dash-backend/IPI-1085-SHOOT-WIZARD-001.md) | YES | M3 wizard |
| IPI-1087 · PLANNER-CONTEXT-001 | [`../dash-backend/IPI-1087-PLANNER-CONTEXT-001.md`](../dash-backend/IPI-1087-PLANNER-CONTEXT-001.md) | YES | Remove SAVE blockedBy if present |
| IPI-172 · AI-EVIDENCE-001 | [`../dash-backend/IPI-172-AI-EVIDENCE-001.md`](../dash-backend/IPI-172-AI-EVIDENCE-001.md) | YES | External; not MIGRATEv2 owner |
| IPI-1051 · UI-001 | [`../dash-backend/IPI-1051-UI-001.md`](../dash-backend/IPI-1051-UI-001.md) | YES | External; not MIGRATEv2 owner |

Also see: [`../dash-backend/README.md`](../dash-backend/README.md) when present.

---

## Recommended Linear patch order (both folders)

1. MIGRATEv2 hygiene + CREATE Rail — **done** (**IPI-1140**)
2. Relation fixes: soften NAV→LOGIN; remove SAVE→CONTEXT; confirm no BRAND→INTEL hard block
3. **`marketing/`** addenda (corrected specs only)
4. **`dash-backend/`**: DASH-MAIN first, then BRAND, SHOOT
5. AI: PLANNER, TOOL, BRAND-INTEL
6. Wave B dashboards
7. M3 launch + CONTEXT
8. External: AI-EVIDENCE, UI-001
9. **Separate:** Next.js ≥16.3.3

**Counts:** marketing **8** specs · dash-backend **19** specs · parent index [`../README.md`](../README.md)

---

## Production-ready checklist (marketing lane)

- [ ] Next.js patched in a **separate** security PR (≥16.3.3)
- [ ] One `(marketing)` layout; one shared header/footer
- [ ] Exactly five canonical service routes
- [ ] No public marketing CopilotKit / MarketingChat
- [ ] Planner reachable from new route before marketing owns `/`
- [ ] `/login` sign-in/signup + allowlisted redirects; zero-org → onboarding
- [ ] ONBOARD: min RPC journey green before optional Lumina screens; AI cannot block `/app`
- [ ] `/login` page-level noindex (LOGIN owns; SEO verifies)
- [ ] No unsupported customer/metric claims
- [ ] Static media inventory zero missing refs; `next/image` sizing
- [ ] Sitemap = canonical public set; centralized one-hop redirects
- [ ] Canonical host never localhost/Preview; no fake `lastModified`
- [ ] Operator HOME: trusted org + cross-org negative proof
- [ ] Tests → typecheck → build → desktop + ~390px · task-verifier Full · one concern per PR
