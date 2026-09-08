# Phase 1 — Planning

Coordinator for **Linear-first** planning. Routes scoping to child skills; [tasks](../tasks/SKILL.md) owns the executable task format and progress contract.

**Load:** [references/linear-issue-steps.md](references/linear-issue-steps.md) · [references/linear-spec-template.md](references/linear-spec-template.md) · [references/linear-prompt-engineering.md](references/linear-prompt-engineering.md) · [references/domain-skill-routing.md](references/domain-skill-routing.md)

---

## Entry / exit criteria

| | Criterion |
|---|---|
| **Entry** | New capability in [prd.md](../../../prd.md) / [mvp.md](../../../mvp.md) with no Linear spec, OR user asks to scope IPI-/PLT-/UI-/DNA-/COM- work, OR issue exists but lacks A–E steps + Gantt. |
| **Exit** | Live Linear issue satisfies the `tasks` format gate with acceptance criteria, implementation/proof checkpoints, dependencies, and progress/handoff state. |

---

## Workflow checklist

```
[ ] 1.  Read the live Linear issue/project — confirm full task reference, blocked-by relations, priority/MVP context, and current progress.
[ ] 2.  Read `.claude/skills/tasks/SKILL.md` and only the applicable references; verify repo/live facts before trusting issue assumptions.
[ ] 3.  Read prd.md / mvp.md section for the SPEC-ID.
[ ] 3b. **Domain skills (mandatory):** classify task → [domain-skill-routing.md](references/domain-skill-routing.md) + skill-map row → Read each `.claude/skills/<slug>/SKILL.md` → draft **Skills:** line.
[ ] 4.  Route to process child skill if scope ambiguous (routing table below).
[ ] 5.  Write the PROBLEM STATEMENT — what breaks today, concrete examples.
[ ] 6.  Write the USER STORY — single sentence: As / when / I see / so I can.
[ ] 7.  Draw ASCII wireframe (UI tasks) + states table (all 5 states).
[ ] 7b. Add Examples section (good/bad) for security, RLS, AI, or ambiguous API — see linear-prompt-engineering.md.
[ ] 8.  Add mermaid sequenceDiagram or flowchart for async/multi-actor flows.
[ ] 9.  Draft acceptance criteria A–E — each maps to a test type (vitest / smoke / verify).
[ ] 10. Add TECHNICAL NOTES — exact files to touch + explicit "Do NOT" antipatterns.
[ ] 11. Add OUT OF SCOPE — at least 2 explicit exclusions.
[ ] 12. Add Verify block — per-step proof commands ([per-task-testing](references/per-task-testing.md)).
[ ] 13. **Skills:** line in Linear — slugs from domain-skill-routing; each skill has ≥1 proof command.
[ ] 14. Save the verified description/progress directly to Linear through the available Linear connector/API.
[ ] 15. Run validation checklist below.
[ ] 16. Hand off to research.md (Phase 2) or implementation.md if trivial + green-lit.
```

---

## Routing

| Need | Route to |
|------|----------|
| Explore intent / UX before specs | [brainstorming](../archive/brainstorming/SKILL.md) |
| Multi-step implementation plan | [writing-plans](../writing-plans/SKILL.md) |
| Multi-file feature, architecture | [feature-dev](../archive/feature-dev/SKILL.md) |
| MVP scope cuts, launch criteria | [mvp](../mvp/SKILL.md) |
| Full PRD from brief | [prd-template](references/prd-template.md) |
| Epic → feature PRD | [breakdown-feature-prd](../archive/brainstorming/breakdown-feature-prd/SKILL.md) |
| Repo / docs hygiene before large refactor | [lean](../lean/SKILL.md) |
| CLAUDE.md / glossary maintenance | [claude-md-improver](../archive/claude-md-improver/SKILL.md) |
| Linear step format / mermaid rules | [linear-issue-steps.md](references/linear-issue-steps.md) |
| Issue as agent prompt | [linear-prompt-engineering.md](references/linear-prompt-engineering.md) |
| Issue markdown structure | [linear-spec-template.md](references/linear-spec-template.md) |
| Domain skills (mastra, supabase, …) | [domain-skill-routing.md](references/domain-skill-routing.md) · [`skill-map.md`](../../../tasks/intelligence/ai/skill-map.md) |

### Planning decision tree

```
Ambiguous product intent
  └─ brainstorming → writing-plans

Large multi-file / architecture fork
  └─ feature-dev → writing-plans

MVP cut / launch scope
  └─ mvp

Linear issue already satisfies the tasks-format gate
  └─ Skip Phase 1 → Phase 2 or 3

New PRD section needed first
  └─ prd-template → breakdown-feature-prd (if epic) → Linear spec
```

---

## Linear task naming

Canonical full reference:

```text
IPI-<n> · <TASK-ID> — <Real-world plain English title>
```

`TASK-ID` is the actual spec identifier (for example `BRAND-001`, `DASH-MAIN-002`, or `MIGRATE-TEMPLATE`). The live Linear issue is authoritative; no local issue filename is required.

---

## Acceptance criteria rules

