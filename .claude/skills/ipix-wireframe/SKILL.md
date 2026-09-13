---
name: ipix-wireframe
description: Turn iPix product requirements or existing screens into implementation-ready wireframe contracts before code. Use for wireframes, lo-fi UI, screen planning, flow design, prototypes, Figma handoff, Mermaid journeys, AI/HITL interaction design, responsive behavior, and engineering-ready screen specs.
metadata:
  priority: 6
  pathPatterns:
    - 'Universal-design-prompt-4/tasks/screens/**'
    - 'Universal-design-prompt-4/tasks/screens/wireframes/**'
    - 'Universal-design-prompt-4/Pages/**'
    - 'docs/design/**'
  triggers:
    - wireframe
    - lo-fi
    - mockup
    - prototype
    - screen flow
    - user journey
    - Figma
    - Mermaid
    - sketch-to-spec
---

# iPix Wireframe

Turn a product requirement or existing iPix screen into an implementation-ready UI contract before code is written.

The wireframe is one output. The real goal is to make the intended user journey, UI behavior, data, AI authority, responsive behavior, and verification unambiguous enough that another agent can implement and test it.

**Canonical workflow:** `Prove → Journey → Wireframe → Contract → Implement → Verify`.

## Core rules

1. **Current iPix V2 is authoritative.** Lumina is reference-only unless a task explicitly says otherwise.
2. **Inspect before drawing.** Never design from memory when the route, component, data source, or prior design may already exist.
3. **Reuse before creating.** Existing iPix components, hooks, styles, routes, RPCs, and approved design patterns outrank new custom UI.
4. **Wireframes must reflect real data.** Do not invent fields, scores, states, or images that the product cannot supply.
5. **Humans decide. AI assists.** Consequential AI actions must be visibly reviewable and approved before durable writes.
6. **Figma and Mermaid are outputs, not separate workflows.** They should express the same verified journey and contract.
7. **A screen is not ready because it looks good.** It is ready when engineering and QA can implement and verify it without guessing.

## When to use

Use this skill for:
- New iPix screens or flows.
- Existing screens that need redesign or structural changes.
- Brand intake, campaigns, shoots, assets, DNA, product linking, matching, booking, CRM, analytics, approvals, and mobile flows.
- AI-native interactions involving CopilotKit, Mastra, streaming, generative UI, or HITL.
- Converting requirements into wireframe + component/data/state contracts.
- Preparing a screen for Figma, implementation, Linear, or Playwright verification.

Do not use it as a replacement for `design-to-production`, `nextjs-developer`, `copilotkit`, `mastra`, `ipix-supabase`, or `task-verifier`. Route to those skills when implementation reaches their layer.

## Source-of-truth order

When sources conflict, resolve in this order:

1. Live/current iPix route, data contract, and repository state.
2. `docs/prd.md` + canonical sitemap/accepted ADRs.
3. Approved `Universal-design-prompt-4/Pages/*.dc.html` for visual layout truth.
4. Existing iPix components and design tokens.
5. Screen task + conversion plan + current wireframe/diagram.
6. Lumina/reference implementations for proven UX/business logic only.
7. External templates/examples last.

Never let a stale wireframe override a working route, current schema, or accepted architecture.

## Fidelity selection

### Level 1 — Flow sketch
Use for new concepts, screen count, route planning, or stakeholder discussion.
Output: ASCII flow + Mermaid journey/state diagram.

### Level 2 — Implementation wireframe — default
Use for engineering work.
Output: layout, real component targets, data zones, states, AI/HITL behavior, responsive rules, accessibility, reuse map, acceptance criteria, and test scenarios.

### Level 3 — High fidelity
Use after flow/layout are approved or when visual parity matters.
Output: Figma or approved DC design, using the real iPix design system/components where possible.

## 1. PROVE — inspect before drawing

Before creating or changing a wireframe, verify the current state.

Check:
- Canonical route and whether it already exists.
- Current page/workspace implementation.
- Existing components, hooks, CSS modules, utilities, dialogs, sheets, and shells.
- Data source: table/view/RPC/API and nullability.
- Existing AI surface, agent, tools, and approval behavior.
- Existing DC/Figma/wireframe/diagram for the screen.
- Active PR/worktree that may already own the change.
- Related Linear task and dependencies when known.

Use Graphify/repository search before broad reading. Read only load-bearing files first.

### Prove table

