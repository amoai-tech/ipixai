# High-Impact Planner Verification — Re-checking 4 Audit Claims Before React

**Date:** 2026-07-12
**Scope:** Re-verify 4 "High Impact" findings from `design-audit.md` against actual files, project conventions, and the React target architecture (`planner-react-onboarding.md`) — before deciding whether to fix anything in the design prototypes.
**Method:** Four independent read-only verification passes, each with direct file/grep evidence, cross-checked against project docs (`COMPONENTS.md`, `docs/design/*`, `.agents/skills/claude-design-handoff/`) and the real React app (`app/src/`). No files modified in producing this report.
**Legend:** 🟢 verified correct · 🟡 needs clarification or limited fix · 🔴 confirmed blocker · ⚪ defer to React/backend

---

## 1. Executive verdict

**None of the 4 original findings hold up as "critical, must-fix-before-React" in their original framing.** Re-verification shows a consistent pattern: the underlying facts were mostly correct, but the *severity and scope* were overstated in 3 of 4 cases because the audit compared Planner only against the small set of "furthest along" screens, not against the project as a whole.

- **Shared component reuse** — fact confirmed (0 `dc-import` in Planner), but this is the *norm* (68% of all 37 screens, including CRM, have zero `dc-import`), not a Planner-specific regression. Not a blocker.
- **Keyboard operability** — mixed. 3 concrete, trivial fixes are real and worth making (Hub cards, Settings member rows, BottomSheet). The Timeline/Kanban/List "critical" framing is largely covered by an existing arrow-key mechanism already documented as the React target behavior.
- **Mobile/responsive strategy** — fact confirmed (no bottom-nav swap wired in Planner's DCs), but this is a documented, deliberate, project-wide convention. CRM has *zero* `@media` at all — worse than Planner. Not a blocker; explicitly assigned to React ("Claude Code") in the project's own docs.
- **ApprovalCard actions** — confirmed real gap in the shared component, but **moot for Planner specifically**: Planner's own gate drawer (SCR-32) doesn't even use the shared `ApprovalCard.dc.html` — it hand-rolls its own, fully-wired Approve/Edit/Discard logic. The gap affects 3 *other* screens (Command Center, Shoot Detail, Component Library demo), not Planner.

**Net effect:** none of the 4 items block starting React work on Planner (`IPI-478`). Three small, low-risk prototype fixes are worth doing opportunistically (see §7); everything else is correctly the React implementation's job, not a design-prototype debt.

---

## 2. Evidence table

| # | Claim | Verified fact | Severity as originally framed | Severity after verification | Planner-specific? |
|---|---|---|---|---|---|
| 1 | Zero shared-component reuse in Planner DCs | 🟢 True — 0/5 Planner files use `dc-import` | 🔴 Critical, "single highest-leverage fix" | 🟡 Normal — 25/37 (68%) of all screens are the same | No — project-wide norm |
| 2a | Timeline/Kanban/List rows not keyboard-operable | 🟡 Partial — no Tab/ARIA, but a working arrow-key roving mechanism already exists and matches the documented React target | 🔴 Critical | 🟡 Low risk — React onboarding doc already specifies correct target behavior | Yes, but low-risk |
| 2b | Hub plan cards not keyboard-operable | 🟢 True — zero keyboard path exists at all | 🔴 Critical | 🔴 Confirmed, real, trivial fix | Yes |
| 2c | Settings member rows not keyboard-operable | 🟢 True — plus the "Manage member" button next to each row has **no `onClick` at all** (dead button, mouse or keyboard) | 🔴 Critical | 🔴 Confirmed, real, trivial fix | Yes |
| 2d | Intelligence tabs not keyboard-operable | 🟢 True but inert | 🟡 Minor | ⚪ Low stakes — file has no working tab-switch logic at all, not consumed live by audited screens | No |
| 2e | BottomSheet lacks dialog semantics | 🟢 True — no Escape/focus-trap/restore | 🟡 Tracked as future work (MOBILE-004) | 🟡 Confirmed, moderate fix, working template already exists in-repo (SCR-34 invite dialog) | No — shared component |
| 3 | Mobile gallery disconnected from desktop DCs, "critical bug" | 🟢 True — no bottom-nav swap wired | 🔴 Critical | 🟡 Documented, deliberate, project-wide convention; CRM has zero `@media` (worse than Planner) | No — explicit precedent from CRM/Booking |
| 4 | ApprovalCard has zero wired actions | 🟢 True — 0 action props in schema, 0 `onClick` on any button | 🔴 Critical, "blocks the platform's HITL principle" | ⚪ Moot for Planner (doesn't use this component); 🔴 real gap for 3 other screens that do | **No** — Planner bypasses it entirely |

---

## 3. Confirmed issues (real, worth fixing)

1. **🔴 SCR-34 Settings member rows have a dead "Manage member" button** — `Pages/SCR-34-Planner-Instance-Settings.dc.html:187` has no `onClick` at all. This isn't just a keyboard-access gap; the button does nothing for *any* input method. Also the row itself (`line 177`, `<div role="row" onClick="{{ m.onSelect }}">`) has no `tabindex`/keyboard handler.
2. **🔴 SCR-35 Hub plan cards have zero keyboard path** — `Pages/SCR-35-Planner-Hub.dc.html:160`, plain `<div onClick>`, no `tabindex`/`role`/`onKeyDown`, and no arrow-key roving mechanism exists in this file at all (confirmed by grep — SCR-32 has one, SCR-35 and SCR-34 don't).
3. **🟡 `components/BottomSheet.dc.html` lacks dialog semantics** — no Escape handler, no focus trap, no focus-restore, no `role="dialog"`/`aria-modal`. A correct, working reference implementation already exists in the same repo (`SCR-34-Planner-Instance-Settings.dc.html:328-341`) and can be ported directly.
4. **🔴 `components/ApprovalCard.dc.html` has no action props at all** — not even a generic `onClick`, unlike every sibling actionable component (`BrandCard`, `AssetCard`, `EvidenceBlock` all have named per-action props). Confirmed inert at all 3 real usage sites (Command Center, Shoot Detail, Component Library demo). **Does not affect Planner** — SCR-32 hand-rolls its own gate drawer instead.

---

## 4. Rejected or overstated audit claims

1. **"Rebuild SCR-32–35 against the shared components — the single highest-leverage fix."** Rejected as framed. No project doc mandates `dc-import` for existing screens; `COMPONENTS.md` itself scopes "migrated" to 7 of ~30+ screens and explicitly warns against blind retrofits ("a blind dc-import swap would regress them"). Planner's 0-count matches CRM, Booking, and 21 other screens — it is not an outlier. The React app's shell reuse (nav rail, chat dock) is already guaranteed structurally via `app/src/app/(operator)/layout.tsx`'s `OperatorPanel` wrapper, independent of what any `.dc.html` file does. Rebuilding 4 screens to fix a "violation" that 25 others also have, with no React-side payoff, is not justified by evidence.
2. **"SCR-MOBILE-Planner-Gallery disconnection is a critical bug requiring an explicit decision before React."** Rejected as "critical." `planner/planner-mobile-plan.md` §10 and `planner-final-qa.md` show this was a **deliberate choice**, explicitly mirroring the same pattern already used for CRM and Booking galleries ("cheaper and more consistent than four separate mobile files"). `MOBILE-PLAN.md` and `REFACTOR.md` state outright that the real responsive shell is React/"Claude Code" work, not something DC prototypes are expected to wire. CRM's desktop screens have **zero** `@media` rules at all (Planner at least has reflow/collapse rules) — if this is a blocker, CRM is a worse one and nobody has flagged it as such.
3. **"ApprovalCard blocks the platform's HITL principle" (as a Planner risk).** Rejected for Planner specifically. The claim is true for the shared component in isolation, but Planner's actual gate/approval flow (SCR-32, lines 401-405 + 610-611) is fully wired with real, permission-checked Approve/Edit/Discard logic — it just doesn't route through the shared `ApprovalCard.dc.html`. Planner's HITL principle is intact today.

---

## 5. Pre-React blockers

**None.** No item in this verification pass requires a fix before React work can safely begin on Planner (`IPI-478`).

---

## 6. React-phase fixes (handle during implementation, not before)

| Item | What React should do | Source of truth |
|---|---|---|
| Component reuse | Follow the same Phase A/B/C reuse-mapping process already used for Command Center/Brand List/Shoots List; map Planner's bespoke markup onto `OperatorShell`/`NavSidebar`/`IntelligencePanel`/`PersistentChatDock` as real React components are built — not by rewriting the DC prototype first | `component-mapping.md` (existing process), `app/src/components/operator-panel/` (existing shared components) |
| Timeline/Kanban/List keyboard nav | Rebuild on real shadcn primitives with `tabindex`/ARIA by default, preserving the existing arrow-key roving behavior (already correctly specified in `planner-react-onboarding.md` §8) | `planner-react-onboarding.md:248` |
| Mobile responsive shell | Build breakpoints directly into the React components for Planner's UI shell (`IPI-478`), using `SCR-MOBILE-Planner-Gallery.dc.html` purely as visual/interaction reference — same approach that already works for Command Center's live inline `@media` shell | `MOBILE-PLAN.md`, `REFACTOR.md:147` |
| ApprovalCard (React component) | When React builds the shared `ApprovalCard` component (for Command Center/Shoot Detail, not Planner), give it `onApprove`/`onEdit`/`onDiscard` props from the start — don't inherit the prototype's missing-props gap | `components/EvidenceBlock.dc.html` (correct pattern to copy) |

---

## 7. Exact file corrections (small, optional, safe — not blockers)

These are the only prototype-level changes worth making, ranked by value/effort. None are required before React starts; all are safe, additive, low-risk.

1. **`Pages/SCR-34-Planner-Instance-Settings.dc.html:187`** — wire the dead "Manage member" button: add `onClick="{{ m.onSelect }}"` (it currently has no handler at all, for any input method). Also add `tabindex="0" role="button" aria-label="{{m.name}}"` + Enter/Space `onKeyDown` to the row itself at line 177.
2. **`Pages/SCR-35-Planner-Hub.dc.html:160`** — add `tabindex="0" role="button" aria-label="Open {{p.name}}"` + Enter/Space `onKeyDown` calling `p.onSelect` to the plan card div.
3. **`components/ApprovalCard.dc.html`** — mirror `EvidenceBlock.dc.html`'s pattern exactly:
   - Line 82 (`data-props`): add `"onApprove":{"editor":null},"onEdit":{"editor":null},"onDiscard":{"editor":null}`
   - Lines 38-39 (compact) and 74-76 (full): add `onClick="{{ onApprove }}"` / `onClick="{{ onEdit }}"` / `onClick="{{ onDiscard }}"` to the respective buttons
   - `renderVals()` return block (~line 112): add `onApprove: this.props.onApprove || (() => {}), onEdit: ..., onDiscard: ...` (defaulted no-ops, matching `EvidenceBlock.dc.html:132`)
   - `components/COMPONENTS.md:185`: extend the Props list to include the three new names
4. **`components/BottomSheet.dc.html`** — port the working focus-trap/Escape/restore pattern from `SCR-34-Planner-Instance-Settings.dc.html:328-341` (`_focusables()`, `_trap()`, autofocus-on-open, focus-restore-on-close) into `componentDidMount`; add `role="dialog" aria-modal="true"` to the sheet container (line 27).
5. **`Pages/SCR-32-Planner-Workspace.dc.html`, `SCR-35`, `SCR-34`** — add `tabindex="0" role="button"` + Enter/Space `onKeyDown` to Kanban cards (`SCR-32:239`) and List rows (`SCR-32:283`); both already resolve to the same `onSelect` logic the existing arrow-key handler reaches, so this is purely closing the Tab-reachability gap, not new business logic.
6. **Optional, lowest priority:** one clarifying line in `planner-react-onboarding.md` §8 noting that individual Kanban cards/List rows (not just phase-level selection) should be independently Tab-focusable in the React build — the current text only specifies phase-level arrow-key nav.

---

## 8. Risk assessment

| Fix | Risk of applying | Risk of NOT applying before React | Regression risk |
|---|---|---|---|
| Wire "Manage member" button (#1) | None — additive, restores intended behavior of an already-visible button | Low — a design reviewer clicking this button gets silent failure; not user-facing yet (prototype) | None |
| Hub card keyboard access (#2) | None — additive | Low — same as above, prototype-only | None |
| ApprovalCard props (#3) | Low — additive props with safe no-op defaults, matches sibling components' exact pattern | Low for Planner (moot); Medium for Command Center/Shoot Detail prototypes if someone demos "Approve" expecting a reaction | None — purely additive, no existing behavior removed |
| BottomSheet focus trap (#4) | Low-Medium — new `componentDidMount` logic; template already proven in-repo, but any copy-paste error could break the sheet's open/close entirely | Low today (not yet used live); Medium once a mobile Planner build actually uses this component | Test both open/close and Escape paths after the change |
| Kanban/List tabindex (#5) | None — additive attributes, reuses existing `onSelect` | Low — same reasoning as Timeline; arrow-key already covers the functional path | None |
| **Rebuilding all 4 screens against shared components** (rejected in §4) | **High** — large diff across 4 files, real chance of introducing the exact regressions `COMPONENTS.md` warns about ("blind dc-import swap would regress them") | **None** — not required; React doesn't consume this | Would require full re-verification of all 4 screens' state matrix, token values, and interaction catalog after the rebuild |
| **Wiring mobile gallery into desktop DCs** (rejected in §4) | **Medium** — nontrivial CSS/markup work for a throwaway artifact | **None** — explicitly assigned to React by project docs | Risk of the DC-side wiring diverging from what React eventually builds, creating a *third* inconsistent reference |

---

## 9. Recommended order

1. Wire the dead "Manage member" button (`SCR-34:187`) — zero risk, fixes a genuinely broken control.
2. Add keyboard access to Hub plan cards (`SCR-35:160`) and Settings member rows (`SCR-34:177`).
3. Add keyboard access to Kanban cards and List rows (`SCR-32:239,283`) — same pattern, lower urgency since arrow-key nav already reaches the same outcome.
4. Fix `ApprovalCard.dc.html`'s props/wiring — independent of Planner, benefits Command Center/Shoot Detail/Component Library.
5. Port the focus-trap pattern into `BottomSheet.dc.html` — do this only if/when a mobile Planner build is scheduled next; no urgency otherwise.
6. Everything else (component-library rebuild, mobile gallery wiring) — **do not do in the prototype stage**; carry as explicit acceptance-criteria line items into `IPI-478`'s React implementation instead.

---

## 10. Go / No-Go for Planner React implementation

**GO.** None of the 4 audited items are pre-React blockers. The backend (`IPI-476`, `IPI-477`) is Done and verified at 94/100; the design is frozen and, on closer inspection, is consistent with how every other screen in this project handles component reuse and mobile responsiveness — it is not an outlier requiring special remediation. The 5 small fixes in §7 are optional, safe, low-effort improvements that can be made opportunistically without gating the start of `IPI-478`.

---

## Recommended smallest high-value fix to execute first

**Wire the dead "Manage member" button in `SCR-34-Planner-Instance-Settings.dc.html:187`.** It's a one-attribute change (`onClick="{{ m.onSelect }}"`), it fixes a control that currently does nothing for *any* user regardless of input method (not just a keyboard-access nice-to-have — it's a broken button), and it has zero regression risk since it only adds a missing handler to an already-visible, already-styled element.
