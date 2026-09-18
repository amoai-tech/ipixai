# IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile

**File:** `IPI-1093-BRAND-INTEL-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Add label  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile

## 2. Current V2 owner / scope

Generate draft Brand DNA → HITL → atomic promote. Gates APP+AUTH-002. Not blocked by BRAND-001.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/agents/brand-intelligence-agent.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/brand-intelligence-tools.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/brand-intelligence-workflow.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/brand-intelligence-workflow.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/agents/visual-identity.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/social-discovery.ts

## 4. COPY

DNA taxonomy; evidence/citation structures; extraction sequence; prompt/fixtures; workflow tests as oracles.

## 5. ADAPT

Current schema/RLS/HITL; Visual Identity + Social Discovery as **capabilities/tools**, not separate agents; draft-only → atomic promotion.

## 6. DROP

Worker crawl host; service-role/browser auth; old HITL; duplicate model routing; unapproved live profile writes.

## 7. Exact additions / corrections required in the Linear issue

- Explicit Visual Identity + Social Discovery audit
- SSRF/domain/redirect protection; bounded crawl size/time; evidence dedupe; stale-draft detection; exact approved revision
- Do **not** hard-block on BRAND-001
- Add MIGRATEv2 label

## 8. Acceptance criteria additions

- [ ] Draft-only until explicit approval
- [ ] Atomic promote to ai_profile + brand_scores + audit
- [ ] Cross-org generate/update denied
- [ ] SSRF/bounded crawl proven
- [ ] Exact reviewed revision bound to approval

## 9. Dependency / relation correction

Hard: APP-001, AUTH-002. Soft related BRAND-001. **No** BRAND-001 blockedBy.

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

Mine agent/tools/workflow tests → draft pipeline on current runtime → DROP CF/service-role.

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/agents/brand-intelligence-agent.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/brand-intelligence-tools.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/brand-intelligence-tools.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/brand-intelligence-workflow.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/workflows/brand-intelligence-workflow.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/agents/visual-identity.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/social-discovery.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/evidence-block/evidence-block.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/evidence-block/types.ts

## Current Supabase truth
`public.brands` already has `ai_profile_draft`, approved `ai_profile`, analysis lock fields; crawl/result/score tables also exist. Reuse current org/RLS truth and draft→approval→promotion boundary; do not revive user-scoped legacy intake authority.

## Faster/better approach
Mine Lumina taxonomy/extraction/evidence tests first → current Mastra tool/workflow primitives → bounded research → draft only → operator review → atomic promotion. Visual Identity/Social Discovery are capabilities, not extra autonomous agents.

## Red flags / fixes
- SSRF/private-network fetch → strict URL/domain/IP/redirect controls.
- unbounded crawl/token/cost → page/time/byte/result limits.
- regeneration overwrites approved profile → draft only.
- approval not bound to reviewed revision → immutable revision/hash.
- duplicate model/router/Worker stack → current runtime only.

## Score / production gate
Architecture 99 · Security 96 · HITL 99 · Reuse 99 · Overall **98/100 provisional → 99 after SSRF/revision proof**. Success = evidence-backed bounded draft, cross-org isolation, no silent promotion, exact revision approval, atomic profile+scores/audit update, failure/retry/idempotency tests + typecheck/build/runtime.

