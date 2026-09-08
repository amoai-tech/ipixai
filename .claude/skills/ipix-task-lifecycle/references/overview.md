# ipix-task-lifecycle

Five-phase orchestrator for iPix platform work: **plan → research → implement → test → ship**.

**Canonical hub:** [SKILL.md](../SKILL.md) (v1.8.0) — this file is an index; when in doubt, read SKILL.md.

## Discovery

```
.claude/skills/ipix-task-lifecycle/SKILL.md   ← start here
```

## `/task IPI-NNN` (summary)

See [SKILL.md § default flow](../SKILL.md). Phase 3: [Step 1b pre-edit gate](../implementation.md#step-1b--mandatory-pre-edit-gate) before any code edit.

## Phase modules (read one at a time)

| Phase | File |
|-------|------|
| 1 Plan | [planning.md](../planning.md) |
| 2 Research | [research.md](../research.md) |
| 3 Implement | [implementation.md](../implementation.md) |
| 4 Test | [testing.md](../testing.md) |
| 5 Ship | [shipping.md](../shipping.md) · [pr-workflow](../../pr-workflow/SKILL.md) |

## Process skills

| Child | Purpose |
|-------|---------|
| [brainstorming](../../archive/brainstorming/SKILL.md) | Intent / design exploration |
| [writing-plans](../../writing-plans/SKILL.md) | Implementation plan |
| [mvp](../../mvp/SKILL.md) | Scope cuts |
| [prd-template](prd-template.md) | Full PRD |
| [breakdown-feature-prd](../../archive/brainstorming/breakdown-feature-prd/SKILL.md) | Epic → PRD |
| [lean](../../lean/SKILL.md) | Repo / docs hygiene |
| [feature-dev](../../archive/feature-dev/SKILL.md) | Multi-file architecture |
| [graphify](../../graphify/SKILL.md) | Blast radius before multi-file reads |

## Domain skills (Phase 1 mandatory)

| Child | Purpose |
|-------|---------|
| [domain-skill-routing.md](domain-skill-routing.md) | Path heuristics + **Skills:** line |
| [tasks/intelligence/ai/skill-map.md](../../../../tasks/intelligence/ai/skill-map.md) | Task → skill inventory |
| [mastra](../../mastra/SKILL.md) | Agents, tools, workflows |
| [copilotkit](../../copilotkit/SKILL.md) | CK v2 runtime/UI |
| [ipix-supabase](../../ipix-supabase/SKILL.md) | Schema, RLS, edge |
| [gemini](../../gemini/SKILL.md) | Structured AI output |
| [worktrees](../../worktrees/SKILL.md) | Branch isolation |
| [pr-workflow](../../pr-workflow/SKILL.md) | PR + verify matrix |
| [task-verifier](../../task-verifier/SKILL.md) | Forensic Done gate |

## Sibling skills

| Skill | When |
|-------|------|
| [claude-md-improver](../../archive/claude-md-improver/SKILL.md) | CLAUDE.md + glossary |
| [mermaid-diagrams](../../mermaid-diagrams/SKILL.md) | Linear diagrams |
| [ipix-wireframe](../../ipix-wireframe/SKILL.md) | Lo-fi wireframes |

## References

| File | Contents |
|------|----------|
| [linear-issue-steps.md](linear-issue-steps.md) | A–E steps, gantt, personas |
| [linear-prompt-engineering.md](linear-prompt-engineering.md) | Issues as agent prompts — SSOT |
| [domain-skill-routing.md](domain-skill-routing.md) | mastra / supabase / … routing |
| [linear-spec-template.md](linear-spec-template.md) | Issue markdown shape |
| [prd-template.md](prd-template.md) | PRD structure |
| [per-task-testing.md](per-task-testing.md) | Test per plan task |
| [migration-safety.md](migration-safety.md) | Supabase migrations |
| [audit-checklist.md](audit-checklist.md) | Phase 2 forensic |
| [testing-matrix.md](testing-matrix.md) | Test routing |
| [verifier-probes-ipix.md](verifier-probes-ipix.md) | task-verifier hooks |
| [mcp-cadence-ipix.md](mcp-cadence-ipix.md) | Supabase MCP usage |
| [shipping-templates.md](shipping-templates.md) | todo / commit templates |

## Trackers

- Live Linear project/issues — backlog, dependencies, execution/progress SSOT
- [`tasks`](../../tasks/SKILL.md) — executable task specification/progress standard
- [`supabase/README.md`](../../../../supabase/README.md) — remote DB ops

## Worktree commands (hub summary)

| When | Command |
|------|---------|
| Before add | `npm run worktree:audit` |
| Create | `npm run worktree:add -- IPI-NNN slug` |
| Before code (existing wt) | `npm run worktree:health` |
| Before remove | `npm run worktree:pre-delete` |