| Area | Current truth | Change needed? |
|---|---|---|
| Route | | |
| Workspace/page | | |
| Reusable components | | |
| Data source | | |
| AI/agent behavior | | |
| Existing design | | |
| PR/worktree collision | | |

If the reported gap no longer exists, stop and report that instead of redesigning it.

## 2. JOURNEY — define the outcome before the screen

State the real user and observable outcome in plain language.

Example:
`Operator opens New Shoot → selects brand → enters objective → AI proposes deliverables → operator edits → operator approves → AI proposes shot list → operator approves → shoot is created.`

Required journey questions:
1. Who starts the flow?
2. What triggers it?
3. What must the user understand or decide?
4. What does the system/AI return?
5. Where can the user edit, reject, retry, or leave?
6. What action commits durable state?
7. What visible success confirms completion?

For multi-step, cross-system, approval, or failure-heavy flows, produce Mermaid.

### Mermaid rule

Use Mermaid to explain behavior, not decorate documentation.
Prefer:
- `flowchart` for navigation/decision paths.
- `sequenceDiagram` for UI → agent → approval → data interactions.
- `stateDiagram-v2` for lifecycle/state machines.
- `journey` for persona experience when useful.

The Mermaid diagram and wireframe must describe the same flow.

## 3. WIREFRAME — show hierarchy and behavior

Wireframe from the verified journey, not from a component wish list.

For each screen:
- Mark primary task and primary CTA.
- Organize information by priority: `P0` required, `P1` important, `P2` supporting, `P3` advanced/optional.
- Show major zones and navigation.
- Annotate interaction, dynamic content, validation, and transitions.
- Keep lo-fi work visually simple; do not spend time polishing color/branding before structure is approved.

### Preferred outputs

**Default:** ASCII + spec tables for fast engineering communication.

**Clickable prototype:** use approved HTML/Figma when interaction needs validation.

**Figma:** first-class output for high-fidelity or collaborative design; use real iPix components/design-system constraints where available rather than generic boxes.

**DC HTML:** when an approved `.dc.html` exists, treat it as visual layout truth and make the wireframe describe it rather than inventing a competing layout.

Current screen wireframes live under:
`Universal-design-prompt-4/tasks/screens/wireframes/`

Current approved design references live under:
`Universal-design-prompt-4/Pages/`

## 4. CONTRACT — make the wireframe buildable

Every implementation wireframe must include these contracts.

### A. Component reuse map

Search before creating.

| Wireframe block | Existing React target | Decision | Notes |
|---|---|---|---|
| | | Reuse / Adapt / Create / Defer | |

Search components, hooks, CSS, utilities, routes, RPCs/views, and design-system primitives.

### B. Data contract

| Zone | Source of truth | Missing/empty state | Write path |
|---|---|---|---|
| | | | |

Rules:
- No fake business values when the source can be null.
- Do not duplicate mutable truth just to satisfy a wireframe.
- Cloudinary owns media bytes/transforms; Supabase owns iPix business metadata; commerce systems own commerce facts where specified.
- Existing route wiring is preserved unless the Prove step shows it is wrong.

### C. State matrix

Cover relevant states: initial, loading, populated, selected, editing, empty, no-results, error+retry, unavailable access, offline/interrupted, AI streaming, awaiting approval, rejected, committing, and success.

### D. AI / HITL contract

Use explicit annotations in AI-native wireframes:

`[AI READS]` → context the agent may inspect
`[AI PROPOSES]` → draft/recommendation only
`[HUMAN EDITS]` → operator may change proposal
`[HUMAN APPROVES]` → explicit decision gate
`[SYSTEM WRITES]` → approved durable mutation

For consequential actions, show this sequence:

`AI proposes → human reviews/edits → human approves → approved action executes → system records result`.

Do not design silent AI publishing, payments, destructive actions, tenant-critical mutation, or direct durable writes when approval is appropriate.

For CopilotKit/Mastra work, identify:
- What page state is visible to the agent.
- Which output appears in the right rail vs center workspace.
- Streaming/progress states.
- Approval card surface.
- Reject/edit/retry behavior.
- Resume/commit success state.

### E. Responsive contract

Specify behavior, not just screenshots.

Minimum checkpoints:
- Desktop: 1440px.
- Tablet: about 1024px.
- Mobile: 390px.

