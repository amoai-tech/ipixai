# SCR-24 — Talent Onboarding

| Field | Value |
|---|---|
| **ID** | SCR-24 |
| **Route** | `/app/talent/profile` |
| **Priority** | P3 |
| **Status** | ⚪ 0% |
| **Linear** | [IPI-412](https://linear.app/amo100/issue/IPI-412) |
| **Dependencies** | T3 WizardShell · SCR-20 profile |
| **Complexity** | M |
| **Branch** | `ipi/scr-24-talent-onboarding` |
| **Matrix** | [MATRIX.md](./MATRIX.md) |
| **Wireframe** | [./wireframes/SCR-24-talent-onboarding.md](./wireframes/SCR-24-talent-onboarding.md) |
| **Diagram** | [./diagrams/SCR-24-talent-onboarding.md](./diagrams/SCR-24-talent-onboarding.md) |

## Conversion plan

> **SSOT:** [`../../plan/designtoreact.md`](../docs/designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md) · Full sections: [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md)

### 1. Target

| Field | Value |
|---|---|
| **HTML source** | `Pages/SCR-24-Talent-Onboarding.dc.html` |
| **React route** | `/app/talent/profile` |
| **Page file** | `app/src/app/(operator)/app/talent/profile/page.tsx` |
| **Route status** | **greenfield** — create new route |
| **Scope note** | 3-step wizard (Profile → Portfolio → Rates). Draft behind Mastra agent HITL — agent writes draft, operator approves before commit. Shell: `split-2col` per DC. |

### Wizard steps

| Step | Fields | AI role |
|---|---|---|
| 1. Profile | Name, bio, headshot upload, contact info | Draft bio text via Mastra |
| 2. Portfolio | Sample images, categories, tags | None |
| 3. Rates | Rate card per shoot type, availability | Draft rate suggestions via Mastra |

### Layout — wireframe & diagram (must match DC)

| Asset | Path |
|---|---|
| **DC SSOT** | [`Pages/SCR-24-Talent-Onboarding.dc.html`](../../Pages/SCR-24-Talent-Onboarding.dc.html) |
| **Wireframe** | [./wireframes/SCR-24-talent-onboarding.md](./wireframes/SCR-24-talent-onboarding.md) |
| **Mermaid** | [./diagrams/SCR-24-talent-onboarding.md](./diagrams/SCR-24-talent-onboarding.md) |
| **Shell** | `split-2col` · grid `400px \| minmax(0,1fr)` |
| **DC workspace** | 400px left panel (form), right panel (preview/guidance) |

Skills: [`ipix-wireframe`](../../../.agents/skills/ipix-wireframe/SKILL.md) · [`mermaid-diagrams`](../../../.agents/skills/mermaid-diagrams/SKILL.md)

### 2. Skill routing

| Skill | When | This screen |
|---|---|---|:---:|
| `design-to-production` | Load before coding | ✅ |
| `nextjs-developer` | Load before coding | ✅ |
| `vercel-react-best-practices` | Load before coding | ✅ |
| `ipix-supabase` | Load before coding | ✅ |
| `copilotkit` | Load before coding | ✅ |
| `mastra` | Load before coding | ✅ (draft bio/rates) |
| `gemini` | Load before coding | ✅ (via Mastra agent) |
| `task-verifier` | Load before coding | ✅ |
| `ipix-wireframe` | Wireframe matches DC | ✅ |
| `mermaid-diagrams` | Layout/flow diagrams | ✅ |

### Definition of Ready

- [ ] DC file read; Workspace zones identified
- [ ] §0 Prove tables filled below
- [ ] Reuse audit complete
- [ ] No conflicting PR/worktree
- [ ] Linear assigned
- [ ] Out of scope listed

### Phase 0 — Prove

#### Production-state

| Area | Exists today? | This PR changes? |
|---|---|---|
| Route | No `/app/talent/profile` route | Create route |
| Shell | ✅ OperatorPanel | No |
| Workspace | N/A — greenfield | Yes |
| Data wiring | N/A — greenfield | Wire talent profile create/update + agent drafts |

#### API/RPC verification

| Endpoint | Status | Notes |
|---|---|---|
| `talent_profiles` table (insert) | 🟡 exists — verify columns | Check `talent.talent_profiles` schema |
| `talent_profiles` table (update) | 🟡 exists — verify RLS | Owner + agency editor |
| Bio draft agent tool | 🟡 not built | Must create in Mastra `booking` or new `talent` agent |
| Rate draft agent tool | 🟡 not built | Same agent as bio draft |
| Image upload | 🟡 needs Cloudinary | Use existing `api/assets/upload-sign` |

#### Data-source

| Block | Source | Empty | Error | Image |
|---|---|---|---|---|
| Profile form | `talent_profiles` table | Empty form (new) | ErrorState + retry | Cloudinary headshot |
| Bio draft | Mastra agent tool | Edit directly | Fallback: manual edit | N/A |
| Portfolio images | Cloudinary + assets | Empty grid | ErrorState | Cloudinary thumbnails |
| Rate card | `talent_profiles.rates` | Empty rate card | ErrorState | N/A |

#### DC States

| State | DC class | AC |
|---|---|---|
| Wizard step 1 | Step indicator → Profile | Name, bio, headshot form |
| Wizard step 2 | Step 2 → Portfolio | Image grid with add/remove |
| Wizard step 3 | Step 3 → Rates | Rate card per shoot type |
| Loading | Skeleton form | Shimmer form fields |
| AI drafting | Thinking indicator | "Drafting bio..." with spinner |
| Draft ready | FieldReview banner | "Agent drafted a bio — review and approve" |
| Error | `sc-if viewState="error"` | ErrorState with retry |
| Validation | Inline errors | Per-field validation messages (red border + text) |
| Success | Confirmation | Profile created -> redirect to `/app/matching/talent/[id]` |

#### Negative rules

- Agent drafts must NOT write directly to DB — HITL approval required
- No fake draft content — show real agent output or manual edit fallback
- No fallback images — placeholder icon if no upload
- Only visible to talent/agency roles — gate behind role check

#### DC style tokens

```css
.form-panel {
  width: 400px;
  padding: var(--spacing-8);
}
.preview-panel {
  padding: var(--spacing-8);
  background: var(--color-panel-bg);
}
```

### Reuse audit

| Component | Reuse? | Notes |
|---|---|---|
| `WizardShell` | 🟡 | T3 deferred (RF-A1) — inline wizard for MVP |
| `EmptyState` | ✅ | |
| `ErrorState` | ✅ | |
| `FieldReview` pattern | ✅ | From brand detail approval pattern |
| `button`, `input`, `select` | ✅ | From ui/ |
| `IntelligencePanel` | ✅ | Not rebuilt |
| `OperatorPanel` | ✅ | Not rebuilt |

- [ ] Components · hooks · CSS modules · utils · RPCs · routes searched

### Screen-specific Done criteria

- [ ] 3-step wizard matches SCR-24 DC
- [ ] Profile step: name, bio, headshot
- [ ] Portfolio step: image upload grid
- [ ] Rates step: rate card per shoot type
- [ ] Bio/rate drafts via Mastra agent with HITL
- [ ] Creates talent profile on commit
- [ ] loading.tsx + error.tsx
- [ ] CSS module using tokens.css
- [ ] Role-gated (talent/agency only)

### Verification gate

```bash
cd app && npm run lint && npm test && npx tsc --noEmit && CI=true npm run build
```

Browser: `qa@ipix.test` · `:3002` · 1280 + 390 · screenshots → `docs/qa/screenshots/YYYY-MM-DD/`
Visual regression: DC `:8765` vs React `:3002`

### Browser / Playwright matrix

| State | Device | Target |
|---|---|---|
| Step 1 | 1280px | Profile form visible, preview panel shows guidance |
| Step 2 | 1280px | Portfolio grid, add/remove images |
| Step 3 | 1280px | Rate card per shoot type |
| AI drafting | 1280px | Thinking indicator + draft banner |
| Error | 1280px | Error message + retry |
| Validation | 1280px | Inline field errors |
| Mobile | 390px | Full-screen form, no split-2col |

### Data flow

```
RSC page.tsx (role gate — check user role)
  └─ if new: render TalentOnboardingWizard client component
       ├─ WizardStepContext tracks current step, form state
       ├─ Step 1: profile fields + Mastra agent drafts bio
       │    └─ agent writes draft → FieldReview banner → approve/edit
       ├─ Step 2: portfolio image grid
       │    └─ upload via Cloudinary signed URL
       ├─ Step 3: rate card
       │    └─ agent drafts rates → FieldReview → approve/edit
       └─ Commit: supabase insert talent_profiles
            └─ redirect to /app/matching/talent/[newId]
```

### Out of scope

- Shell / nav / IntelligencePanel / chat dock rebuild
- Backend migrations (separate BE-* PR)
- Mobile shell (MOB-* track)
- T3 WizardShell extraction (RF-A1) — inline wizard for MVP
- Advanced portfolio management (edit/reorder after creation)
- Booking agent integration (BE-B0b)

## Readiness

| Layer | Status |
|---|---|
| React | ⚪ |
| Backend | 🟡 |
| AI | 🟡 |
| Mobile | ⚪ |

## Design source

- **DC:** [`../../Pages/SCR-24-Talent-Onboarding.dc.html`](../../Pages/SCR-24-Talent-Onboarding.dc.html)
- **Index:** [`../../HTML.md`](../../HTML.md)
- **Discipline:** [`../../plan/designtoreact.md`](../docs/designtoreact.md)

## Files to inspect

- `app/src/app/(operator)/app/onboarding/page.tsx` (reference: existing onboarding wizard pattern)
- `app/src/components/brand-hub/brand-detail-draft-card.tsx` (reference: FieldReview pattern)

## Files likely to modify

- `talent/profile/page.tsx` (new)
- `app/src/components/talent/talent-onboarding-wizard.tsx` (new)
- `app/src/components/talent/talent-onboarding.module.css` (new)
- `app/src/mastra/tools/talent/` (new — draft bio/rates tools)

## Supabase dependency

`talent_profiles` table — verify columns + RLS. May need `talent_portfolio_images` table.

## AI dependency

Mastra agent for drafting bio text and rate suggestions. Must be HITL-gated — agent never writes to DB directly. Pattern: `crm-assistant-agent.ts` (read-only + draft tools).

## Mobile dependency

M1 — full-screen form on mobile, no split-2col

## Definition of Done

- [ ] Wizard matches SCR-24 DC
- [ ] 3 steps: Profile, Portfolio, Rates
- [ ] Creates talent profile via supabase insert
- [ ] Bio/rate drafts via Mastra HITL
- [ ] Image upload via Cloudinary signed URL
- [ ] loading.tsx + error boundary
- [ ] Role-gated to talent/agency
- [ ] lint · test · tsc · build green

## Verification

```bash
cd app && npm run lint
```

## Risk

| Risk | Likelihood | Mitigation |
|---|---|---|
| `talent_profiles` table doesn't exist or wrong schema | High | Verify via Supabase MCP before coding |
| Agent draft bio/rates not built yet | Medium | Manual edit fallback — agent is enhancer, not gating |
| Split-2col layout complex at 400px | Low | CSS module with responsive breakpoint |
| No upload route for portfolio images | Medium | Use existing `api/assets/upload-sign` |

## Notes

URL-context onboarding for talent role. Heaviest gap: `talent_profiles` schema not fully verified — must probe Supabase MCP before coding. AI draft tools need new Mastra agent or extend booking agent. Weakest task spec overall (original 58/100) — this rewrite addresses all gaps.

HTML coverage check:
- Pages: ✅ SCR-24-Talent-Onboarding.dc.html exists
- Components: wizard step indicator, profile form, portfolio grid, rate card, FieldReview banner
- States: 3 wizard steps, loading, AI drafting, draft-ready, validation, error, success — all in DC
- Dialogs: None (inline form per step)
- Cards: portfolio image cards, rate card rows

## Skills

`design-to-production` · `nextjs-developer` · `copilotkit` · `mastra` · `gemini` · `designtoreact` · `ipix-supabase`
