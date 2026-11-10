# SCR-XX — Screen task template (designtoreact + design-to-production)

> **Copy sections into `SCR-NN-<slug>.md` before coding.**  
> **Discipline:** [`../designtoreact.md`](../designtoreact.md)  
> **Skill:** [`.agents/skills/design-to-production/SKILL.md`](../../../.agents/skills/design-to-production/SKILL.md)
> **Wireframes:** [`wireframes/SCR-NN-<slug>.md`](./wireframes/) · **Diagrams:** [`diagrams/SCR-NN-<slug>.md`](./diagrams/)  
> **Report:** [`design-to-production/references/report-template.md`](../../../.agents/skills/design-to-production/references/report-template.md)

Workspace column only — do not rebuild OperatorPanel · NavSidebar · IntelligencePanel · PersistentChatDock.

---

## 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/<Screen>.dc.html` |
| **React route** | `/app/...` |
| **Page file** | `app/src/app/(operator)/app/.../page.tsx` |
| **Linear** | IPI-XXX |
| **Route status** | `existing` (workspace parity) · `greenfield` (create route first) |
| **Conversion doc** | Optional: `tasks/design-docs/<feature>/<screen>-dc-conversion.md` |

### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | `Pages/<Screen>.dc.html` |
| **Wireframe** | [`wireframes/SCR-NN-<slug>.md`](./wireframes/SCR-NN-<slug>.md) |
| **Mermaid** | [`diagrams/SCR-NN-<slug>.md`](./diagrams/SCR-NN-<slug>.md) |

Regenerate all from DC: `python3 _generate-layout-assets.py`

---

## 2. Skill routing — load before touching that layer

| Layer | Skill | This screen? |
|---|---|:---:|
| Layout, parity, Phase 0 | `design-to-production` | ✅ always |
| App Router, RSC, loading/error | `nextjs-developer` | ✅ if touching route |
| React perf / bundle | `vercel-react-best-practices` | ✅ if client-heavy |
| Supabase query / RPC / migration | `ipix-supabase` | ☐ |
| CopilotKit dock / tools | `copilotkit` | ☐ |
| Mastra agent / workflow | `mastra` | ☐ |
| Gemini edge | `gemini` | ☐ |
| Done gate | `task-verifier` | ✅ before merge |
| Wireframe (ASCII) | `ipix-wireframe` | ✅ must match DC |
| Layout / flow diagrams | `mermaid-diagrams` | ✅ block-beta + journey |

Check only skills this screen needs — unchecked = intentional skip.

---

## Definition of Ready (gate — no code until checked)

- [ ] HTML design approved (DC file path verified on disk)
- [ ] Route identified (`existing` vs `greenfield`)
- [ ] §0 Prove production-state table filled
- [ ] §0 Prove data-source table filled (per block/tab)
- [ ] Reuse audit completed (§5)
- [ ] No conflicting PR/worktree (`git worktree list`, `gh pr list`)
- [ ] Linear issue assigned
- [ ] Out of scope documented (one concern per PR)

---

## Phase 0 — Prove (design-to-production gate)

### Production-state table

| Area | Exists today? | This PR changes? |
|---|---|---|
| Route | | |
| Shell | ✅ OperatorPanel (default) | No |
| API / view / RPC | | |
| Workspace component | | |
| `loading.tsx` | | |

### Data-source table

| Block / tab | Data source | Empty state | Error state | Image: real asset or decorative? |
|---|---|---|---|---|
| | | | | |

### Negative rules

- Do not show fake data for fields the API can return null for.
- Do not show score/history fallbacks when API returns null.
- Missing data → real empty state, not placeholder values.
- **Existing route:** preserve current wiring — layout PR only unless §0 proves source wrong.
- Fallback images only where marked **decorative** in the table above.

---

## Reuse audit (before creating anything)

- [ ] Existing component (`grep` / `graphify query` in `app/src/components/`)
- [ ] Existing hook (`lib/**/use-*`)
- [ ] Existing CSS module
- [ ] Existing utility (`lib/**`)
- [ ] Existing RPC / view (Supabase MCP / `ipix-supabase`)
- [ ] Existing route

Log findings even when answer is "none."

---

## Design token audit

- [ ] spacing · typography · color · radius · shadow from `app/src/styles/tokens.css`
- [ ] No `#FBF8F5`, `#E87C4D`, `min-h-screen` in workspace (design-to-production rule)

---

## Page architecture

```text
Server Component (page.tsx — fetch)
  → Data loader (query/RPC)
  → Client workspace (search/filter/selection)
  → Cards / list rows
  → Dialogs / sheets (if any)
  → AI surface (only if new actions — else reuse rail)
  → Mutations (HITL if AI-originated)
```

---

## Page integration matrix

Check only what applies:

**Frontend** — Route · Server Component · Client Components · Loading · Error  
**Supabase** — Tables · Views · RPCs · RLS · Types  
**Cloudinary** — Images · Upload · Transformations  
**CopilotKit** — Chat · Suggestions · Approval UI  
**Mastra** — Agent · Workflow · Tool  
**Gemini** — Generation · Structured output

---

## AI integration

- [ ] CopilotKit — why / which surface
- [ ] Mastra — agent id + tools
- [ ] Gemini — edge fn only

If all unchecked: **no new AI wiring** (reuse IntelligencePanel read-only).

---

## Data contract

**Reads:** views · tables · RPCs  
**Writes:** mutations · server actions  
**Images:** Cloudinary · Storage  
**External APIs:** yes/no

---

## Component map

| DC component | React | Reuse / Create / Defer | Notes |
|---|---|---|---|
| | | | |

---

## Checklists

### States (§11)

- [ ] populated · selected/detail · loading · empty · error+retry · no-match

### Responsive (§12)

- [ ] desktop 1440 · tablet 1024 · mobile 390 · DC deviations flagged

### Accessibility (§13)

- [ ] keyboard · focus ring · tab order · aria on icon controls · contrast · SR names

### Performance (§14)

- [ ] RSC vs client justified · lazy-load heavy panels · `next/image` · virtualize only if needed

---

## Verification gate (§16)

```bash
cd app
npm run lint
npm test
npx tsc --noEmit
CI=true npm run build
```

Browser: `qa@ipix.test` · `:3002` · 1280 + 390 · console clean · network 200s.  
Screenshots → `docs/qa/screenshots/YYYY-MM-DD/<screen>/`

---

## Visual regression (§17)

- [ ] DC `:8765` vs React `:3002` side by side
- [ ] spacing · typography · card sizes · padding · responsive approved
- [ ] Both screenshots attached to PR

---

## Definition of Done (merge)

- [ ] HTML workspace layout matches DC
- [ ] Reuse audit followed · tokens only
- [ ] All states honest (no fake business data)
- [ ] Responsive + a11y + performance checklists
- [ ] Visual regression passed
- [ ] lint · test · tsc · build green
- [ ] Parity report (§18 category scores)
- [ ] One concern per PR

---

## Report — parity by category (§18)

| Category | Score | Notes |
|---|---:|---|
| Layout | | |
| Components | | |
| Typography | | |
| States | | |
| Responsive | | |
| Accessibility | | |
| Performance | | |
| **Overall** | | |

---

## Out of scope

- Shell / nav / intelligence rail rebuild
- Migrations (separate BE-* PR)
- Mobile shell (MOB-* track)
