# IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout

**File:** `marketing/IPI-1053-MARKETING-NAV-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already present)  
**READY TO PATCH LINEAR:** YES  
**Audit score after correction:** 92→~97/100

---

## 0. Faster / better — first steps (do this first)

```text
1. Port only: (marketing) layout + header + footer + service registry + scoped marketing CSS
2. Replace Lumina’s 9-service array with the approved V2 5-route registry BEFORE any page migration
3. Harden a11y: aria-expanded / aria-controls on mobile toggle; keyboard for desktop dropdown (do not blind-COPY hover-only)
4. Soften NAV → LOGIN hard start block; keep NAV as merge/integration gate for HOME + SERVICES
5. Targeted a11y + layout tests → typecheck → build → desktop + ~390px
```

**Do not:** port Operator chrome, auth/session logic in nav, or the full 9-service legacy nav as V2 truth.

---

## 1. Task full name

IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout

## 2. Current V2 owner / scope

Public marketing header/footer/shared layout. Architecture is correct: marketing route-group layout imports only marketing CSS/header/footer and excludes operator/CopilotKit chrome.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/marketing
- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(marketing)
- Service registry / `services.ts` (or equivalent) — expect **9** legacy entries including Clothing, Location, Jewellery, Video

## 4. COPY

Layout + header + footer + scoped styles; responsive shell; CTA chrome patterns.

## 5. ADAPT

- Current V2 tokens / design system
- **V2 service registry = exactly five destinations:**
  - `/services/fashion-photography`
  - `/services/ecommerce-photography`
  - `/services/amazon`
  - `/services/shopify`
  - `/services/instagram`
- Mobile menu: match stronger a11y contract already used in the new operator shell (`aria-expanded` / `aria-controls`)
- Desktop dropdown: full keyboard handling (not hover-only)

## 6. DROP

Auth/session side effects in nav; Operator shell; blind COPY of 9-service array; public CopilotKit.

## 7. Exact additions / corrections required in the Linear issue

- Explicit 5-route V2 registry (do not leave “registry” generic)
- A11y upgrades vs legacy header (mobile toggle + keyboard dropdown)
- Soften/remove **NAV → LOGIN as start blocker**; retain NAV as **merge gate** for HOME + SERVICES
- Prefer attachments / links to `amoai-tech/luminaai` over stale `amo-tech-ai/lumina-studio`
- Skills wording: use lean / cheapest-proof-first (do not require a missing `.claude/skills/ponytail`)

## 8. Acceptance criteria additions

- [ ] Marketing pages share one header/footer via `(marketing)` layout
- [ ] Nav advertises only the five canonical service routes
- [ ] Mobile toggle: `aria-expanded` + `aria-controls`; keyboard menu usable
- [ ] No auth side effects in nav
- [ ] Desktop + ~390px proven

## 9. Dependency / relation correction

| Edge | Correction |
| --- | --- |
| NAV → LOGIN | Soft / related only (LOGIN may start ∥ NAV) |
| NAV → HOME / SERVICES | Keep as **merge/integration gate** (conflict reduction) |

## 10. Checklist

- [ ] Current Linear issue read first
- [ ] Current `ipixai` target code inspected
- [ ] Exact Lumina URLs/files listed
- [ ] COPY / ADAPT / DROP documented
- [ ] Pure tests identified for reuse
- [ ] Current auth/org/schema/runtime remains authority
- [ ] No browser service-role / tenant authority
- [ ] No fake data/metrics
- [ ] Loading/empty/success/error where UI
- [ ] Exact ACs + dependency changes listed
- [ ] At task start: inspect `package.json` scripts (as of 2026-09-03 `npm run dev` disabled → `dev:ui` / `dev:agent`)
- [ ] Installed package versions recorded at task start (ignore stale pins in issue body)

## 11. READY TO PATCH LINEAR

**YES**

Patch style: prepend `AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03` with only deltas above — do not rewrite the full issue body.
