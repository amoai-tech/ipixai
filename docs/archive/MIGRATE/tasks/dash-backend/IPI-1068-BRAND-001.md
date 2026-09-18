# IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles

**File:** `dash-backend/IPI-1068-BRAND-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES  
**Audit:** Batch 1 · local 92→**~99/100** (live Linear already ~98 — sync deltas below)

---

## 0. Faster / better — FIRST / default method

```text
1. Start from clean current origin/main
2. Resolve authenticated user + AUTH-002 trusted active org
3. Implement smallest server-only list/detail loaders
4. Explicitly constrain every read to trusted org (.eq("org_id", trustedOrgId))
   — RLS is defense-in-depth (membership-union), not active-org selection
5. Prove one cross-org negative case BEFORE porting UI
6. Map DB rows → BrandListItem / BrandDetail view model
7. COPY+CLEAN Lumina presentation only after data contract is green
8. Do not add schema/RPC unless direct current-stack reuse cannot meet ACs
9. Targeted tests → typecheck → build → browser
```

**Do not:** COPY UI first → fix auth afterward.

Common pattern:

```text
AUTH-002 trusted org → server page / DAL → explicit active-org filter
→ Supabase RLS (defense-in-depth) → small display model → Lumina UI
```

---

## 1. Task full name

IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles

## 2. Current V2 owner / scope

Operator Brand list/detail. Display-only approved DNA/scores.  
**Route:** `/app/brands` and `/app/brands/[id]` (current V2 nav) — **not** Lumina `/app/brand` for parity.  
Current V2: generic `[section]` EmptyState placeholder.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/brand-hub
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/brand-list-filters.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/brand-detail-greeting.ts
- Prefer `amoai-tech/luminaai` over stale `amo-tech-ai/lumina-studio` attachments

## 4. SELECTIVE COPY / ADAPT

**COPY/ADAPT only:**

- `BrandListWorkspace`
- approved-display portions of `BrandDetailWorkspace`
- list cards, search/filter UI
- display score components
- pure filters / greeting helpers / tests
- loading / empty / error UI

## 5. ADAPT

Server-trusted org filtering; map to current `brands` + `brand_scores`; active-brand as presentation hint only.

## 6. DROP

- `BrandApprovalCard`, analysis banners, draft cards
- crawl / restart / generation / Brand Intelligence runtime
- legacy active-brand tenant mutation
- browser-chosen org; service-role; `user_metadata` authz

## 7. Exact additions / corrections for Linear addendum

- Prepend data-contract-first method (§0) — reverse “COPY brand-hub → wire queries”
- Exact route `/app/brands` (not `/app/brand`)
- Explicit SELECTIVE COPY + DROP approval/draft/analysis
- Skills: lean / cheapest-proof-first (do not require missing `ponytail` skill path)

## 8. Acceptance criteria

- [ ] List `.eq("org_id", trustedOrgId)`; detail binds brand ID + trusted org
- [ ] Org A list ≠ Org B; foreign ID under active Org A → 404
- [ ] Approved `brands.ai_profile` + persisted `brand_scores` only
- [ ] No crawl/generation/restart/draft promotion
- [ ] Loading / empty / success / retryable error / unauthorized
- [ ] Desktop + ~390px

## 9. Dependencies

Hard: APP-001. Related: AUTH-002, BRAND-INTEL (display vs generate — no BRAND→INTEL hard block). Soft before Rail.

## 10. READY TO PATCH LINEAR

**YES** — prepend addendum deltas only (live body already strong).

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/(operator)/app/brand/page.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/brand-hub/brand-list-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/brand-hub/brand-list-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/(operator)/app/brand/[id]/page.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/brand-hub/brand-detail-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/brand-hub/brand-detail-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/brand-list-filters.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/brand-detail-greeting.ts

## Current Supabase truth
`public.brands` has `org_id`, `ai_profile`, `ai_profile_draft`; `public.brand_scores` is persisted score truth. Use explicit `.eq("org_id", trustedOrgId)` for list/detail.

## Faster/better approach
Data contract + cross-org proof first → small Brand view model → COPY+CLEAN list/detail presentation.

## Red flags / fixes
- Lumina `/app/brand` route → adapt to V2 `/app/brands`.
- Draft/analysis controls leaking into browse task → DROP.
- legacy active-brand/browser tenant authority → presentation hint only.
- approved vs draft profile confusion → display approved `ai_profile` + persisted scores only.

## Score / production gate
Architecture 100 · Security 99 · Reuse 99 · Overall **99/100 provisional**. Success = trusted-org list/detail, foreign brand 404, honest states, no crawl/promotion writes, desktop/~390px, targeted tests/typecheck/build/browser.

