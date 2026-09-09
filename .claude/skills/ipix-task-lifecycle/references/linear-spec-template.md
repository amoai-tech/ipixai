# Linear issue spec template (iPix)

**Reusable body:** [`docs/process/templates/linear-issue-body.md`](../../../../docs/process/templates/linear-issue-body.md). The live Linear issue is the execution/progress SSOT; this template is only a starting structure.
**Guide + install:** [`docs/process/templates/README.md`](../../../../docs/process/templates/README.md) · Playbook [02](../../../../docs/process/02-task-template.md)
**Prompt rules:** [linear-prompt-engineering.md](linear-prompt-engineering.md) · **A–E detail:** [linear-issue-steps.md](linear-issue-steps.md) · **Skills:** [domain-skill-routing.md](domain-skill-routing.md)

This file is a **thin compatibility template**. New substantial tasks use `.claude/skills/tasks/SKILL.md` as the canonical contract.

---

## Title

```text
IPI-<n> · <TASK-ID> — <Real-world plain English title>
```

No local issue filename is required. Save the verified task body directly in Linear.

---

## Required sections

Use the current `tasks` skill structure: purpose, real-world outcome, current state/evidence, architecture/ownership, dependencies/blockers, Mermaid reasoning, implementation checkpoints, acceptance criteria, risk-matched tests, PR evidence, STOP conditions, post-merge proof, and handoff state.

---

## Header stub

```markdown
# IPI-<n> · <TASK-ID> — <title>

**Role:** You are implementing this as an iPix engineer. One concern per PR. Research before custom code.

**Linear:** https://linear.app/amo100/issue/IPI-<n>
**Plain English:** <one sentence>

| Field | Value |
|-------|--------|
| **MVP stage** | Core · Launch Blocker · Post-MVP · Advanced |
| **Parallel** | OK / Must wait on **IPI-NNN · TASK-ID — Plain English title** |
| **Blocked by** | … · **Unblocks:** … |
| **Track** | Platform · UI · DNA · AI · Commerce · Media |
| **Skills** | tasks · task-verifier · <relevant domain skills> |
| **Agents / hooks / commands** | … |
| **Stack** | Only stacks this task touches |
```

Do not add deprecated `ipix-task-lifecycle` or `pr-workflow` to new task skill lists.

---

## Acceptance criteria shape

```markdown
## Acceptance criteria

- **A — <capability>:** <what the user sees>
- **B — <edge case>:** …
- **C — <states>:** empty · loading · success · error
- **D — <live behaviour>:** … (if needed)
- **E — Regression:** Existing <feature> unchanged
```

---

## Completion steps shape

```markdown
#### A. Research / setup
- [ ] **A1** … — proof: …

#### B. Core
- [ ] **B1** … — proof: …

#### C. Edges
- [ ] **C1** … — proof: …

#### D. Automated tests
- [ ] **D1** targeted test — proof: green
- [ ] **D2** risk-matched typecheck/build/SQL/browser proof — proof: green or explicit N/A

#### E. Real-world + ship
- [ ] **E1** affected operator journey — proof: …
- [ ] **E2** exact-head CI/review — proof: …
- [ ] **E3** post-merge exact-main proof — proof: …
```

---

## Good vs bad

| Bad | Good |
|-----|------|
| "Add DNA to assets" | Purpose + Assets surface + chip states AC |
| "Works correctly" | "Blocked chip visible on Assets row before shoot pick" |
| Custom-first | Existing iPix/vendor capability reviewed first |
| No MVP tag | Core / Launch Blocker / Post-MVP / Advanced |
| Bare `IPI-492` | `IPI-492 · CF-AI-004c — Clear errors when…` |

Full canonical contract: [`tasks`](../../tasks/SKILL.md).
