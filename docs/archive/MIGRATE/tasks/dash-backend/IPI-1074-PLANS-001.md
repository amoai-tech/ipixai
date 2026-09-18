# IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans

**File:** `IPI-1074-PLANS-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans

## 2. Current V2 owner / scope

Saved planning workspace at `/app/plans`. Not conversational Planner / ShootPlanSchema.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(operator)/app/planner
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/planner

## 4. COPY

Planner hub timeline/kanban/calendar/list UI concepts; deterministic view helpers.

## 5. ADAPT

Map to V2 saved-plan storage when present; distinguish from PLAN-001 artifact.

## 6. DROP

Conversational Planner runtime; incomplete mutations; duplicate ShootPlanSchema types.

## 7. Exact additions / corrections required in the Linear issue

- Explicit distinction: `/app/plans` = persisted planning workspace/view; PLAN-001 = conversational structured artifact
- Avoid duplicate plan domain types
- Timeline/kanban/calendar/list where present

## 8. Acceptance criteria additions

- [ ] `/app/plans` shows workspace UI without weather/demo Planner coupling
- [ ] No second ShootPlanSchema invented here
- [ ] Honest empty if no saved plans

## 9. Dependency / relation correction

APP-001. Soft Wave C; parallel ANALYTICS.

## 10. Checklist

- [ ] Current Linear issue read first
- [ ] Current `ipixai` target code inspected
- [ ] Exact Lumina URLs/files listed
- [ ] COPY / ADAPT / DROP documented
- [ ] Pure tests identified for reuse
- [ ] Old API inspected only for contract/tests when needed
- [ ] Current auth/org/schema/runtime remains authority
- [ ] No browser service-role / tenant authority
- [ ] No obsolete Worker/custom SSE
- [ ] No fake data/metrics
- [ ] Loading/empty/success/error/unauthorized where UI
- [ ] Cross-org negative proof where tenant data
- [ ] Exact ACs + dependency changes listed
- [ ] At task start: inspect `package.json` scripts (as of 2026-09-03 `npm run dev` disabled → `dev:ui` / `dev:agent`)
- [ ] Installed package versions recorded at task start (ignore stale pins in issue body)

## 11. Faster / better approach

COPY planner workspace UI → wire deterministic views → keep AI Planner separate.

## 12. READY TO PATCH LINEAR

**YES**

Patch style: prepend `AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03` with only deltas above — do not rewrite the full issue body.

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/dashboard-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/dashboard-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/adaptive-panel.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/adaptive-panel.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/hub-card.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/hub-filters.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/hub-params.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/hub-params.test.ts

## Current Supabase truth
`planner.instances`, tasks/dependencies/events and gate approvals already exist. Do not create a second persistence model. `/app/plans` is the saved production-planning workspace; `IPI-1081 · PLAN-001` owns the conversational `ShootPlanSchema`.

## Faster/better approach
Direct org-filtered planner reads → small workspace view model → reuse hub/cards/filters/views. Keep Planner AI and PLAN artifact separate.

## Red flags / fixes
- duplicate `ShootPlan` type → prohibit.
- client-side tenant selection → trusted org.
- unsupported timeline/calendar detail invented → honest empty/limited view.
- planner gate mutation UI pulled in prematurely → separate approval ownership.

## Score / production gate
Architecture 100 · Security 99 · Reuse 99 · Overall **99/100 provisional**. Success = saved plans show real planner truth under active org, no duplicate schema, honest empty states, targeted tests/typecheck/build/browser.

