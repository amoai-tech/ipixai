# IPI-1060 · MARKETING-SERVICES-001 — Reuse the Existing iPix Photography Service Pages

**File:** `marketing/IPI-1060-MARKETING-SERVICES-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already present)  
**READY TO PATCH LINEAR:** YES  
**Audit score after correction:** 88→~97/100

---

## 0. Faster / better — first steps (do this first)

```text
1. Establish five canonical route shells (do not build a mega-template first)
2. COPY each relevant legacy page into route-local composition
3. Delete unsupported claims (metrics, “cuts planning time by 60%”, throughput, SLAs, etc.)
4. Consolidate Clothing / Location / Jewellery content into Fashion or Ecommerce as mapped
5. Extract a shared section component ONLY when 2+ canonical pages share the same structure
6. Hand off redirect map to SEO-001 (clothing/location/jewellery/video)
7. NAV merge gate for (marketing) structure; content prep may start earlier
```

**Do not mandate:** “one reusable service-page template + content data.” Fashion and Amazon (etc.) are structurally distinct; a forced mega-template slows migration.

---

## 1. Task full name

IPI-1060 · MARKETING-SERVICES-001 — Reuse the Existing iPix Photography Service Pages

## 2. Current V2 owner / scope

Photography service pages. Five-route consolidation is correct. Lumina has **nine** legacy service directories.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(marketing)/services
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/marketing
- Per-route pages: fashion-photography, ecommerce-photography, amazon, shopify, Instagram, clothing, location, jewellery, video

## 4. COPY

Relevant legacy page composition per canonical route; shared marketing primitives only when truly shared; page metadata patterns.

## 5. ADAPT

```text
shared marketing primitives
+ shared metadata helper
+ route-local composition
```

Canonical five routes; consolidate merge targets; scrub unsupported claims; CTAs → current destinations.

## 6. DROP

- Forced single mega-template
- Clothing / Location / Jewellery / Video as top-level nav destinations (→ redirects owned with SEO)
- Unsupported conversion/engagement/throughput/SLA claims unless independently evidenced
- Public CopilotKit

## 7. Exact additions / corrections required in the Linear issue

- **Revise approach:** remove “one template + content map” mandate
- Replace with: route shells → COPY pages → claims scrub → consolidate → extract shared only after duplication is obvious
- Major copy audit: list example banned claims (`+32% PDP`, `+40% Social`, “60% planning time”, “100+ SKUs/week”, “5–7 business days”) unless proven
- Redirect ownership table for SEO handoff
- Prefer live Linear’s stronger claims handling when patching

## 8. Acceptance criteria additions

- [ ] Exactly five canonical public service routes
- [ ] No unsupported customer/metric/performance claims ship
- [ ] Shared sections only where 2+ pages share structure (no forced mega-template)
- [ ] Each route has canonical metadata
- [ ] CTAs point to current destinations
- [ ] Consolidation map documented for SEO redirects

## 9. Dependency / relation correction

| Edge | Correction |
| --- | --- |
| NAV | Merge gate for layout/registry |
| MEDIA / SEO | Downstream; SEO consumes redirect map |
| HOME | Parallel prep OK; do not couple page content ownership |

## 10. Checklist

- [ ] Current Linear issue read first
- [ ] Current `ipixai` target code inspected
- [ ] Exact Lumina URLs/files listed
- [ ] COPY / ADAPT / DROP documented (no mega-template mandate)
- [ ] Claims scrub listed
- [ ] Exact ACs + dependency changes listed
- [ ] At task start: inspect `package.json` scripts (as of 2026-09-03 `npm run dev` disabled → `dev:ui` / `dev:agent`)
- [ ] Installed package versions recorded at task start

## 11. READY TO PATCH LINEAR

**YES**

Patch style: prepend `AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03` with only deltas above — do not rewrite the full issue body.
