# IPI-1140 · IPI-1140 · INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace

**File:** `IPI-1140-INTELLIGENCE-RAIL-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace

## 2. Current V2 owner / scope

NEW V2 owner for APP-001 right-rail content. Read/display-first. Do **not** reuse IPI-1024.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/intelligence-panel
- https://github.com/amoai-tech/luminaai/tree/main/app/src/lib/intelligence
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/evidence-block
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/brand-context-panel

## 4. COPY

Panel chrome; route briefing; DNA/status; approvals attention; activity; evidence dialog; AI context card; EvidenceBlock; brand-context-panel presentation.

## 5. ADAPT

lib/intelligence builders/contracts/route-normalization → server-authorized current-org Brand/Shoot; share verified context with PLANNER-CONTEXT.

## 6. DROP

dev-panel-fixture; old /api/intelligence/*; fake/proactive fixture cards; write paths; separate Intelligence agent; browser tenant authority.

## 7. Exact additions / corrections required in the Linear issue

### Proposed CREATE body essentials
- Data-source contract per panel section (canonical V2 source named)
- Route-change stale-data test; clear foreign Brand/Shoot on route/org change
- v1 sections only when data exists: Context, DNA health, Shoot status, Approvals, Activity, Evidence
- Parent: dashboard epic or APP/HOME; Milestone M2; labels MIGRATEv2 + DASHV2

## 8. Acceptance criteria additions

- [ ] Authenticated operator: Home↔Brand↔Shoot show compact read-only rail from server-authorized org data only
- [ ] Stale Brand/Shoot context clears on route/org change
- [ ] No authoritative data ⇒ section empty/hidden — never fixture content
- [ ] Evidence via shared EvidenceBlock
- [ ] No new agent, write path, duplicate tenant resolver

## 9. Dependency / relation correction

Soft: useful after Brand/Shoot loaders. **Not** hard blocker for Wave B. Do not blockedBy IPI-1024.

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

COPY panel + EvidenceBlock → ADAPT lib/intelligence to trusted context → DROP APIs/fixtures.

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

## Live task identity correction
Live Linear already owns this as **IPI-1140 · INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace**. Rename this local file to `IPI-1140-INTELLIGENCE-RAIL-001.md`; this is no longer a CREATE task.

## Exact Lumina sources
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/intelligence-panel/intelligence-panel-sections.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/intelligence-panel/ai-context-card.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/intelligence-panel/approvals-section.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/intelligence-panel/dna-scores-section.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/intelligence-panel/health-section.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/intelligence-panel/evidence-dialog.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/intelligence-panel/intel-approval-card.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/intelligence-panel/intel-approval-queue-section.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/evidence-block/evidence-block.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/evidence-block/evidence-block.test.tsx

## Faster/better approach
Reuse panel/evidence presentation over the **same verified context contract as PLANNER-CONTEXT**. Read/display first; no new agent, API family, or write system.

## Red flags / fixes
- stale route/org context → clear on identity/version change.
- fixture/proactive cards without data → hide/empty.
- approval section invents new approval truth → map to verified current source.
- duplicate tenant resolver → shared server context only.

## Score / production gate
Architecture 100 · Security 99 · Reuse 100 · Overall **99/100 provisional**. Success = Dashboard/Brand/Shoot show compact current-org rail, stale context clears, evidence shared, no fixtures/new agent/write path, ~390px behavior + targeted tests/typecheck/build/browser.