| Rule | Why |
|------|-----|
| ≤10 per issue | Forces shippable unit; split if larger |
| Observable / testable | "Works" fails; "Selecting IG Story shows 1080×1920 · 9:16 inline" passes |
| One verb per criterion | Compound criteria hide failures |
| Maps to wiring plan | Every AC → ≥1 file row |
| Five UI states | loading · error · empty · success · unknown/not-found |
| Plain language in Linear steps | Operator/Engineer personas — see linear-issue-steps.md |
| Problem before solution | Every issue must start with WHAT BREAKS TODAY, not what to build |
| Wireframe before AC | Draw the screen before writing ACs — ACs fall out of the wireframe naturally |
| Technical notes required | Name exact files + explicit "Do NOT" — prevents wrong-tool usage in impl |
| Out of scope required | ≥2 explicit exclusions — prevents scope creep during implementation |
| Prompt clarity | No OR in security/auth AC; blockedBy matches cross-issue AC |
| Examples (multishot) | Good/bad snippets for RLS/AI/API; wireframe+states for UI |
| Proof on every step | Each A–E checkbox ends with `proof:` command or smoke note |

---

## Dependency rules

| Rule | Detail |
|------|--------|
| `Blocked by` / `Unblocks` | Required in the live Linear issue when dependencies exist |
| Platform order | Follow live Linear dependency/priority state; never infer order from a nonexistent local tracker |
| Migrations before UI | Schema + RLS before hooks/components that query |
| Edge fn before client | Deploy + verify edge before Next.js client calls it |
| No cycles | If A blocks B and B blocks A, replan |

---

## Milestone vs issue vs spec

| Concept | Granularity | Lives in |
|---------|-------------|----------|
| MVP proof | End-user outcome | [mvp.md](../../../mvp.md) |
| TASK-ID | One shippable task identifier | Live Linear issue |
| Sub-step | Checkbox inside A–E block | Linear description |
| Commerce track | COM-* on Mercur | Separate from Supabase platform |

Never merge or split scope mid-implementation without first updating the live Linear issue and its relations/acceptance criteria.

---

## Validation checklist

```
[ ] Full `IPI-NNN · TASK-ID — Title` reference is correct in Linear
[ ] Linear issue URL/identifier is recorded and authoritative
[ ] PROBLEM STATEMENT present — concrete examples of what breaks today
[ ] USER STORY present — As / when / I see / so I can (single sentence)
[ ] ASCII wireframe present (UI tasks) — shows actual screen layout
[ ] States table present — all 5 states: empty · loading · success · unknown · error
[ ] mermaid sequenceDiagram or flowchart for any async/multi-actor flow
[ ] Each AC maps to vitest, smoke, or verify script
[ ] Linear steps A–E each have a proof command (test output or smoke note)
[ ] TECHNICAL NOTES — exact files to touch + at least one "Do NOT" antipattern
[ ] OUT OF SCOPE — at least 2 explicit exclusions
[ ] Wiring plan lists Create/Modify per file path
[ ] Completion steps A–E with proof per step
[ ] **Skills:** line lists all required slugs (ipix-task-lifecycle + domain); each Read from `.claude/skills/<slug>/SKILL.md`
[ ] Each declared skill has ≥1 AC/step with matching proof command
[ ] Blocked by / Unblocks matches live Linear relations
[ ] No TBD anywhere in the issue
[ ] Prompt lint passed — see linear-prompt-engineering.md validation checklist
[ ] blockedBy in Linear matches any AC that depends on another issue
[ ] Linear status/progress reflects the verified planning state
```

---

## Escalation

| Situation | Route to |
|-----------|----------|
| No PRD section for initiative | [prd-template](references/prd-template.md) → Linear spec |
| Architecture diagram for stakeholders | [mermaid-diagrams](../mermaid-diagrams/SKILL.md) |
| Roadmap / milestone reshuffle | Live Linear project/milestone/dependency state |
| Forensic verify before marking planned | [task-verifier](../task-verifier/SKILL.md) |

Hand off to [research.md](research.md) once the live Linear task satisfies the tasks-format gate.

---

## Issue enrichment — wireframes, diagrams, wiring

Add during Phase 1. Never skip if the issue touches UI or multiple services.

### Wireframe — add when

- Any new UI surface, panel, or screen
- Existing layout is significantly reorganised
- Stakeholder alignment needed before coding

**How:** ASCII wireframe inline in Linear · [ipix-wireframe](../ipix-wireframe/SKILL.md)

### Mermaid — add when

| Diagram | When |
|---------|------|
| `sequenceDiagram` | API chain, auth, multi-service |
| `flowchart` | User journey, data pipeline |
| `stateDiagram-v2` | loading/loaded/error/empty |
| `erDiagram` | New tables / schema |
| component `flowchart` | 3+ React components |

[mermaid-diagrams](../mermaid-diagrams/SKILL.md)

### Frontend ↔ backend wiring — add when

- New/changed API route · Supabase fetch · Realtime · shared context

Minimum block in issue:

```
| Route | Status | Auth | Returns |
|---|---|---|---|
| GET /api/foo/[id] | 🔴 create | withOperatorAuth | { ... } |
```

Auth: `withOperatorAuth` + `createSupabaseServerClient`. Fetch: `useSWR` null-gated or RSC.

### Decision table

| Issue type | Wireframe | Mermaid | Wiring |
|---|---|---|---|
| New UI screen / panel | ✅ | flowchart + sequence | ✅ |
| UI change (existing) | if layout changes | state diagram | if fetch changes |
| API route only | — | sequence | ✅ |
| DB migration only | — | erDiagram | if types change |
| Bug fix | — | — | if wiring gap |
| Refactor | — | component tree if complex | — |
