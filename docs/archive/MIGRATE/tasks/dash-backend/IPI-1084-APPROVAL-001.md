# IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved

**File:** `IPI-1084-APPROVAL-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved

## 2. Current V2 owner / scope

HITL review of exact plan snapshot. Current Mastra/CopilotKit interrupt authority.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/approval-card
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/ui (approval-card)
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/shoot
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/copilot

## 4. COPY

Approval card chrome/states/tests; shoot deliverables/shotlist/budget review UX.

## 5. ADAPT

Current useInterrupt / AG-UI; generative UI presentation concepts; immutable reviewed revision.

## 6. DROP

Old resume endpoints; HITL shims; writes before approval.

## 7. Exact additions / corrections required in the Linear issue

- Immutable reviewed revision identity/hash/version
- Approval refers to exact plan snapshot shown; regeneration invalidates old approval
- Centralized generative UI concepts reusable; no old resume transport

## 8. Acceptance criteria additions

- [ ] Zero consequential domain writes before approval
- [ ] Stale approval rejected after regen/edit
- [ ] Accessibility + duplicate-click tests

## 9. Dependency / relation correction

Hard: PLAN-001.

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

COPY approval UI → bind V2 interrupt + revision hash → DROP resume.

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/approval-card/approval-actions.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/approval-card/approval-card-shell.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/approval-card/approval-card.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/approval-card/approval-comparison.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/approval-card/approval-evidence.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/approval-card/approval-header.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/gate-approval-card.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/planner/gate-approval-card.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/copilot/generative-ui-registry.tsx

## Current Supabase note
`planner.gate_approvals` already has idempotency/request-hash fields, but scheduling-gate approval is not automatically the same semantic object as a shoot-plan approval. Map explicitly or keep the PLAN approval contract separate.

## Faster/better approach
Reuse approval presentation/tests; bind current CopilotKit/Mastra interrupt/review UX to an immutable `ShootPlanSchema` revision/hash. No domain write happens here.

## Red flags / fixes
- approve latest mutable draft instead of viewed revision → exact hash/version.
- edit/regenerate leaves prior approval valid → invalidate stale approval.
- double click/retry duplicates transition → idempotent UI/server contract.
- old resume endpoints/shims → DROP.

## Score / production gate
Architecture 100 · HITL integrity 99 · Reuse 99 · Overall **99/100 provisional**. Success = review/edit/reject/approve exact revision, stale approvals fail, zero consequential write before approval, accessibility/duplicate-click tests + current interrupt/runtime proof.

