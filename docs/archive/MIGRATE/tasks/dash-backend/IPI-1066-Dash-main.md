# IPI-1066 · DASH-MAIN-001 — Reuse the Proven iPix Command Center as the Main Dashboard Page

**File:** `dash-backend/IPI-1066-Dash-main.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes  
**Route:** `/app`  
**Surface:** authenticated operator Dashboard Main / Command Center  
**Not:** public marketing page  
**Audit score:** 99/100 provisional

---

## 0. Faster/better approach — FIRST/default method

**Start after APP-001 certify. Do not wait for BRAND-001 or SHOOT-001 UI** — those are soft sequencing, not hard deps. Dashboard reads canonical tables directly.

```text
1. Verify current APP-001 shell owns /app.
2. Change nav label Home → Dashboard; replace HOME-001 placeholder naming with DASH-MAIN-001.
3. Resolve trusted active org server-side.
4. Build the dashboard card provenance matrix.
5. Implement the smallest direct canonical reads (brands / shoot.shoots / planner / approvals).
6. Prove Org A cannot receive Org B counts/items.
7. COPY+CLEAN Lumina Command Center presentation/helpers (not wholesale queries.ts).
8. Honest empty/error/loading; degrade failed cards independently where practical.
9. ~390px → targeted tests → typecheck → build → exact-SHA browser proof.
10. Add no new table/RPC/AI agent/cache unless direct current-stack reuse fails a required proof.
```

**Faster path:** useful `/app` landing immediately via canonical reads; full Brand/Shoot workspaces next. Link cards to placeholder or full routes as they ship.
## 1. Purpose and current state

`IPI-1066 · DASH-MAIN-001 — Reuse the Proven iPix Command Center as the Main Dashboard Page` owns the authenticated operator landing surface at `/app`.

Current `ipixai` main already has the APP-001 shell, navigation, center content slot, and Intelligence Rail slot. `/app` currently renders an honest Command Center placeholder. This task replaces only that center-slot placeholder with real organization-aware dashboard content.

APP-001 is a current-main recertification/merge contract, not a missing-shell implementation problem. AUTH-002 is reused for trusted organization identity. ONBOARD-001 owns zero-org/first-brand onboarding. **BRAND-001 / SHOOT-001 are not start blockers** — only soft follow-ons for richer deep-links.

## 2. Exact Lumina references

- `app/src/app/(operator)/app/page.tsx`
- `app/src/components/command-center/command-center.tsx`
- `app/src/components/command-center/portfolio-hero-card.tsx`
- `app/src/components/command-center/recent-work-row.tsx`
- `app/src/components/command-center/quick-action-chips.tsx`
- `app/src/components/command-center/command-center-approvals.tsx`
- `app/src/components/command-center/command-center-empty.tsx`
- `app/src/components/command-center/command-center-error-banner.tsx`
- `app/src/components/command-center/command-center-skeleton.tsx`
- `app/src/lib/command-center/derive-view-state.ts`
- `app/src/lib/command-center/greeting.ts`
- `app/src/lib/command-center/queries.ts`

Verified legacy warning: `queries.ts` filters brands and intake drafts by `user_id` and uses `shoot_portfolio_view`; those tenancy/data assumptions are not V2 authority.
## 3. COPY / ADAPT / DROP

### COPY+CLEAN

- Command Center layout and cards
- empty/error/skeleton states
- greeting and deterministic view-state helpers
- recent-work presentation/fallback helpers
- pure types and tests that remain compatible

### ADAPT

- trusted-org server queries
- card data mapping to current canonical V2 tables
- quick links to only shipped operator routes
- brand hero as presentation only; no client tenant mutation
- partial-failure handling per independent card/read

### DROP

- `CommandCenterBrandSync` tenant mutation
- `?skip=` development fixtures
- sample-image/dev data used as business truth
- `user_id` tenancy
- old client active-brand authority
- wholesale `shoot_portfolio_view` or `brand_intake_drafts` query reuse
- AI-generated dashboard narrative or separate Dashboard Main agent
- render-time writes, approvals, publishing, or new analytics truth

## 4. Required provenance matrix

| Dashboard card | Canonical truth | Required scope |
| --- | --- | --- |
| Brands | `public.brands` | `org_id = trustedOrgId` |
| Shoots | `shoot.shoots` | trusted-org brand ownership |
| Planning | `planner.instances` / `planner.tasks` | `org_id = trustedOrgId` + planner authorization |
| Approvals | current verified approval source only | trusted org/entity ownership |

RLS remains defense-in-depth. It does not replace explicit active-org filtering.
## 5. Acceptance criteria

- [ ] `/app` remains the route; no duplicate dashboard route is introduced.
- [ ] APP-001 shell contract is verified on current main before merge.
- [ ] Dashboard Main renders real trusted-org data or an honest empty state—never fixtures.
- [ ] Org A never receives Org B brand/shoot/planner names, counts, IDs, or statuses.
- [ ] Each retained card has an explicit canonical source and tenant-scope rule.
- [ ] Independent query failure degrades only the affected card where practical.
- [ ] Zero-org / zero-brand flow hands off to ONBOARD-001 or the approved empty boundary.
- [ ] No second auth/org resolver, browser service-role, or client-selected tenant authority.
- [ ] No separate Dashboard Main AI agent, fake metrics, or generated source of truth.
- [ ] No render-time mutation.
- [ ] Desktop and ~390px layouts remain usable inside APP-001.
- [ ] Targeted tests, typecheck, build, and exact-SHA browser verification pass.

## 6. Blockers / red flags

1. **Legacy tenancy mismatch:** Lumina uses `user_id`; V2 must use trusted active-org ownership.
2. **Legacy shoot source:** do not make `shoot_portfolio_view` canonical merely because the old page used it.
3. **Approval ambiguity:** render an approval card only after its current canonical source is verified.
4. **Membership-union RLS:** explicit active-org filtering is still required.
5. **APP-001 stale descriptions:** shell exists; treat APP-001 as recertification, not missing implementation.
6. **Scope creep:** CRM, inbox, analytics, Planner chat, AI generation, writes, and broad personalization stay outside this task.
7. **Route churn:** do not rename `/app`; only task/product terminology changes to Dashboard Main.

## 7. Production-readiness score

| Area | Score |
| --- | ---: |
| Scope clarity | 100/100 |
| Architecture | 100/100 |
| Security design | 99/100 |
| Reuse/efficiency | 99/100 |
| Verification plan | 99/100 |
| Current implementation readiness | 82/100 — center slot is still a placeholder |
| Overall task quality | **99/100 provisional** |

**Will the task succeed?** Yes, if implementation follows the provenance-first trusted-org read model and selectively reuses Lumina presentation instead of porting its old query layer.

## 8. Linear patch intent

Rename the Linear task to:

`IPI-1066 · DASH-MAIN-001 — Reuse the Proven iPix Command Center as the Main Dashboard Page`

Remove `HOME-001` / operator-dashboard "Home" terminology from the task. Preserve `/app` as the route and keep public marketing `/` owned by MARKETING-HOME-001.
## 9. Required code naming integration

When DASH-MAIN-001 is implemented:

- change APP-001 navigation display label for `/app` from `Home` to `Dashboard`
- change the current `/app` placeholder marker from `HOME-001` to `DASH-MAIN-001` before replacing it with real content
- keep the route `/app`; do not introduce `/dashboard` or `/app/dashboard` unless a separate IA decision explicitly requires it
- do not rename the public marketing task `IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App`

---

# AUTHORITATIVE FULL-URL + PRODUCTION AUDIT REFRESH — 2026-09-03

**Code authority:** audit and implement from a clean/current `amoai-tech/ipixai@main` / `origin/main`, not the current dirty docs worktree. At audit time local HEAD was `dbc6f0b...` while `origin/main` was `b034423...`. Re-check SHA at task start.

**Global execution rule:** inspect `package.json` + installed source/types first; current package/runtime contracts beat stale issue pins. The current skill tree has no `ponytail` skill, so use explicit cheapest-proof-first verification instead.

**Official implementation authority when relevant:**
- https://github.com/vercel/next.js
- https://github.com/supabase/supabase
- https://github.com/mastra-ai/mastra
- https://github.com/CopilotKit/CopilotKit

Use the official repository only to resolve current framework/library behavior; installed versioned source/types in ipixai still win when upstream `main` has moved ahead.

## Exact Lumina sources
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/(operator)/app/page.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/command-center/command-center.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/command-center/portfolio-hero-card.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/command-center/recent-work-row.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/command-center/quick-action-chips.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/command-center/command-center-approvals.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/command-center/command-center-empty.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/command-center/command-center-error-banner.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/command-center/command-center-skeleton.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/command-center/derive-view-state.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/command-center/greeting.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/command-center/queries.ts

## Current ipixai proof
- https://github.com/amoai-tech/ipixai/blob/main/src/app/app/page.tsx
- https://github.com/amoai-tech/ipixai/blob/main/src/components/operator-panel/nav.ts

## Faster/better approach
Build the smallest trusted-org server model first, then COPY+CLEAN presentation. Do not port Lumina `queries.ts` tenancy assumptions.

## Red flags / fixes
- Lumina `user_id` tenancy → current trusted active-org filtering.
- `shoot_portfolio_view` as SSOT → canonical `shoot.shoots`; view only if useful after ownership proof.
- Approval card with ambiguous source → use a verified current approval source only.
- Current code still says `HOME-001` / nav `Home` → change to `DASH-MAIN-001` / `Dashboard`.

## Score / production gate
Architecture 100 · Security 99 · Reuse 99 · Readiness 82 · Overall **99/100 provisional**. Success = real org-safe data or honest empty states, no fake metrics, partial-failure behavior, ~390px, targeted tests/typecheck/build/browser proof.

