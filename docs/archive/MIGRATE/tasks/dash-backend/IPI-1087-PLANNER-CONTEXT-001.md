# IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning

**File:** `IPI-1087-PLANNER-CONTEXT-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning

## 2. Current V2 owner / scope

Verified Brand/Shoot brief context during planning. Hints ≠ auth.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/currentPageContext.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/currentPageContext.test.ts
- https://github.com/amoai-tech/luminaai/tree/main/app/src/context
- https://github.com/amoai-tech/luminaai/tree/main/app/src/lib/active-brand
- https://github.com/amoai-tech/luminaai/tree/main/app/src/lib/intelligence

## 4. COPY

currentPageContext trust model + tests; context pattern ideas.

## 5. ADAPT

One V2 verified context contract; Planner + Intelligence Rail share resolver; contextVersion/entity identity.

## 6. DROP

Browser org authority; old route maps; dual resolvers; service-role lookups.

## 7. Exact additions / corrections required in the Linear issue

- One verified route/entity context for Planner **and** Rail
- Browser IDs = hints; server verifies org+entity
- Stale previous entity clears on route/org change; contextVersion/identity semantics
- Remove redundant SHOOT-SAVE → CONTEXT blockedBy (keep WIZARD)

## 8. Acceptance criteria additions

- [ ] Org B entity ID from Org A browser → rejected
- [ ] Verified brand/shoot reaches Planner without re-entry
- [ ] Route change invalidates stale verified entity
- [ ] Rail consumes same contract (no second resolver)

## 9. Dependency / relation correction

**Keep** blockedBy SHOOT-WIZARD. **Remove** blockedBy SHOOT-SAVE if present.

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

Reuse currentPageContext tests → one server verify helper → share with Rail.

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/currentPageContext.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/currentPageContext.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/shoot/shoot-wizard-context.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/context/crm-chat-context.tsx

## Faster/better approach
Reuse the proven `verified: true` context concept and test cases, but implement one current server verifier shared by Planner and Intelligence Rail. Browser IDs are hints only.

## Red flags / fixes
- route context used as authorization → server re-verifies org/entity.
- two independent Planner/Rail resolvers → one contract.
- stale entity survives route/org change → contextVersion + clear semantics.
- free-text context treated as instructions → mark untrusted user content.

## Score / production gate
Architecture 100 · Security 100 · Reuse 99 · Overall **99/100 provisional**. Success = cross-org injected IDs rejected, verified brand/shoot arrives without re-entry, stale context clears, Planner + Rail consume same verified contract, targeted security/context tests + runtime proof.

