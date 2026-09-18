# IPI-1063 · MARKETING-SEO-001 — Keep the New iPix Marketing Site Searchable and Correctly Indexed

**File:** `marketing/IPI-1063-MARKETING-SEO-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Already present live — **do not** instruct “Add label”  
**READY TO PATCH LINEAR:** YES  
**Audit score after correction:** 86→~97/100

---

## 0. Faster / better — first steps (do this first)

```text
1. Finalization inputs must be Done/merged: LOGIN + HOME + SERVICES
   (establish final public route set + /login noindex owner)
2. One SSOT:
   SERVICES registry → sitemap
   + one canonical-host helper (never Preview/localhost)
   + one centralized permanent redirect map
   + one robots policy
3. COPY+CLEAN Lumina robots.ts / sitemap.ts / tests — rewrite allow/deny to V2
4. LOGIN owns page-level noindex; SEO verifies (robots.txt ≠ noindex)
5. No fake lastModified freshness (drop Lumina `new Date()` unless real mtime)
6. Preview deployments: not indexable canonical sources
7. Evidence: curl robots/sitemap + redirect one-hop proofs
```

**Do not:** duplicate route arrays; derive canonicals from Vercel Preview host; rely on robots alone for `/login` de-index.

---

## 1. Task full name

IPI-1063 · MARKETING-SEO-001 — Keep the New iPix Marketing Site Searchable and Correctly Indexed

## 2. Current V2 owner / scope

Final public-marketing SEO integration: robots / sitemap / canonicals / redirects. Last in the public lane.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/robots.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/robots.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/sitemap.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/sitemap.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/site.ts (canonical host helper)

## 4. COPY

robots/sitemap implementations + tests; canonical helper pattern.

## 5. ADAPT

Current production domain; five-service + home set; V2 private prefixes (`/app/*`, `/auth/*`, `/api/*`, onboarding); redirect map from SERVICES; preview policy.

## 6. DROP

Stale Lumina domains; indexing private surfaces; fake `lastModified: new Date()` freshness; Preview host as canonical origin.

## 7. Exact additions / corrections required in the Linear issue

- **Label:** MIGRATEv2 already present — change “Add” → “already present”
- **Dependencies (hard):** LOGIN + HOME + SERVICES (local “soft” was understated; match live Linear)
- **Add four contract requirements:**
  1. **Central permanent redirect map** (min):
     - clothing → fashion-photography
     - location → fashion-photography
     - jewellery → ecommerce-photography
     - video → explicitly approved nearest relevant outcome (not blind `/`)
  2. **Canonical-host authority** — never derive sitemap/canonical from Preview hostname
  3. **Preview indexing policy** — Preview must not become indexable canonical source
  4. **No fake freshness** — do not preserve `lastModified: new Date()` unless real content mtime
- Note: robots disallow ≠ page-level noindex; LOGIN owns `/login` noindex; SEO verifies

## 8. Acceptance criteria additions

- [ ] Sitemap exactly = `/` + five canonical services (no login/app/auth/api/merged URLs)
- [ ] Centralized one-hop permanent redirects for clothing/location/jewellery/video
- [ ] Canonical URLs never use localhost/Preview hosts
- [ ] No fake `lastModified` freshness
- [ ] `/login` page-level noindex verified; absent from sitemap
- [ ] robots allow public root; disallow `/app/`, `/auth/`, `/api/` (map as shipped)
- [ ] robots/sitemap tests green; curl evidence in PR

## 9. Dependency / relation correction

| Edge | Correction |
| --- | --- |
| LOGIN | **Hard** finalization input |
| HOME | **Hard** finalization input |
| SERVICES | **Hard** finalization input (redirect + route set) |

## 10. Checklist

- [ ] Current Linear issue read first
- [ ] Current `ipixai` target code inspected (no sitemap/robots yet expected)
- [ ] Exact Lumina URLs/files listed
- [ ] Redirect + canonical-host + preview + freshness contracts listed
- [ ] Exact ACs + dependency changes listed
- [ ] At task start: inspect `package.json` scripts (as of 2026-09-03 `npm run dev` disabled → `dev:ui` / `dev:agent`)
- [ ] Installed package versions recorded at task start

## 11. READY TO PATCH LINEAR

**YES**

Patch style: prepend `AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03` with only deltas above — do not rewrite the full issue body.
