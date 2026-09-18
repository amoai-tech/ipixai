# IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace

**File:** `marketing/IPI-1089-ONBOARD-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already present)  
**READY TO PATCH LINEAR:** YES  
**Audit score:** 93/100 → **~99/100** after this correction

---

## 0. Faster / better — FIRST / default path (do this first)

**Core MVP:** Sign up → create brand → enter iPix. AI is **not** in the critical tenancy path.

```text
1. MARKETING-LOGIN authenticates user
          ↓
2. Server resolves AUTH-002 membership
          ↓
   membership exists?
      YES → /app
      NO  → /onboarding
          ↓
3. /onboarding loads or creates user's onboarding_sessions draft
          ↓
4. Minimal UI asks only what materialization requires
   - Brand name
   - Brand website URL if desired/required by current contract
          ↓
5. Persist draft_answers / current_screen
          ↓
6. Final submit calls existing materialize_onboarding_session(...)
          ↓
7. Database atomically creates
   organization
      → organizations_auto_add_owner → org_members
      → brand
      → materialized onboarding_session
          ↓
8. Re-resolve membership from server
          ↓
9. /app  (no logout/login required)
          ↓
10. BRAND-INTEL begins later — never blocks tenancy
```

**Phases (do not invert):**

| Phase | Scope |
| --- | --- |
| **1 — prove tenancy** | 2–3 screen onboarding → existing RPC → `/app` |
| **2 — selective UX** | Restore proven Lumina questions/marketing screens only where activation improves |
| **3 — Brand Intelligence** | After durable Brand exists (BRAND-INTEL-001) |

**Do not** put Build Type, Sales Channels, Growth Preference, marketing interstitials, AI analysis, or DNA payoff ahead of `/app` unless product proves they are essential.

**RPC contract (live):** `materialize_onboarding_session(p_idempotency_key, p_brand_name, p_brand_url)` — SECURITY INVOKER, `auth.uid()`, RLS on `onboarding_sessions`. Reuse unchanged unless a proven defect exists. Do **not** build three client inserts.

---

## 1. Task full name

IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace

## 2. Current V2 owner / scope

Zero-org → `/onboarding` → `materialize_onboarding_session` → membership refresh → `/app`.  
Current `ipixai` has **no** `/onboarding` route — real gap. Backend foundation already live (sessions + RPC + owner trigger).

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(onboarding)
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/onboarding
- https://github.com/amoai-tech/luminaai/tree/main/app/src/lib/onboarding
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/onboarding/navigation.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/onboarding/navigation.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/onboarding/idempotency-key.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/onboarding/session-draft.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/onboarding/onboarding-errors.ts
- Brand Details question + card/footer/step UI
- `OnboardingSessionGate` (loading / error / resume UX) — mine patterns; do not wholesale-port analysis-status logic
- `public/onboarding/*` — **inventory only**; do not bulk copy

## 4. SELECTIVE COPY / ADAPT (not full 13-screen port)

| Lumina piece | Decision | Why |
| --- | --- | --- |
| `onboarding.css` | **ADAPT** | Useful visual system |
| `/onboarding/page.tsx` shell | **ADAPT** | Full-screen surface is good |
| `onboarding-session-gate.tsx` | **ADAPT heavily** | loading / error / resume UX |
| `navigation.ts` + tests | **MINE / ADAPT** | pure tested helpers |
| `idempotency-key.ts` + tests | **ADAPT** | resume / idempotency |
| `session-draft.ts` + tests | **ADAPT** | persisted draft |
| `onboarding-errors.ts` + tests | **ADAPT** | failure normalization |
| `schema.ts` | **ADAPT only after DB contract check** | avoid second truth model |
| Brand details question | **COPY/ADAPT** | needed for materialization |
| general cards/footer/step UI | **COPY selectively** | presentation reuse |
| retained MVP public assets | **inventory then copy used only** | FashionOS dump ≠ ship list |

**Narrative for Linear addendum:**  
**SELECTIVE COPY/ADAPT:** full-screen onboarding shell/styles; Brand Details input; reusable card/footer/step presentation; pure navigation, idempotency, session-draft and error helpers/tests where compatible with current V2. Inventory public assets and copy only assets used by retained MVP screens. Do **not** port the full 13-screen flow by default.

## 5. ADAPT (runtime / auth)

- Existing `materialize_onboarding_session` + `organizations_auto_add_owner`
- AUTH-002 membership resolve after materialize (no forced re-login)
- Server page bootstrap → small client wizard only where interaction requires it
- Debounced draft persist; flush before materialize; do not advance persisted screen until RPC succeeds
- One Supabase browser client; user-scoped idempotency keys

## 6. DROP

| Lumina piece | Why |
| --- | --- |
| `AnalysisProgressScreen` | Brand Intelligence owns analysis — **out of tenancy critical path** |
| `BrandDnaPayoffScreen` | Brand Intelligence owns DNA review |
| Marketing / interstitial screens (default) | Unless Phase 2 explicitly retains for activation |
| Build Type / Sales Channels / Growth Preference ahead of `/app` | RPC does not require them for tenancy |
| `kickoff-onboarding-analysis` | Not needed for org creation |
| `ensure-onboarding-intake-draft` | Avoid second intake path |
| Alternate auth resolver | Current V2 auth owns identity |
| `OnboardingFlowLoader` `ssr:false` as architecture | Legacy Cloudflare ~9 MiB Worker workaround — only reintroduce if **current** `ipixai` bundle measurement proves need |
| Unused `public/onboarding/*` | Do not bulk copy |
| Browser org / member inserts; browser service-role | Fail closed |
| New onboarding truth table | Reuse `onboarding_sessions` |

## 7. Exact additions / corrections required in the Linear issue

- Make the **10-step minimum tenancy journey** the explicit FIRST/default implementation (live Linear architecture is already right — local was too COPY-broad)
- Replace broad COPY with **SELECTIVE COPY/ADAPT** table above
- Strengthen DROP: AI analysis + DNA payoff + marketing slides + Cloudflare `ssr:false` workaround + unused assets
- Explicit: RPC args = `p_idempotency_key` + `p_brand_name` + `p_brand_url` (verified live via `pg_proc` on `nvdlhrodvevgwdsneplk`); extra Lumina questions are Phase 2+
- Prefer `amoai-tech/luminaai` links; lean / cheapest-proof-first skills wording

## 8. Acceptance criteria (Done gate)

- [ ] LOGIN → zero-org → `/onboarding`
- [ ] Member → bypass onboarding → `/app`
- [ ] Current user only sees their onboarding session
- [ ] Draft survives hard refresh
- [ ] No new onboarding truth table
- [ ] No browser org/member inserts; no browser service-role
- [ ] Existing RPC used unchanged unless a proven defect exists
- [ ] Same idempotency key → same org/brand
- [ ] Concurrent submits → one org/brand
- [ ] Owner trigger creates exactly one membership
- [ ] Brand belongs to new org
- [ ] Failed commit leaves no partial tenancy
- [ ] Membership immediately resolves after materialization
- [ ] **No logout/login required**
- [ ] `/app` opens immediately
- [ ] **AI failure cannot prevent tenancy creation**
- [ ] Brand Intelligence is downstream (not on critical path)
- [ ] Targeted tests → RLS/RPC negatives → typecheck → build → exact-SHA browser E2E

## 9. Dependency / relation correction

| Edge | Correction |
| --- | --- |
| **IPI-1058 · MARKETING-LOGIN-001** | **Hard** blockedBy only (verified live) |
| APP / AUTH-002 | Related / supporting contracts — not start blockers |
| BRAND-INTEL | Downstream after durable Brand — never blocks ONBOARD Done |

## 10. Checklist

- [ ] Current Linear issue read first
- [ ] Current `ipixai` target code inspected (no `/onboarding` yet)
- [ ] Live RPC / RLS contract confirmed (or re-verified read-only)
- [ ] Exact Lumina URLs/files listed
- [ ] SELECTIVE COPY / ADAPT / DROP documented
- [ ] Pure navigation/idempotency/draft/error tests identified
- [ ] Current auth/org/schema/runtime remains authority
- [ ] No browser service-role / tenant authority
- [ ] Exact ACs + dependency changes listed
- [ ] At task start: inspect `package.json` scripts (as of 2026-09-03 `npm run dev` disabled → `dev:ui` / `dev:agent`)
- [ ] Installed package versions recorded at task start

## 11. READY TO PATCH LINEAR

**YES**

Patch style: prepend `AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03` with only deltas above — do not rewrite the full issue body.
