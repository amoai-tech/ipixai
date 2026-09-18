# IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot

**File:** `IPI-1085-SHOOT-WIZARD-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot

## 2. Current V2 owner / scope

Thin UI composition over PLAN→APPROVAL→SAVE. Not a second domain system.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(operator)/app/shoots/new
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/shoot
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/shoot-wizard.ts

## 4. COPY

Wizard visual UX/CSS/stepper/E2E ideas.

## 5. ADAPT

Deterministic state from PLAN/APPROVAL/SAVE contracts; refresh/back/forward; invalidation on upstream change.

## 6. DROP

Old shoot-wizard workflow runtime; HITL/save implementation; second plan state model.

## 7. Exact additions / corrections required in the Linear issue

- Deterministic wizard state from canonical contracts
- Refresh/back/forward; duplicate-submit protection
- Upstream plan change invalidates stale approval/save state
- No second copy of plan state

## 8. Acceptance criteria additions

- [ ] Wizard is composition only
- [ ] Duplicate submit safe
- [ ] Regen invalidates stale wizard approval/save

## 9. Dependency / relation correction

Hard: after SAVE (and PLAN/APPROVAL chain).

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

COPY wizard chrome → wire to V2 contracts → DROP workflow.

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/(operator)/app/shoots/new/page.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/shoot/shoot-wizard.module.css
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/shoot/shoot-wizard-context.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/shoot-wizard.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/shoot-wizard.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/index.ts

## Faster/better approach
Treat wizard as **thin composition** over already-proven PLAN → APPROVAL → SHOOT-SAVE contracts. Reuse stepper/layout/CSS/test ideas, not the old workflow runtime.

## Red flags / fixes
- second plan state machine → canonical PLAN artifact only.
- old suspend/resume workflow copied → DROP.
- browser refresh loses approved state or submits twice → deterministic identifiers/idempotency.
- upstream edit keeps stale approval/save state → invalidate downstream state.

## Score / production gate
Architecture 100 · Reuse 99 · State safety 99 · Overall **99/100 provisional**. Success = back/forward/refresh safe, duplicate submit harmless, stale approval invalidated, no duplicate compute/save logic, ~390px + targeted E2E/typecheck/build.

