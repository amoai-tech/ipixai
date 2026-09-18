# IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics

**File:** `IPI-1073-ANALYTICS-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics

## 2. Current V2 owner / scope

Analytics workspace. Real metrics only.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(operator)/app/analytics
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/analytics
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/analytics.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/analytics.test.ts

## 4. COPY

Analytics layout/charts UI; pure `lib/analytics` + tests.

## 5. ADAPT

Bind only metrics with V2 truth; unsupported → N/A/empty.

## 6. DROP

Fake CTR/conversions; AI explanations as truth; synthetic zeros.

## 7. Exact additions / corrections required in the Linear issue

Required metric provenance table in implementation evidence:
`metric → definition → V2 table/query → freshness → supported YES/NO`
Unsupported old metrics = empty/N/A, never synthetic zero.

## 8. Acceptance criteria additions

- [ ] Provenance table attached to PR
- [ ] No unsupported metric rendered as 0
- [ ] Org-scoped analytics reads

## 9. Dependency / relation correction

APP-001. Soft after spine; parallel with PLANS.

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

Port analytics UI + lib/tests → bind proven queries only.

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/analytics/analytics-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/analytics/analytics-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/analytics/campaign-performance-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/analytics/campaign-performance-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/analytics.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/analytics.test.ts

## Faster/better approach
Build the metric provenance table first; only render cards/charts with a current authoritative query. Reuse UI/pure aggregators after that.

## Red flags / fixes
- unsupported metric rendered as `0` → N/A/hidden.
- AI explanation presented as metric truth → separate narrative from source data.
- mixed-org aggregation → every query explicitly bound to trusted active org.
- stale campaign-specific screens pulled into general analytics → only supported current metrics.

## Score / production gate
Correctness 100 · Honesty 100 · Security 99 · Overall **99/100 provisional**. Success = PR contains `metric → definition → source/query → freshness → supported`, no synthetic zeros, org-safe reads, targeted analytics tests/typecheck/build/browser.

