# IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records

**File:** `dash-backend/IPI-1067-SHOOT-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** NO — implementation merged and verified  
**Status:** **IMPLEMENTED / POST-MERGE VERIFIED** · PR #85 merged (`304fe46`), with follow-up cursor hotfix PR #89 merged. Current `main` retains dedicated shoot routes and targeted/E2E coverage.

---

## 0. Faster / better — FIRST / default method

```text
1. Start from clean current origin/main
2. Resolve AUTH-002 trusted active org
3. Implement smallest server-only canonical data query first
4. Explicitly constrain every list/detail read to trusted org; RLS = defense-in-depth
5. Prove one cross-org negative case before porting UI
6. Reuse Lumina presentation only after data contract is green
7. Do not add schema/RPC/media infrastructure unless direct reuse cannot meet ACs
8. Targeted tests → typecheck → build → browser
```

### List (no migration required)

```text
trusted org → brands WHERE org_id = trustedOrgId → brand IDs
→ shoot_portfolio_view WHERE brand_id IN (...)
```

Canonical SSOT: `shoot.shoots`. View exposes `brand_id`, not `org_id`. Membership-union ≠ active-org.

### Detail — public-contract-first; no direct `shoot` Data API read

```text
AUTH-002 trusted org
→ trusted brand IDs
→ public.shoot_portfolio_view WHERE id = shootId AND brand_id IN (...)
→ no match = 404
→ public.get_shoot_detail(shootId) for hydrated read-only payload only
→ validate/project the JSON payload at the DAL boundary
```

`shoot.shoots` remains the canonical SSOT, but the `shoot` schema is intentionally SQL/RPC-only in the current runtime. Do not call `.schema("shoot")` and do not broaden Data API exposure for SHOOT-001.

`public.get_shoot_detail` is membership-union `SECURITY DEFINER`, so it is never the active-org authority. A new org-bound RPC is a last resort only if the verified public-view preauthorization + hydration composition cannot meet observable acceptance criteria.

---

## 1. Task full name

IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records

## 2. Current V2 owner / scope

Browse list/detail + lifecycle tab IA. No wizard/HITL/media/booking.  
**Routes:** `/app/shoots`, `/app/shoots/[shootId]`.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/shoot
- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(operator)/app/shoots
- Prefer `amoai-tech/luminaai` over stale studio attachments

## 4. SELECTIVE COPY / ADAPT

Keep: `ShootsListWorkspace`, `ShootCard`, display-only `ShootDetailWorkspace`, filtering/search, lifecycle tab IA, loading/error tests.

## 5. ADAPT

Trusted-org list/detail as §0; unsupported tabs → empty/disabled.

## 6. DROP

Agent Context; Generate Shot List; ActiveBrand mutations; Wizard; HITL; Save; Booking mutation; upload/media; AI activity; `public.shoots` SSOT regression.

## 7. Exact additions / corrections for Linear addendum

- **Replace** all direct `shoot.shoots` Data API wording with **public-contract-first active-org preauthorization → existing detail RPC hydration**
- Keep list via brand IDs + `shoot_portfolio_view`
- Data-contract-first §0; lean skills wording

## 8. Acceptance criteria

- [x] List scoped through active-org brand IDs
- [x] Detail: trusted-org brand IDs → `shoot_portfolio_view` preauthorization → 404 on mismatch → `get_shoot_detail` hydration only; never membership-union-only as authority
- [x] Org A cannot open Org B shoot; foreign ID → 404
- [x] Browse avoids dashboard `SHOOT_LIMIT=6` truncation and uses deterministic cursor/keyset pagination
- [x] Hydrated `get_shoot_detail` JSON is runtime-validated at the DAL boundary; malformed payloads fail closed
- [x] Controlled two-org runtime proof completed in `e2e/shoots-journey.spec.ts`
- [x] Unsupported tabs remain honest/disabled where not implemented
- [x] No wizard/HITL/Save/booking/media scope creep in SHOOT-001
- [x] Loading / empty / error / unauthorized behavior covered by implementation tests

## 9. Dependencies

Hard: APP-001 + AUTH-002 (live). Soft before Rail. Unblocks PLAN with BRAND.

## 10. Post-merge verification

**DONE.** PR #85 merged as `304fe46` and the timestamp/cursor correctness hotfix merged in PR #89. Current `main` contains `/app/shoots`, `/app/shoots/[shootId]`, DAL tests, and `e2e/shoots-journey.spec.ts`. Historical pre-merge evidence is preserved in the local archive snapshot, not treated as current state.

---

# AUTHORITATIVE FULL-URL + PRODUCTION AUDIT REFRESH — 2026-09-03

**Code authority:** audit and implement from a clean/current `amoai-tech/ipixai@main` / `origin/main`. At the 2026-09-06 refresh, local HEAD and `origin/main` both resolved to `5a904b7`; re-check SHA at task start.

**Global execution rule:** inspect `package.json` + installed source/types first; current package/runtime contracts beat stale issue pins. The current skill tree has no `ponytail` skill, so use explicit cheapest-proof-first verification instead.

**Official implementation authority when relevant:**
- https://github.com/vercel/next.js
- https://github.com/supabase/supabase
- https://github.com/mastra-ai/mastra
- https://github.com/CopilotKit/CopilotKit

Use the official repository only to resolve current framework/library behavior; installed versioned source/types in ipixai still win when upstream `main` has moved ahead.

## Exact Lumina sources
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/(operator)/app/shoots/page.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/shoot/shoots-list-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/shoot/shoots-list-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/(operator)/app/shoots/[shootId]/page.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/shoot/shoot-detail-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/shoot/shoot-detail-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/shoot/get-shoot-detail.ts

## Current Supabase truth
Canonical V2 shoot truth is `shoot.shoots`; legacy `public.shoots` also exists and must not be revived. Existing `public.get_shoot_detail(p_shoot_id)` is SECURITY DEFINER, so it is **not automatically active-org authority**.

## Faster/better approach
Trusted org → allowed brand IDs → `shoot_portfolio_view` for list and detail preauthorization → existing `get_shoot_detail` for hydrated read-only detail. Add a new org-bound RPC only if this verified composition cannot satisfy an observable requirement cleanly.

## Red flags / fixes
- SECURITY DEFINER detail RPC without active-org binding → `shoot_portfolio_view` trusted-brand preauthorization first; new org-bound RPC only if the verified composition fails an observable requirement.
- Membership-union visibility → explicit active-org brand filter.
- Legacy view becomes canonical → prohibit.
- Wizard/HITL/media scope creep → separate tasks.

## Score / production gate
Correctness **98** · Security **98** · Reuse **96** · Overall **98/100 VERIFIED IMPLEMENTATION**. Current-main evidence includes dedicated routes, targeted DAL tests, cross-org E2E coverage, review fixes, and the timestamp/cursor hotfix. Future media/HITL/booking work remains intentionally outside SHOOT-001.

