# IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization

**File:** `IPI-1083-SHOOT-SAVE-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization

## 2. Current V2 owner / scope

Atomic org-safe save of approved plan. Rewrite unsafe DEFINER commit.

## 3. Exact Lumina URLs / files to inspect

- Old shoot commit/save code + APIs for shape/validation/tests only (contracts)
- Live: commit_shoot_draft SECURITY DEFINER + p_created_by — unsafe as-is

## 4. COPY

Input/serialization shape; auth/negative test ideas.

## 5. ADAPT

JWT actor + trusted org; DB idempotency; bind approval revision + idempotency key.

## 6. DROP

Caller-supplied created_by; service-role architecture; legacy public.shoots; reuse unsafe RPC as-is.

## 7. Exact additions / corrections required in the Linear issue

- **Approval revision + idempotency key bound together**
- Same key cannot save a different plan revision
- Concept: (org/user, approvedPlanRevision, idempotencyKey) → exactly one shoot_id
- Atomic commit/rollback; shoot.shoots only

## 8. Acceptance criteria additions

- [ ] Browser cannot supply authoritative created_by/org
- [ ] Concurrent retries → same shoot_id
- [ ] Child failure rolls back entire transaction
- [ ] Zero writes to public.shoots
- [ ] Wrong revision + same key rejected

## 9. Dependency / relation correction

Hard: APPROVAL-001.

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

Design new RPC/contract from AC → port only validation shapes/tests from legacy.

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

## Exact Lumina sources — contract/test oracles only
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/saveApprovedShootDraft.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/shoot/commit-shoot-draft.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/api/shoots/commit/route.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/(operator)/app/shoots/new/page.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/shoot-wizard.ts

## Current Supabase blocker
`public.commit_shoot_draft(...)` is SECURITY DEFINER and accepts caller-supplied `p_created_by`; this is **not safe to reuse as the V2 authoritative write contract as-is**. Canonical target is `shoot.shoots` + related `shoot.*` records.

## Faster/better approach
Design the minimal atomic write contract from acceptance criteria first: trusted JWT actor + trusted active org + exact approved plan revision/hash + idempotency key → one transaction → one `shoot_id`. Reuse only legacy validation/serialization fixtures.

## Red flags / fixes
- service-role helper from legacy → DROP.
- caller-authoritative `created_by`/org → derive server/DB-side.
- same idempotency key for different plan → reject.
- partial child writes → transaction rollback.
- `public.shoots` write regression → zero writes.
- SECURITY DEFINER in exposed `public` → if retained, explicitly authenticate/authorize internally, restrict EXECUTE, set safe search_path, and audit privileges.

## Score / production gate
Current reusable implementation 65/100 for V2 security; task design **95/100 → 99/100 after new contract proof**. Success = exact-revision approval required, concurrent retries return same shoot_id, wrong org/revision/key fails closed, actor cannot be spoofed, atomic rollback, canonical `shoot.*` writes only, DB negative/concurrency tests + typecheck/build/integration proof.

