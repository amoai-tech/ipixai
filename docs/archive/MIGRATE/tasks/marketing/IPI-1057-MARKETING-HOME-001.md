# IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App

**File:** `marketing/IPI-1057-MARKETING-HOME-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already present)  
**READY TO PATCH LINEAR:** YES (only with Planner-relocation merge gate below)  
**Audit score:** 82/100 without gate → **~97/100** with gate

---

## 0. Faster / better — first steps (do this first)

```text
1. CONFIRM: current main still mounts authenticated PlannerApp at `/`
   and operator shell still links Planner → `/`
2. HARD MERGE GATE — do NOT replace `/` until Planner has another verified
   product route and authenticated workflows still reach it
3. Meanwhile (parallel prep OK): COPY six homepage sections + animation wrapper
   + metadata pattern under components — without claiming root ownership
4. DROP MarketingChat / public CopilotKit / Cloudflare bundle comments /
   unsupported claims / fake social proof
5. After Planner relocation proven: merge homepage ownership of `/`
6. Prove: Planner reachable from new route; no authenticated workflow lost
7. NAV is merge gate for (marketing) structure — do not fight NAV for layout ownership
```

**Critical:** Local specs that omit this gate are **not** ready. Live Linear already has the merge gate — the addendum must match it.

---

## 1. Task full name

IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App

## 2. Current V2 owner / scope

Public marketing homepage. **Root collision:** `/` is still the authenticated Planner entry on current `ipixai` main until relocated.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(marketing)
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/marketing
- Homepage composition: Hero → Services → Portfolio → Process → Clients → CTA
- MarketingChat mount points (DROP)

## 4. COPY

- Six homepage sections
- Animation wrapper
- Page metadata / OG pattern

## 5. ADAPT

Next/Image sizing; current CTAs → `/login` or approved public destinations; V2 tokens; honest content only.

## 6. DROP

- `MarketingChat` / public CopilotKit / Mastra on marketing home
- Cloudflare bundle comments
- Unsupported claims / fake social proof / fake metrics/logos

## 7. Exact additions / corrections required in the Linear issue

- **Planner relocation merge blocker** (must appear in addendum if not already prominent):
  > MARKETING-HOME must not replace `/` until Planner has another verified product route.
- Explicit COPY list (six sections + animation + metadata) and DROP list (MarketingChat, etc.)
- AC: replacing `/` proves Planner remains reachable; no authenticated workflow lost
- Soft/NAV merge gate: NAV owns chrome; HOME integrates after NAV merge
- Prefer `amoai-tech/luminaai` links

## 8. Acceptance criteria additions

- [ ] Homepage ships real content only (no fake metrics/logos/claims)
- [ ] Responsive + metadata/OG proven
- [ ] **No MarketingChat / public CopilotKit**
- [ ] **Replacing `/` proves authenticated Planner remains reachable from its new supported route and no existing authenticated workflow is lost**
- [ ] Desktop + ~390px browser proof

## 9. Dependency / relation correction

| Edge | Correction |
| --- | --- |
| Planner product route | **Hard merge gate** before root ownership |
| NAV | Merge/integration gate for `(marketing)` structure |
| MEDIA / SEO | Downstream consumers — not blockers of HOME prep |

## 10. Checklist

- [ ] Current Linear issue read first (confirm Planner gate present)
- [ ] Current `ipixai` `/` + Planner entry inspected
- [ ] Exact Lumina URLs/files listed
- [ ] COPY / ADAPT / DROP documented
- [ ] No fake data/metrics
- [ ] Exact ACs + dependency changes listed
- [ ] At task start: inspect `package.json` scripts (as of 2026-09-03 `npm run dev` disabled → `dev:ui` / `dev:agent`)
- [ ] Installed package versions recorded at task start

## 11. READY TO PATCH LINEAR

**YES** — addendum **must** include the Planner-relocation merge gate (live Linear already correct; local was missing it).

Patch style: prepend `AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03` with only deltas above — do not rewrite the full issue body.
