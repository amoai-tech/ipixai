# Phase 1 — Planning

Deprecated lifecycle compatibility coordinator for **Linear-first** planning. Canonical task structure and progress belong to [tasks](../tasks/SKILL.md); this file must not override that contract.

**Load:** [references/linear-issue-steps.md](references/linear-issue-steps.md) · [references/linear-spec-template.md](references/linear-spec-template.md) · [references/linear-prompt-engineering.md](references/linear-prompt-engineering.md) · [references/domain-skill-routing.md](references/domain-skill-routing.md)

---

## Entry / exit criteria

| | Criterion |
|---|---|
| **Entry** | New capability in product docs with no Linear task, OR user asks to scope IPI work, OR an existing issue lacks enough verified execution detail. |
| **Exit** | Live Linear issue satisfies the `tasks` format gate with acceptance criteria, implementation/proof checkpoints, dependencies, and progress/handoff state. |

---

## Workflow checklist

```text
[ ] 1. Read the live Linear issue/project — confirm full task reference, blocked-by relations, priority/MVP context, and current progress.
[ ] 2. Read `.claude/skills/tasks/SKILL.md` and only applicable references; verify repo/live facts before trusting issue assumptions.
[ ] 3. Read only the relevant product/PRD context.
[ ] 4. Classify the task and select `tasks` + relevant domain skills; do not add deprecated lifecycle/pr-workflow aliases to new skill lists.
[ ] 5. Write problem statement and concrete real-world example.
[ ] 6. Write the user/business outcome.
[ ] 7. Add the smallest useful Mermaid reasoning diagrams or explicit N/A reason.
[ ] 8. Draft measurable acceptance criteria and STOP conditions.
[ ] 9. Add exact implementation/proof checkpoints in dependency order.
[ ] 10. Add technical notes, source-of-truth ownership, and explicit out-of-scope items.
[ ] 11. Save verified description/progress directly to Linear.
[ ] 12. Hand off to research/implementation only when the `tasks` gate is satisfied.
```

---

## Routing

| Need | Route to |
|------|----------|
| Canonical task execution | [tasks](../tasks/SKILL.md) |
| Multi-step implementation plan | [writing-plans](../writing-plans/SKILL.md) |
| MVP scope cuts | [mvp](../mvp/SKILL.md) |
| Full PRD from brief | [prd-template](references/prd-template.md) |
| Repo/docs hygiene | [lean](../lean/SKILL.md) |
| Domain skills | [domain-skill-routing.md](references/domain-skill-routing.md) |
| Mermaid reasoning | [mermaid-diagrams](../mermaid-diagrams/SKILL.md) |
| Independent verification | [task-verifier](../task-verifier/SKILL.md) |

---

## Linear task naming

```text
IPI-<n> · <TASK-ID> — <Real-world plain English title>
```

`TASK-ID` is the actual identifier. The live Linear issue is authoritative; no local issue filename is required.

---

## Validation checklist

```text
[ ] Full `IPI-NNN · TASK-ID — Title` reference is correct in Linear
[ ] Linear issue URL/identifier is recorded and authoritative
[ ] Problem statement + real-world user/business outcome present
[ ] Current-state evidence/source of truth recorded
[ ] Mermaid reasoning pass completed or explicit N/A reason
[ ] Each AC is observable and maps to proof
[ ] Each implementation checkpoint has proof
[ ] STOP conditions and out-of-scope items are explicit
[ ] `Skills:` uses `tasks` + relevant domain skills; no deprecated lifecycle/pr-workflow aliases for new work
[ ] Blocked-by / unblocks matches live Linear relations
[ ] Linear status/progress reflects verified reality
```

Hand off only after the live Linear task satisfies the canonical `tasks` gate.