Define what stays visible, collapses, becomes a drawer/sheet, stacks, scrolls, or moves to bottom navigation. Never assume desktop simply shrinks.

### F. Accessibility contract

Annotate before high fidelity:
- Heading hierarchy and landmark regions.
- Button vs link semantics.
- Keyboard order and focus behavior.
- Form labels and validation placement.
- Dialog/sheet focus management.
- Screen-reader names for icon controls.
- Live announcements for AI/loading/status updates when needed.
- Image alt purpose: informative vs decorative.

### G. Information priority

Use priority markers when space or mobile tradeoffs matter:
`P0` task-critical · `P1` important · `P2` supporting · `P3` optional/advanced.

## 5. IMPLEMENT — hand off the smallest safe change

The wireframe skill does not own production implementation. Its job is to make implementation deterministic.

Before handoff, identify:
- Existing files/components to reuse.
- New components genuinely required.
- Data/API/RPC dependencies.
- AI/CopilotKit/Mastra dependencies.
- Explicit out-of-scope work.
- Acceptance criteria tied to the journey.

**Faster/better approach:** prefer the smallest change that reuses current iPix architecture and components. Do not redesign unrelated systems or copy legacy Lumina infrastructure.

Route implementation to the relevant skills only when needed:
- `design-to-production` — DC/design parity and production handoff.
- `nextjs-developer` — routes, App Router, server/client boundaries.
- `vercel-react-best-practices` — React performance.
- `ipix-supabase` — tables, views, RPCs, RLS, types.
- `copilotkit` — agent UI, generative UI, context, approvals.
- `mastra` — agents, tools, workflows, memory.
- `task-verifier` — final Done gate.

Do not load unrelated skills for a screen that does not touch those layers.

## 6. VERIFY — design intent must be testable

Every implementation wireframe should produce acceptance criteria and QA scenarios.

Minimum verification targets:
- Primary journey completes.
- Loading/empty/error states are honest.
- AI proposal can be edited/rejected/approved as designed.
- Rejection does not commit a durable write.
- Approval commits once and shows visible confirmation.
- Responsive behavior matches the contract.
- Keyboard/focus behavior works.
- Existing routes/data behavior does not regress.

Convert important states directly into Playwright scenarios.

Example:
`No shoots → /app/shoots shows EmptyState → Create Shoot CTA is keyboard reachable.`

AI example:
`Generate proposal → approval card appears → reject writes nothing → regenerate/edit → approve → one committed record.`

For an approved DC/Figma target, also perform visual comparison at the required desktop/mobile widths.

## Wireframe red-flag audit

Before calling a wireframe Ready, confirm:
- User goal is obvious quickly.
- Every primary CTA has a defined result.
- AI authority and human authority are visibly separated.
- Sensitive/destructive actions have an appropriate confirmation gate.
- No fake business data is assumed.
- Every dynamic block has a source of truth.
- Loading, empty, error, and recovery states are represented.
- Tenant/org context is not treated as a browser-authority shortcut.
- Existing components were checked before creating new ones.
- Mobile interaction is realistic, not a scaled desktop screenshot.
- Keyboard navigation is possible.
- QA can derive deterministic tests from the spec.

If any required item fails, the wireframe is not Ready.

## Definition of Ready

- [ ] Goal and persona are explicit.
- [ ] Prove table is complete.
- [ ] Current route/data/component state was inspected.
- [ ] Existing wireframe/DC/Figma reference was checked.
- [ ] User journey is defined.
- [ ] Component reuse map is complete.
- [ ] Data and state contracts are complete.
- [ ] AI/HITL contract is explicit where applicable.
- [ ] Responsive and accessibility behavior are defined.
- [ ] Acceptance criteria and test scenarios exist.

## Required output package

Keep the package concise but complete:
1. Goal and user outcome.
2. Current-state findings.
3. User journey.
4. ASCII implementation wireframe.
5. Component reuse map.
6. State matrix.
7. Data contract.
8. AI/HITL contract, when applicable.
9. Responsive behavior.
10. Accessibility notes.
11. Risks/blockers.
12. Acceptance criteria.
13. Playwright/verification scenarios.
14. Mermaid diagram when the flow crosses systems, approvals, or meaningful branches.
15. Figma/DC artifact when fidelity or collaboration requires it.

## Canonical principle

A good iPix wireframe is not a disposable drawing. It is the smallest shared contract connecting product intent, current system truth, design, engineering, AI governance, and QA.
