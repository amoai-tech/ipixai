# Linear issue spec template (iPix)

**Reusable body:** [`docs/process/templates/linear-issue-body.md`](../../../../docs/process/templates/linear-issue-body.md). The live Linear issue is the execution/progress SSOT; this template is only a starting structure.
**Guide + install:** [`docs/process/templates/README.md`](../../../../docs/process/templates/README.md) · Playbook [02](../../../../docs/process/02-task-template.md)
**Prompt rules:** [linear-prompt-engineering.md](linear-prompt-engineering.md) · **A–E detail:** [linear-issue-steps.md](linear-issue-steps.md) · **Skills:** [domain-skill-routing.md](domain-skill-routing.md)

This file is a **thin template entrypoint** for Phase 1. Do not treat it as a task-specific source of truth.

---

## Title

```text
IPI-<n> · <TASK-ID> — <Real-world plain English title>
```

No local issue filename is required. Save the verified task body directly in Linear.

---

## Required sections (order)

| # | Section | Notes |
|---|---------|-------|
| — | Header table | MVP stage · Parallel · Blocked by · Skills · Agents/hooks/commands · Stack · Scores |
| 1 | Purpose | One sentence |
| 2 | Real-world iPix example | Persona + named `/app` surface |
| 3 | User journey impact | Before → during → after |
| 4 | Business value | Launch / ops consequence |
| 5 | Quality checks | Required? MVP? Duplicate? Simpler? Reuse? Parallel? |
| 6 | Research checklist | Docs → GitHub → iPix → Dashboard/CLI |
| 7 | Platform-first plan | See ladder below |
| 8 | Multi-step implementation prompt + A→E | Each step ends with `proof:` |
| 9 | Acceptance criteria | Observable; ≤10; no security OR |
| 10 | Tests & real-world validation | Unit → browser → local → preview → prod-safe |
| 11 | Risks & rollback | |
| 12 | PR evidence required | One concern · proofs · CI |

**Optional:** Wireframe + states (UI) · Mermaid (async) · `<example>` blocks (RLS/AI/API)

---

## Platform-first ladder

```text
Dashboard → CLI → Existing iPix code → Official docs → SDK/module
  → GitHub examples → Templates/recipes → Smallest custom code
  → Tests → Browser verification → PR
```

---

## MVP stage

| Stage | Meaning |
|-------|---------|
| **Core** | Needed for real operators on launch path |
| **Launch Blocker** | Must clear before launch (can also be Core) |
| **Post-MVP** | After first brands are live |
| **Advanced** | Differentiator / park unless LV high and risk low |

---

## Quality scores (1–5)

Priority · Complexity · Risk · User value · Launch value — fill in header.
Defer Advanced + launch value ≤2, or when Dashboard/CLI already solves it.

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
| **Parallel** | OK / Must wait on **IPI-NNN · TASK-ID — Plain English title** (never bare `IPI-NNN`) |
| **Blocked by** | … · **Unblocks:** … |
| **Track** | Platform · UI · DNA · AI · Commerce · Media |
| **Skills** | ipix-task-lifecycle · <domain> · worktrees · pr-workflow |
| **Agents / hooks / commands** | … |
| **Stack** | Only stacks this task touches |
| **Quality scores** | P_ · C_ · R_ · UV_ · LV_ |
```

Slugs = `.claude/skills/<slug>/`. **Read** each `SKILL.md` before writing AC.

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
- [ ] **D1** `npx vitest run …` — proof: N passed
- [ ] **D2** `npm run typecheck` + applicable targeted tests — proof: green

#### E. Real-world + ship
- [ ] **E1** Playwright / MCP Chrome journey — proof: …
- [ ] **E2** localhost test journey using the current repo Playwright/dev configuration — proof: …
- [ ] **E3** Preview / production-safe smoke as applicable — proof: …
- [ ] **E4** Agent validation if AI touched — proof: …
- [ ] **E5** PR evidence · CI · Linear Done — proof: …
```

---

## Good vs bad

| Bad | Good |
|-----|------|
| "Add DNA to assets" | Purpose + Assets surface + chip states AC |
| "Works correctly" | "Blocked chip visible on Assets row before shoot pick" |
| Custom-first | Platform-first table filled |
| No MVP tag | Core / Launch Blocker / Post-MVP / Advanced |
| Bare `IPI-492` | `IPI-492 · CF-AI-004c — Clear errors when…` |

Full paste body + example: [`docs/process/templates/`](../../../../docs/process/templates/).
