# IPI-1064 · MARKETING-MEDIA-001 — Reuse and Optimize the Existing iPix Marketing Images, Sliders, and Visual Content

**File:** `marketing/IPI-1064-MARKETING-MEDIA-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Already present live — **do not** instruct “Add label”  
**READY TO PATCH LINEAR:** YES  
**Audit score after correction:** 89→~97/100

---

## 0. Faster / better — first steps (do this first)

```text
1. Wait for HOME + SERVICES to decide which routes/imagery survive (hard merge blockers)
   — inventory/scanner prep may start earlier
2. Port/adapt Lumina `app/src/lib/marketing-assets.test.ts` (static reference scanner)
3. Adapt expectations: five canonical V2 services (not legacy >30 / nine OG assumptions)
4. Default delivery: licensed static public assets + next/image
   — do NOT route public marketing through tenant-authenticated DAM Cloudinary contract
5. Remove orphan assets; preserve meaningful alt text
6. Slider keyboard/touch; browser LCP/CLS on `/` + one service page
7. Only then consider a public CDN — if already established — not a new abstraction
```

**Faster path:** `static reference scanner → remove orphans → next/image → browser LCP/CLS`

---

## 1. Task full name

IPI-1064 · MARKETING-MEDIA-001 — Reuse and Optimize the Existing iPix Marketing Images, Sliders, and Visual Content

## 2. Current V2 owner / scope

Public marketing media/sliders after HOME/SERVICES settle the surviving surface.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/marketing
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/marketing-assets.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/marketing/clothing-slider.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/marketing/portfolio-section.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/marketing/hero-section.tsx
- Lumina `app/public` / `/images/**` (or CDN equivalents)

## 4. COPY

Useful licensed public assets; slider UX; alt text; **marketing-assets.test.ts** scanner pattern.

## 5. ADAPT

`next/image` sizes/priority/fill; scanner expectations for five V2 services; prune after SERVICES MERGE/DROP.

## 6. DROP

Dead/duplicate assets; unsafe remote patterns; tenant DAM Cloudinary auth path for public marketing; inventing a media CMS.

## 7. Exact additions / corrections required in the Linear issue

- **Label:** MIGRATEv2 already present — change “Add label” → “already present”
- **Dependencies:** keep **HOME + SERVICES as hard merge blockers** (live Linear correct; local “soft” was stale)
- Exact reuse: `marketing-assets.test.ts` — adapt counts to V2 five-route set
- Cloudinary decision: public marketing defaults to static + `next/image` unless a public marketing Cloudinary source is already established
- Inventory + CLS/LCP evidence in PR

## 8. Acceptance criteria additions

- [ ] Asset inventory in PR; zero missing references (scanner green)
- [ ] CLS/LCP/slider a11y smoke on home + one KEEP service
- [ ] No dead/orphan assets shipped for DROP/MERGE routes
- [ ] No tenant-DAM Cloudinary path used for public marketing by default
- [ ] Meaningful alt text preserved

## 9. Dependency / relation correction

| Edge | Correction |
| --- | --- |
| HOME | **Hard** merge blocker (live) |
| SERVICES | **Hard** merge blocker (live) |
| Inventory work | Soft start OK before merge |

## 10. Checklist

- [ ] Current Linear issue read first
- [ ] Current `ipixai` target code inspected
- [ ] Exact Lumina URLs/files listed (incl. marketing-assets.test.ts)
- [ ] COPY / ADAPT / DROP documented
- [ ] Exact ACs + dependency changes listed
- [ ] At task start: inspect `package.json` scripts (as of 2026-09-03 `npm run dev` disabled → `dev:ui` / `dev:agent`)
- [ ] Installed package versions recorded at task start

## 11. READY TO PATCH LINEAR

**YES**

Patch style: prepend `AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03` with only deltas above — do not rewrite the full issue body.
