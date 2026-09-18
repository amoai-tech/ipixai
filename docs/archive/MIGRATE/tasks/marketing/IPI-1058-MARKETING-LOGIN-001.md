# IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup

**File:** `marketing/IPI-1058-MARKETING-LOGIN-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Already present live — **do not** instruct “Add label”  
**READY TO PATCH LINEAR:** YES  
**Audit score after correction:** 95→~97/100

---

## 0. Faster / better — first steps (do this first)

```text
1. Keep current V2 LoginForm + /auth/callback + Supabase SSR clients as base (ADAPT current)
2. Mine Lumina selectively:
   - app/src/lib/safe-redirect.ts  → allowlisted post-auth destinations
   - login-form.tsx useRef submit-lock → same-tick duplicate-submit protection
3. Wire success paths through current runtime-org membership model:
   0 org → needs_onboarding
   1 org → trusted org /app
   >1 org → needs_org_selection
4. Add signup mode; optional Google only if provider configured
5. Remove localhost-only production copy; fix `/` redirects on login + callback
6. Remove hard NAV blockedBy — run auth ∥ NAV; require NAV chrome only for Done/visual AC
7. Keep LOGIN → ONBOARD hard
8. Tests: redirect allowlist negatives + duplicate-submit + membership routing → browser
```

**Do not:** port the old auth stack wholesale; open redirects; browser-trusted org metadata.

---

## 1. Task full name

IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup

## 2. Current V2 owner / scope

Public `/login` on current Supabase Auth. Proven gaps: sign-in only; success → `/`; localhost-only copy; `/auth/callback` also → `/`.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(marketing)/login
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/marketing/login-form.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/safe-redirect.ts
- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/auth
- https://github.com/amoai-tech/luminaai/blob/main/app/src/middleware-auth-gate.test.ts
- ipixai: `src/app/login/*`, `src/app/auth/*`, runtime-org / membership helpers

## 4. COPY

Visual/UX patterns; **safe-redirect allowlist helper**; **useRef submission lock**; auth-gate negative test cases as oracle.

## 5. ADAPT

Current Supabase cookie SSR/PKCE clients; current membership resolver; signup + optional Google; NAV chrome before Done.

## 6. DROP

Old auth implementation wholesale; open redirects (`//host`, external, arbitrary public); localhost-only production copy; browser/user-metadata org hints as tenant authority.

## 7. Exact additions / corrections required in the Linear issue

- **Label:** MIGRATEv2 already present — change patch text from “Add” → “already present”
- Exact reuse targets: `safe-redirect.ts` + submit-lock from `login-form.tsx`
- Soften/remove hard **NAV → LOGIN** blockedBy; keep related; Done still needs NAV chrome
- Keep **LOGIN → ONBOARD** hard
- Official refs: Supabase redirect URLs + SSR clients (≤5 total in body)
- Skills: lean / cheapest-proof-first (not missing `ponytail` skill path)

## 8. Acceptance criteria additions

- [ ] Signup + sign-in + allowlisted safe redirects (reject `//`, external, non-allowlisted)
- [ ] Duplicate submit in same tick produces one auth attempt (`useRef` lock)
- [ ] Zero-org → onboarding; single-org → app; multi-org → org selection
- [ ] `/login` page-level noindex
- [ ] Marketing chrome on Done (NAV integrated)
- [ ] No open redirect / account enumeration / browser secrets

## 9. Dependency / relation correction

| Edge | Correction |
| --- | --- |
| blockedBy NAV | **Remove** hard edge; related only |
| blocks ONBOARD | **Keep** hard |
| AUTH-001 | Already Done — reuse, do not re-block |

## 10. Checklist

- [ ] Current Linear issue read first
- [ ] Current `ipixai` target code inspected
- [ ] Exact Lumina URLs/files listed (incl. safe-redirect + submit-lock)
- [ ] COPY / ADAPT / DROP documented
- [ ] Pure tests identified for reuse
- [ ] Current auth/org/schema/runtime remains authority
- [ ] No browser service-role / tenant authority
- [ ] Exact ACs + dependency changes listed
- [ ] At task start: inspect `package.json` scripts (as of 2026-09-03 `npm run dev` disabled → `dev:ui` / `dev:agent`)
- [ ] Installed package versions recorded at task start

## 11. READY TO PATCH LINEAR

**YES**

Patch style: prepend `AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03` with only deltas above — do not rewrite the full issue body.
